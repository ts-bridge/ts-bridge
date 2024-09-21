import { createDeferredPromise } from '@metamask/utils';
import { getFixture, getRelativePath, delay } from '@ts-bridge/test-utils';
import assert from 'assert';
import chalk from 'chalk';
import { dirname, join } from 'path';
import type { Program, ResolvedProjectReference } from 'typescript';
import { factory, ScriptTarget, sys } from 'typescript';
import { fileURLToPath } from 'url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { WorkerOptions } from 'worker_threads';

import { getTypeScriptConfig } from './config.js';
import type { DependencyGraph } from './project-references.js';
import {
  parallelise,
  createGraph,
  createProjectReferencesCompilerHost,
  getResolvedProjectReferences,
  topologicalSort,
} from './project-references.js';
import { buildProjectReferences, getProgram } from './shared.js';
import { getDefinedArray } from './utils.js';

beforeAll(() => {
  chalk.level = 0;
});

vi.mock('worker_threads', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const original = await importOriginal<typeof import('worker_threads')>();

  /**
   * The worker code that runs TypeScript code. This is executed in the worker by
   * using it as a data URL.
   */
  const WORKER_CODE = `
    import { createRequire } from 'module';
    import { workerData } from 'worker_threads';

    const filename = '${import.meta.url}';
    const tsconfig = '${join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'tsconfig.json',
    )}';

    const require = createRequire(filename);
    const { tsImport } = require('tsx/esm/api');

    tsImport(workerData.fileName, {
      parentURL: import.meta.url,
      tsconfig,
    });
  `;

  /**
   * A worker that runs TypeScript code.
   */
  class TypeScriptWorker extends original.Worker {
    /**
     * Creates a new TypeScript worker.
     *
     * @param fileName - The file name of worker to run.
     * @param options - The worker options.
     * @returns The TypeScript worker.
     */
    constructor(fileName: string | URL, options: WorkerOptions = {}) {
      options.workerData ??= {};
      options.workerData.fileName = fileName.toString().replace('.js', '.ts');

      super(new URL(`data:text/javascript,${WORKER_CODE}`), options);
    }
  }

  return {
    ...original,
    Worker: TypeScriptWorker,
  };
});

const FIXTURE_NAME = 'project-references-node-16';
const FIXTURE_PATH = getFixture(FIXTURE_NAME);
const FIXTURE_TS_CONFIG = getFixture(FIXTURE_NAME, 'tsconfig.json');

/**
 * Get the compact name of a resolved project reference.
 *
 * @param name - The full name of the resolved project reference.
 * @returns The compact name of the resolved project reference.
 */
