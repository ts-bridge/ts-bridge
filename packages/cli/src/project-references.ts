import assert from 'assert';
import type {
  CompilerHost,
  CompilerOptions,
  ResolvedProjectReference,
} from 'typescript';
import typescript from 'typescript';

import { getDefinedArray } from './utils.js';

const { createCompilerHost, getOutputFileNames } = typescript;

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
  cycle: boolean;
};

/**
 * Topologically sort a dependency graph, i.e., sort the nodes in the graph such
 * that all dependencies of a node come before the node itself.
 *
 * @param graph - The dependency graph to sort.
 * @returns The topologically sorted nodes and whether there was a cycle.
 */
export function topologicalSort<Value>(
  graph: DependencyGraph<Value>,
): TopologicalSortResult<Value> {
  const stack: Value[] = [];
  const visited = new Set<Value>();
  const recursionStack = new Set<Value>();
  let cycle = false;

  /**
   * Visit a node in the graph.
   *
   * @param node - The node to visit.
   */
  function visit(node: Value) {
    if (recursionStack.has(node)) {
      cycle = true;
      return;
    }

    if (visited.has(node)) {
      return;
    }

    recursionStack.add(node);
    visited.add(node);

    const neighbours = graph.get(node);
    assert(neighbours !== undefined);

    neighbours.forEach(visit);
    recursionStack.delete(node);
    stack.push(node);
  }

  for (const node of graph.keys()) {
    visit(node);
  }

  return {
    stack,
    cycle,
  };
}

/**
 * Get the resolved project references from a TypeScript program.
 *
 * @param resolvedProjectReferences - The resolved project references of the
 * package that is being built.
 * @returns The resolved project references.
 */
export function getResolvedProjectReferences(
  resolvedProjectReferences: ResolvedProjectReference[],
) {
  const graph = createGraph(resolvedProjectReferences);
  const { stack, cycle } = topologicalSort(graph);

  if (cycle) {
    throw new Error(
      'Unable to build project references due to a dependency cycle.',
    );
  }

  return stack;
}

/**
 * Get a list of the output file paths in the referenced projects.
 *
 * @param resolvedProjectReferences - The resolved project references of the
 * package that is being built.
 * @returns A list of output paths.
 */
export function getReferencedProjectPaths(
  resolvedProjectReferences: readonly ResolvedProjectReference[],
): string[] {
  return resolvedProjectReferences.flatMap(({ commandLine }) => {
    return commandLine.fileNames.flatMap((fileName) =>
      getOutputFileNames(commandLine, fileName, false),
    );
  });
}

/**
 * Create a compiler host that can be used to build projects using
 * project references.
 *
 * This is almost the same as the default compiler host, but it modifies the
 * `getSourceFile` method to look at `.d.cts` files instead of `.d.ts` files for
 * declaration files.
 *
 * @param compilerOptions - The compiler options to use.
 * @param resolvedProjectReferences - The resolved project references of the
 * package that is being built.
 * @returns The compiler host.
 */
export function createProjectReferencesCompilerHost(
  compilerOptions: CompilerOptions,
  resolvedProjectReferences: readonly ResolvedProjectReference[],
): CompilerHost {
  const host = createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const referencedProjectPaths = getReferencedProjectPaths(
    resolvedProjectReferences,
  );

  const getSourceFile: CompilerHost['getSourceFile'] = (fileName, ...args) => {
    if (!referencedProjectPaths.includes(fileName)) {
      return originalGetSourceFile(fileName, ...args);
    }

    // TypeScript checks the referenced distribution files to see if the project
    // is built. We simply point it to the `.d.cts` files instead of the `.d.ts`
    // files.
    return originalGetSourceFile(fileName.replace(/\.ts$/u, '.cts'), ...args);
  };

  return {
    ...host,
    getSourceFile,
  };
}
