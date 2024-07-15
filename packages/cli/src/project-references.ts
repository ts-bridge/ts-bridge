import assert from 'assert';
import { relative } from 'path';
import type {
  CompilerHost,
  CompilerOptions,
  ParsedCommandLine,
  ResolvedModuleWithFailedLookupLocations,
  ResolvedProjectReference,
  StringLiteralLike,
  System,
} from 'typescript';
import typescript from 'typescript';

import type { BuildType } from './build-type.js';
import { getBuildTypeOptions } from './build-type.js';
import { getTypeScriptConfig } from './config.js';
import { getCanonicalFileName } from './file-system.js';
import { getDefinedArray } from './utils.js';

const { createCompilerHost, getOutputFileNames, resolveModuleName } =
  typescript;

/**
 * A dependency graph where each value has a list of dependencies.
 *
 * @template Value - The type of the values in the graph.
 */
export type DependencyGraph<Value> = Map<Value, Value[]>;

/**
 * Create a dependency graph from the resolved project references.
 *
 * @param resolvedProjectReferences - The resolved project references of the
 * package that is being built.
 * @returns The dependency graph.
 */
export function createGraph(
  resolvedProjectReferences: readonly ResolvedProjectReference[],
): DependencyGraph<ResolvedProjectReference> {
  const graph: DependencyGraph<ResolvedProjectReference> = new Map();

  for (const projectReference of resolvedProjectReferences) {
    graph.set(projectReference, getDefinedArray(projectReference.references));
  }

  return graph;
}

/**
 * The result of a topological sort.
 *
 * @template Value - The type of the values in the graph.
 */
export type TopologicalSortResult<Value> = {
  /**
   * The sorted nodes.
   */
  stack: Value[];

  /**
   * Whether there was a cycle in the graph.
   */
  cycles: Value[][];
};

/**
 * Topologically sort a dependency graph, i.e., sort the nodes in the graph such
 * that all dependencies of a node come before the node itself.
 *
 * @param graph - The dependency graph to sort.
 * @returns The topologically sorted nodes and an array of cycles (if any).
 */
export function topologicalSort<Value>(
  graph: DependencyGraph<Value>,
): TopologicalSortResult<Value> {
  const stack: Value[] = [];
  const visited = new Set<Value>();
  const recursionStack = new Set<Value>();
  const cycles: Value[][] = [];

  /**
   * Visit a node in the graph.
   *
   * @param node - The node to visit.
   * @param path - The current path in the graph.
   */
  function visit(node: Value, path: Value[]) {
    if (recursionStack.has(node)) {
      cycles.push([...path, node]);
      return;
    }

    if (visited.has(node)) {
      return;
    }

    recursionStack.add(node);
    visited.add(node);

    // The graph only contains dependencies that are referenced in the parent
    // `tsconfig.json`. If it's not referenced there, we can assume that it
    // doesn't have any dependencies.
    const neighbours = graph.get(node) ?? [];

    neighbours.forEach((neighbour) => visit(neighbour, [...path, node]));
    recursionStack.delete(node);
    stack.push(node);
  }

  for (const node of graph.keys()) {
    visit(node, []);
  }

  return {
    stack,
    cycles,
  };
}

/**
 * Get the error message for a dependency cycle.
 *
 * @param baseDirectory - The base directory path.
 * @param cycles - The cycles in the dependency graph.
 * @returns The error message.
 */
export function getCyclesError(
  baseDirectory: string,
  cycles: ResolvedProjectReference[][],
): string {
  const cyclesMessage = cycles
    .map(
      (cycle) =>
        `- ${cycle
          .map((reference) =>
            relative(baseDirectory, reference.sourceFile.fileName),
          )
          .join(' -> ')}`,
    )
    .join('\n');

  return `Unable to build project references due to one or more dependency cycles:\n${cyclesMessage}`;
}

/**
 * Get the resolved project references from a TypeScript program.
 *
 * @param baseDirectory - The base directory path.
 * @param resolvedProjectReferences - The resolved project references of the
 * package that is being built.
 * @returns The resolved project references.
 */
export function getResolvedProjectReferences(
  baseDirectory: string,
  resolvedProjectReferences: ResolvedProjectReference[],
) {
  const graph = createGraph(resolvedProjectReferences);
  const { stack, cycles } = topologicalSort(graph);

  if (cycles.length > 0) {
    throw new Error(getCyclesError(baseDirectory, cycles));
  }

  return stack;
}

/**
 * Get the output file paths for a list of files.
 *
 * @param files - The list of files.
 * @param options - The compiler options.
 * @returns The output file paths.
 */
function getOutputPaths(files: string[], options: ParsedCommandLine) {
  return files.flatMap((fileName) =>
    getOutputFileNames(options, fileName, false),
  );
}

/**
 * A tuple containing an array of input files and an array of output files.
 *
 * @property 0 - The array of input files.
 * @property 1 - The array of output files.
 */
