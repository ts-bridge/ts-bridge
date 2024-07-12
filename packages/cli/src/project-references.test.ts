import { getFixture, getRelativePath } from '@ts-bridge/test-utils';
import { dirname } from 'path';
import type { Program, ResolvedProjectReference } from 'typescript';
import { ScriptTarget, sys } from 'typescript';
import { fileURLToPath } from 'url';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildProjectReferences, getProgram } from './build.js';
import { getTypeScriptConfig } from './config.js';
import type { DependencyGraph } from './project-references.js';
import {
  createGraph,
  createProjectReferencesCompilerHost,
  getResolvedProjectReferences,
  topologicalSort,
} from './project-references.js';
import { getDefinedArray } from './utils.js';

/**
 * Get the compact name of a resolved project reference.
 *
 * @param name - The full name of the resolved project reference.
 * @returns The compact name of the resolved project reference.
 */
function getReferenceName(name: string) {
  return getRelativePath('project-references', dirname(name));
}

/**
 * Simplify an array of resolved project references for ease of testing.
 *
 * @param array - The array of resolved project references to simplify.
 * @returns The array with string values.
 */
function simplifyArray(array: ResolvedProjectReference[]) {
  return array.map((reference) =>
    getReferenceName(reference.sourceFile.fileName),
  );
}

/**
 * Simplify a dependency graph for ease of testing.
 *
 * @param graph - The dependency graph to simplify.
 * @returns The dependency graph with string keys and values.
 */
function simplifyGraph(graph: DependencyGraph<ResolvedProjectReference>) {
  const map = new Map<string, string[]>();

  for (const [key, value] of graph) {
    map.set(getReferenceName(key.sourceFile.fileName), simplifyArray(value));
  }

  return map;
}

describe('createGraph', () => {
  it('creates a dependency graph', () => {
    const { options, projectReferences, fileNames } = getTypeScriptConfig(
      getFixture('project-references', 'tsconfig.json'),
    );

    const program = getProgram({
      compilerOptions: options,
      files: fileNames,
      projectReferences,
    });

    const references = getDefinedArray(program.getResolvedProjectReferences());
    const graph = createGraph(references);

    expect(simplifyGraph(graph)).toMatchInlineSnapshot(`
      Map {
        "packages/project-1" => [
          "packages/project-3",
        ],
        "packages/project-2" => [
          "packages/project-1",
        ],
        "packages/project-3" => [],
      }
    `);
  });
});

describe('topologicalSort', () => {
  it('topologically sorts a dependency graph', () => {
    const graph: DependencyGraph<string> = new Map([
      ['a', ['b', 'd']],
      ['b', ['c', 'e']],
      ['c', ['d']],
      ['d', ['e']],
      ['e', []],
    ]);

    const { stack, cycles } = topologicalSort(graph);
    expect(stack).toStrictEqual(['e', 'd', 'c', 'b', 'a']);
    expect(cycles).toStrictEqual([]);
  });

  it('detects cycles in the dependency graph', () => {
    const graph: DependencyGraph<string> = new Map([
      ['a', ['b']],
      ['b', ['a']],
      ['c', ['d']],
      ['d', ['e']],
      ['e', ['c']],
    ]);

    const { stack, cycles } = topologicalSort(graph);
    expect(stack).toStrictEqual(['b', 'a', 'e', 'd', 'c']);
    expect(cycles).toStrictEqual([
      ['a', 'b', 'a'],
      ['c', 'd', 'e', 'c'],
    ]);
  });
});

describe('getResolvedProjectReferences', () => {
  it('gets the resolved project references', () => {
    const { options, projectReferences, fileNames } = getTypeScriptConfig(
      getFixture('project-references', 'tsconfig.json'),
    );

    const program = getProgram({
      compilerOptions: options,
      files: fileNames,
      projectReferences,
    });

    const references = getDefinedArray(program.getResolvedProjectReferences());
    const resolvedProjectReferences = getResolvedProjectReferences(
      getFixture('project-references'),
      references,
    ).map((reference) => getReferenceName(reference.sourceFile.fileName));

    expect(resolvedProjectReferences).toStrictEqual([
      'packages/project-3',
      'packages/project-1',
      'packages/project-2',
    ]);
  });

  it('throws an error if a project reference is circular', () => {
    const { options, projectReferences, fileNames } = getTypeScriptConfig(
      getFixture('project-references', 'tsconfig.circular.json'),
    );

    const program = getProgram({
      compilerOptions: options,
      files: fileNames,
      projectReferences,
    });

    const references = getDefinedArray(program.getResolvedProjectReferences());
    expect(() =>
      getResolvedProjectReferences(
        getFixture('project-references'),
        references,
      ),
    ).toThrow(`Unable to build project references due to a dependency cycle:
- packages/project-1/tsconfig.circular.json -> packages/project-3/tsconfig.circular.json -> packages/project-2/tsconfig.circular.json -> packages/project-1/tsconfig.circular.json`);
  });
});

describe('createProjectReferencesCompilerHost', () => {
  let program: Program;
  const tsConfig = getTypeScriptConfig(
    getFixture('project-references', 'tsconfig.json'),
  );

  beforeAll(() => {
    program = getProgram({
      compilerOptions: tsConfig.options,
      files: tsConfig.fileNames,
      projectReferences: tsConfig.projectReferences,
    });

    // To test the modified `getSourceFile` method, the project references need
    // to be built.
    buildProjectReferences({
      program,
      tsConfig,
      compilerOptions: tsConfig.options,
      files: tsConfig.fileNames,
      format: ['commonjs'],
      baseDirectory: getFixture('project-references'),
      system: sys,
    });
  });

  it('modifies the source file to `.cts` when building `commonjs`', () => {
    const host = createProjectReferencesCompilerHost(
      ['commonjs'],
      tsConfig.options,
      getDefinedArray(program.getResolvedProjectReferences()),
    );

    const sourceFile = host.getSourceFile(
      getFixture('project-references', 'packages/project-1/dist/index.d.ts'),
      ScriptTarget.ES2020,
    );

    expect(sourceFile).toBeDefined();
    expect(sourceFile?.fileName).toContain(
      'packages/project-1/dist/index.d.cts',
    );
  });

  it('modifies the source file to `.mts` when building `module`', () => {
    const host = createProjectReferencesCompilerHost(
      ['module'],
      tsConfig.options,
      getDefinedArray(program.getResolvedProjectReferences()),
    );

    const sourceFile = host.getSourceFile(
      getFixture('project-references', 'packages/project-1/dist/index.d.ts'),
      ScriptTarget.ES2020,
    );

    expect(sourceFile).toBeDefined();
    expect(sourceFile?.fileName).toContain(
      'packages/project-1/dist/index.d.mts',
    );
  });

  it('does not modify the source file for non-output files', () => {
    const host = createProjectReferencesCompilerHost(
      ['commonjs'],
      tsConfig.options,
      getDefinedArray(program.getResolvedProjectReferences()),
    );

    const sourceFile = host.getSourceFile(
      fileURLToPath(import.meta.url),
      ScriptTarget.ES2020,
    );

    expect(sourceFile).toBeDefined();
    expect(sourceFile?.fileName).toBe(fileURLToPath(import.meta.url));
  });
});