function getReferenceName(name: string) {
  return getRelativePath(FIXTURE_NAME, dirname(name));
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
    const { options, projectReferences, fileNames } =
      getTypeScriptConfig(FIXTURE_TS_CONFIG);

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

  it('topologically sorts a dependency graph with missing nodes', () => {
    const graph: DependencyGraph<string> = new Map([
      ['a', ['b', 'd']],
      ['b', ['c', 'e']],
      ['c', ['d']],
      ['d', ['e']],
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

describe('parallelise', () => {
  it('runs a function in parallel for a dependency graph', async () => {
    const graph: DependencyGraph<string> = new Map([
      ['a', ['b', 'c']],
      ['b', ['d', 'e']],
      ['c', ['e']],
      ['d', ['e']],
      ['e', []],
    ]);

    const { promise: promiseA, resolve: resolveA } = createDeferredPromise();
    const { promise: promiseB, resolve: resolveB } = createDeferredPromise();
    const { promise: promiseC, resolve: resolveC } = createDeferredPromise();
    const { promise: promiseD, resolve: resolveD } = createDeferredPromise();
    const { promise: promiseE, resolve: resolveE } = createDeferredPromise();

    const set = new Set<string>();

    const sorted = topologicalSort(graph).stack;
    const parallelPromise = parallelise(sorted, graph, async (key) => {
      set.add(key);
      switch (key) {
        case 'a':
          await promiseA;
          break;
        case 'b':
          await promiseB;
          break;
        case 'c':
          await promiseC;
          break;
        case 'd':
          await promiseD;
          break;
        case 'e':
          await promiseE;
          break;
        default:
          throw new Error(`Unknown key: "${key}".`);
      }
    });

    // `e` is the only node without dependencies, so it should be resolve
    // first.
    expect(set.has('e')).toBe(true);
    expect(set.has('d')).not.toBe(true);
    expect(set.has('c')).not.toBe(true);

    resolveE();
    await delay(1);

    // `d` and `c` are the next nodes in the graph, so they should be resolved
    // next.
    expect(set.has('d')).toBe(true);
    expect(set.has('c')).toBe(true);

    resolveD();
    await delay(1);

    // `b` depends on `d` and `e`, so it should be resolved once they are.
    expect(set.has('b')).toBe(true);
    expect(set.has('a')).not.toBe(true);

    resolveC();
    resolveB();
    await delay(1);

    // `a` depends on `b` and `c`, so it should be resolved once they are.
    expect(set.has('a')).toBe(true);

    resolveA();
    await parallelPromise;
  });

  it('limits the tasks to the concurrency limit', async () => {
    const graph: DependencyGraph<string> = new Map([
      ['a', []],
      ['b', []],
      ['c', []],
    ]);

    const { promise: promiseA, resolve: resolveA } = createDeferredPromise();
    const { promise: promiseB, resolve: resolveB } = createDeferredPromise();
    const { promise: promiseC, resolve: resolveC } = createDeferredPromise();

    const set = new Set<string>();

    const sorted = topologicalSort(graph).stack;
    const parallelPromise = parallelise(
      sorted,
      graph,
      async (key) => {
        set.add(key);
        switch (key) {
          case 'a':
            await promiseA;
            break;
          case 'b':
            await promiseB;
            break;
          case 'c':
            await promiseC;
            break;
          default:
            throw new Error(`Unknown key: "${key}".`);
        }
      },
      1,
    );

    // `a` is the first node in the graph, so it should be resolved first.
    expect(set.has('a')).toBe(true);
    expect(set.has('b')).not.toBe(true);
    expect(set.has('c')).not.toBe(true);

    resolveA();
    await delay(1);

    // `b` is the next node in the graph, so it should be resolved next.
    expect(set.has('b')).toBe(true);
    expect(set.has('c')).not.toBe(true);

    resolveB();
    await delay(1);

    // `c` is the last node in the graph, so it should be resolved last.
    expect(set.has('c')).toBe(true);

    resolveC();

    await parallelPromise;
  });

  it('assumes no dependencies if a value is not in the graph', async () => {
    const graph: DependencyGraph<string> = new Map([
      ['a', ['b', 'c']],
      ['b', ['d', 'e']],
      ['c', ['e']],
      ['d', ['e']],
    ]);

    const { promise: promiseA, resolve: resolveA } = createDeferredPromise();
    const { promise: promiseB, resolve: resolveB } = createDeferredPromise();
    const { promise: promiseC, resolve: resolveC } = createDeferredPromise();
    const { promise: promiseD, resolve: resolveD } = createDeferredPromise();
    const { promise: promiseE, resolve: resolveE } = createDeferredPromise();

    const set = new Set<string>();

    const sorted = topologicalSort(graph).stack;
    const parallelPromise = parallelise(sorted, graph, async (key) => {
      set.add(key);
      switch (key) {
        case 'a':
          await promiseA;
          break;
        case 'b':
          await promiseB;
          break;
        case 'c':
          await promiseC;
          break;
        case 'd':
          await promiseD;
          break;
        case 'e':
          await promiseE;
          break;
        default:
          throw new Error(`Unknown key: "${key}".`);
      }
    });

    // `e` is the only node without dependencies, so it should be resolve
    // first.
    expect(set.has('e')).toBe(true);
    expect(set.has('d')).not.toBe(true);
    expect(set.has('c')).not.toBe(true);

    resolveE();
    await delay(1);

    // `d` and `c` are the next nodes in the graph, so they should be resolved
    // next.
    expect(set.has('d')).toBe(true);
    expect(set.has('c')).toBe(true);

    resolveD();
    await delay(1);

    // `b` depends on `d` and `e`, so it should be resolved once they are.
    expect(set.has('b')).toBe(true);
    expect(set.has('a')).not.toBe(true);

    resolveC();
    resolveB();
    await delay(1);

    // `a` depends on `b` and `c`, so it should be resolved once they are.
    expect(set.has('a')).toBe(true);

    resolveA();
    await parallelPromise;
  });
});

describe('getResolvedProjectReferences', () => {
  it('gets the resolved project references', () => {
    const { options, projectReferences, fileNames } =
      getTypeScriptConfig(FIXTURE_TS_CONFIG);

    const program = getProgram({
      compilerOptions: options,
      files: fileNames,
      projectReferences,
    });

    const references = getDefinedArray(program.getResolvedProjectReferences());
    const resolvedProjectReferences = getResolvedProjectReferences(
      FIXTURE_PATH,
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
      getFixture(FIXTURE_NAME, 'tsconfig.circular.json'),
    );

    const program = getProgram({
      compilerOptions: options,
      files: fileNames,
      projectReferences,
    });

    const references = getDefinedArray(program.getResolvedProjectReferences());
    expect(() => getResolvedProjectReferences(FIXTURE_PATH, references))
      .toThrow(`Unable to build project references due to one or more dependency cycles:
- packages/project-1/tsconfig.circular.json -> packages/project-3/tsconfig.circular.json -> packages/project-2/tsconfig.circular.json -> packages/project-1/tsconfig.circular.json`);
  });
});

describe('createProjectReferencesCompilerHost', () => {
  let program: Program;
  const tsConfig = getTypeScriptConfig(FIXTURE_TS_CONFIG);

  beforeAll(async () => {
    program = getProgram({
      compilerOptions: tsConfig.options,
      files: tsConfig.fileNames,
      projectReferences: tsConfig.projectReferences,
    });

    // To test the modified `getSourceFile` method, the project references need
    // to be built.
    await buildProjectReferences({
      name: FIXTURE_PATH,
      program,
      tsConfig,
      compilerOptions: tsConfig.options,
      files: tsConfig.fileNames,
      format: ['commonjs', 'module'],
      baseDirectory: FIXTURE_PATH,
      system: sys,
      shims: false,
    });
  });

  describe('getSourceFile', () => {
    it('modifies the source file to `.cts` when building `commonjs`', () => {
      const host = createProjectReferencesCompilerHost(
        ['commonjs'],
        tsConfig.options,
        getDefinedArray(program.getResolvedProjectReferences()),
        sys,
      );

      const sourceFile = host.getSourceFile(
        getFixture(FIXTURE_NAME, 'packages/project-1/dist/index.d.ts'),
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
        sys,
      );

      const sourceFile = host.getSourceFile(
        getFixture(FIXTURE_NAME, 'packages/project-1/dist/index.d.ts'),
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
        sys,
      );

      const sourceFile = host.getSourceFile(
        fileURLToPath(import.meta.url),
        ScriptTarget.ES2020,
      );

      expect(sourceFile).toBeDefined();
      expect(sourceFile?.fileName).toBe(fileURLToPath(import.meta.url));
    });
  });

  describe('resolveModuleNameLiterals', () => {
    it('resolves a `.cjs` file', () => {
      const host = createProjectReferencesCompilerHost(
        ['commonjs'],
        tsConfig.options,
        getDefinedArray(program.getResolvedProjectReferences()),
        sys,
      );

      const containingPath = getFixture(
        FIXTURE_NAME,
        'packages/project-3/src/index.ts',
      );

      const containingFile = host.getSourceFile(
        containingPath,
        ScriptTarget.ES2020,
      );

      assert(containingFile);

      const modules = host.resolveModuleNameLiterals?.(
        [
          factory.createStringLiteral('./index.cjs'),
          factory.createStringLiteral('./foo.cjs'),
        ],
        containingPath,
        undefined,
        tsConfig.options,
        containingFile,
        [],
      );

      expect(modules).toHaveLength(2);
      expect(modules?.[0]?.resolvedModule?.resolvedFileName).toBe(
        getFixture(FIXTURE_NAME, 'packages/project-3/src/index.ts'),
      );
      expect(modules?.[1]?.resolvedModule?.resolvedFileName).toBe(
        getFixture(FIXTURE_NAME, 'packages/project-3/src/foo.ts'),
      );
    });

    it('resolves a `.mjs` file', () => {
      const host = createProjectReferencesCompilerHost(
        ['commonjs'],
        tsConfig.options,
        getDefinedArray(program.getResolvedProjectReferences()),
        sys,
      );

      const containingPath = getFixture(
        FIXTURE_NAME,
        'packages/project-3/src/index.ts',
      );

      const containingFile = host.getSourceFile(
        containingPath,
        ScriptTarget.ES2020,
      );

      assert(containingFile);

      const modules = host.resolveModuleNameLiterals?.(
        [
          factory.createStringLiteral('./index.mjs'),
          factory.createStringLiteral('./foo.mjs'),
        ],
        containingPath,
        undefined,
        tsConfig.options,
        containingFile,
        [],
      );

      expect(modules).toHaveLength(2);
      expect(modules?.[0]?.resolvedModule?.resolvedFileName).toBe(
        getFixture(FIXTURE_NAME, 'packages/project-3/src/index.ts'),
      );
      expect(modules?.[1]?.resolvedModule?.resolvedFileName).toBe(
        getFixture(FIXTURE_NAME, 'packages/project-3/src/foo.ts'),
      );
    });
  });

  describe('resolveModuleNames', () => {
    it('resolves a `.cjs` file', () => {
      const host = createProjectReferencesCompilerHost(
        ['commonjs'],
        tsConfig.options,
        getDefinedArray(program.getResolvedProjectReferences()),
        sys,
      );

      const containingPath = getFixture(
        FIXTURE_NAME,
        'packages/project-3/src/index.ts',
      );

      const containingFile = host.getSourceFile(
        containingPath,
        ScriptTarget.ES2020,
      );

      assert(containingFile);

      const modules = host.resolveModuleNames?.(
        ['./index.cjs', './foo.cjs'],
        containingPath,
        undefined,
        undefined,
        tsConfig.options,
        containingFile,
      );

      expect(modules).toHaveLength(2);
      expect(modules?.[0]?.resolvedFileName).toBe(
        getFixture(FIXTURE_NAME, 'packages/project-3/src/index.ts'),
      );
      expect(modules?.[1]?.resolvedFileName).toBe(
        getFixture(FIXTURE_NAME, 'packages/project-3/src/foo.ts'),
      );
    });

    it('resolves a `.mjs` file', () => {
      const host = createProjectReferencesCompilerHost(
        ['commonjs'],
        tsConfig.options,
        getDefinedArray(program.getResolvedProjectReferences()),
        sys,
      );

      const containingPath = getFixture(
        FIXTURE_NAME,
        'packages/project-3/src/index.ts',
      );

      const containingFile = host.getSourceFile(
        containingPath,
        ScriptTarget.ES2020,
      );

      assert(containingFile);

      const modules = host.resolveModuleNames?.(
        ['./index.mjs', './foo.mjs'],
        containingPath,
        undefined,
        undefined,
        tsConfig.options,
        containingFile,
      );

      expect(modules).toHaveLength(2);
      expect(modules?.[0]?.resolvedFileName).toBe(
        getFixture(FIXTURE_NAME, 'packages/project-3/src/index.ts'),
      );
      expect(modules?.[1]?.resolvedFileName).toBe(
        getFixture(FIXTURE_NAME, 'packages/project-3/src/foo.ts'),
      );
    });
  });
});