type ReferencedFiles = [string[], string[]];

/**
 * Resolve the input and output file paths of the project references. This not
 * only resolves the input and output files of direct project references, but
 * also of the nested project references.
 *
 * @param options - The compiler options.
 * @param inputs - The set of input files to add to.
 * @param outputs - The set of output files to add to.
 * @returns A tuple containing an array of input files and an array of output
 * files.
 */
function resolveProjectReferenceFiles(
  options: ParsedCommandLine,
  inputs: Set<string>,
  outputs: Set<string>,
): ReferencedFiles {
  /* eslint-disable @typescript-eslint/unbound-method */
  options.fileNames.forEach(inputs.add, inputs);
  getOutputPaths(options.fileNames, options).forEach(outputs.add, outputs);

  if (options.projectReferences) {
    for (const reference of options.projectReferences) {
      const referenceOptions = getTypeScriptConfig(reference.path);
      referenceOptions.fileNames.forEach(inputs.add, inputs);

      getOutputPaths(referenceOptions.fileNames, referenceOptions).forEach(
        outputs.add,
        outputs,
      );

      resolveProjectReferenceFiles(referenceOptions, inputs, outputs);
    }
  }
  /* eslint-enable @typescript-eslint/unbound-method */

  return [Array.from(inputs), Array.from(outputs)];
}

/**
 * Get a list of the output file paths in the referenced projects.
 *
 * @param resolvedProjectReferences - The resolved project references of the
 * package that is being built.
 * @returns A list of output paths.
 */
function getReferencedProjectPaths(
  resolvedProjectReferences: readonly ResolvedProjectReference[],
): ReferencedFiles {
  const inputs = new Set<string>();
  const outputs = new Set<string>();

  for (const reference of resolvedProjectReferences) {
    const referenceOptions = getTypeScriptConfig(reference.sourceFile.fileName);
    resolveProjectReferenceFiles(referenceOptions, inputs, outputs);
  }

  return [Array.from(inputs), Array.from(outputs)];
}

/**
 * Get the module name from a {@link StringLiteralLike}, based on the containing
 * file and the list of input files.
 *
 * If the containing file is in the list of input files, the module name
 * extension is replaced with `.js`. Otherwise, the module name is returned as
 * is.
 *
 * @param moduleLiteral - The module literal.
 * @param containingFile - The containing file.
 * @param inputs - The list of input files.
 * @returns The module name as string.
 */
function getModuleName(
  moduleLiteral: StringLiteralLike,
  containingFile: string,
  inputs: string[],
) {
  if (inputs.includes(containingFile)) {
    return moduleLiteral.text.replace(/\.[cm]js$/u, '.js');
  }

  return moduleLiteral.text;
}

/**
 * Create a compiler host that can be used to build projects using
 * project references.
 *
 * This is almost the same as the default compiler host, but it modifies the
 * `getSourceFile` method to look at `.d.cts` files instead of `.d.ts` files for
 * declaration files.
 *
 * @param format - The format of the output files.
 * @param compilerOptions - The compiler options to use.
 * @param resolvedProjectReferences - The resolved project references of the
 * package that is being built.
 * @param system - The TypeScript system to use.
 * @returns The compiler host.
 */
export function createProjectReferencesCompilerHost(
  format: BuildType[],
  compilerOptions: CompilerOptions,
  resolvedProjectReferences: readonly ResolvedProjectReference[],
  system: System,
): CompilerHost {
  assert(format[0]);
  const { sourceExtension } = getBuildTypeOptions(format[0]);

  const compilerHost = createCompilerHost(compilerOptions);
  const originalGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);
  const [inputs, outputs] = getReferencedProjectPaths(
    resolvedProjectReferences,
  );

  const getSourceFile: CompilerHost['getSourceFile'] = (fileName, ...args) => {
    if (!outputs.includes(fileName)) {
      return originalGetSourceFile(fileName, ...args);
    }

    // TypeScript checks the referenced distribution files to see if the project
    // is built. We simply point it to the `.d.cts` files instead of the `.d.ts`
    // files.
    return originalGetSourceFile(
      fileName.replace(/\.ts$/u, sourceExtension),
      ...args,
    );
  };

  const cache = typescript.createModuleResolutionCache(
    process.cwd(),
    (fileName) => getCanonicalFileName(fileName, system),
  );

  const host: CompilerHost = {
    ...compilerHost,
    getSourceFile,
    resolveModuleNameLiterals(
      moduleLiterals: readonly StringLiteralLike[],
      containingFile: string,
      redirectedReference: ResolvedProjectReference | undefined,
      options: CompilerOptions,
    ): readonly ResolvedModuleWithFailedLookupLocations[] {
      return moduleLiterals.map((moduleLiteral) => {
        const name = getModuleName(moduleLiteral, containingFile, inputs);
        return resolveModuleName(
          name,
          containingFile,
          options,
          host,
          cache,
          redirectedReference,
        );
      });
    },
  };

  return host;
}
