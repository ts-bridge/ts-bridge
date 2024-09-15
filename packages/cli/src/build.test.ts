import { getFixture, noOp, parseJson } from '@ts-bridge/test-utils';
import chalk from 'chalk';
import { join, relative } from 'path';
import type { System } from 'typescript';
import typescript from 'typescript';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { WorkerOptions } from 'worker_threads';

import type { BuildType } from './build-type.js';
import type { BuildHandlerOptions } from './build.js';
import { getFiles, buildHandler } from './build.js';
import { removeDirectory } from './file-system.js';

const { sys } = typescript;

beforeAll(() => {
  chalk.level = 0;
});

vi.mock('./file-system.js', async (importOriginal) => ({
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  ...(await importOriginal<typeof import('./file-system.js')>()),
  removeDirectory: vi.fn(),
}));

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
    const require = createRequire(filename);
    const { tsImport } = require('tsx/esm/api');

    tsImport(workerData.fileName, filename);
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

/**
 * Compile a TypeScript project.
 *
 * @param projectPath - The path to the project.
 * @param formats - The build formats.
 * @param options - Options to pass to the build handler.
 * @returns The compiled files.
 */
async function compile(
  projectPath: string,
  formats: BuildType[],
  options: Partial<BuildHandlerOptions> = {},
) {
  const files: Record<string, string> = {};

  const system: System = {
    ...sys,
    writeFile(
      path: string,
      data: string,
      writeByteOrderMark?: boolean | undefined,
    ) {
      files[relative(projectPath, path)] = data;
      sys.writeFile(path, data, writeByteOrderMark);
    },
  };

  await buildHandler({
    project: `${projectPath}/tsconfig.json`,
    format: formats,
    clean: false,
    system,
    ...options,
  });

  return files;
}

describe('build', () => {
  describe('node 10', () => {
    describe('when targeting `module`', () => {
      let files: Record<string, string>;

      beforeAll(async () => {
        files = await compile(getFixture('node-10'), ['module']);
      });

      it('outputs the files with the `.mjs` extension', () => {
        expect(Object.keys(files)).toStrictEqual([
          'dist/file-1.mjs.map',
          'dist/file-1.mjs',
          'dist/file-1.d.mts.map',
          'dist/file-1.d.mts',
          'dist/file-2.mjs.map',
          'dist/file-2.mjs',
          'dist/file-2.d.mts.map',
          'dist/file-2.d.mts',
          'dist/index.mjs.map',
          'dist/index.mjs',
          'dist/index.d.mts.map',
          'dist/index.d.mts',
        ]);
      });

      it('compiles the files with the correct format', () => {
        expect(files['dist/index.mjs']).toMatchInlineSnapshot(`
          "import { foo } from "./file-1.mjs";
          import { bar } from "./file-2.mjs";
          export { foo, bar };
          //# sourceMappingURL=index.mjs.map"
        `);
      });

      it('updates the source maps with the correct file path', () => {
        expect(files['dist/index.mjs']).toContain(
          '//# sourceMappingURL=index.mjs.map',
        );

        const sourceMap = parseJson(files['dist/index.mjs.map']);
        expect(sourceMap.file).toBe('index.mjs');
        expect(sourceMap.sources).toStrictEqual(['../src/index.ts']);

        expect(files['dist/index.d.mts']).toContain(
          '//# sourceMappingURL=index.d.mts.map',
        );

        const declarationSourceMap = parseJson(files['dist/index.d.mts.map']);
        expect(declarationSourceMap.file).toBe('index.d.mts');
        expect(declarationSourceMap.sources).toStrictEqual(['../src/index.ts']);
      });
    });

    describe('when targeting `commonjs`', () => {
      let files: Record<string, string>;

      beforeAll(async () => {
        files = await compile(getFixture('node-10'), ['commonjs']);
      });

      it('outputs the files with the `.cjs` extension', () => {
        expect(Object.keys(files)).toStrictEqual([
          'dist/file-1.cjs.map',
          'dist/file-1.cjs',
          'dist/file-1.d.cts.map',
          'dist/file-1.d.cts',
          'dist/file-2.cjs.map',
          'dist/file-2.cjs',
          'dist/file-2.d.cts.map',
          'dist/file-2.d.cts',
          'dist/index.cjs.map',
          'dist/index.cjs',
          'dist/index.d.cts.map',
          'dist/index.d.cts',
        ]);
      });

      it('compiles the files with the correct format', () => {
        expect(files['dist/index.cjs']).toMatchInlineSnapshot(`
          ""use strict";
          Object.defineProperty(exports, "__esModule", { value: true });
          exports.bar = exports.foo = void 0;
          const file_1_1 = require("./file-1.cjs");
          Object.defineProperty(exports, "foo", { enumerable: true, get: function () { return file_1_1.foo; } });
          const file_2_1 = require("./file-2.cjs");
          Object.defineProperty(exports, "bar", { enumerable: true, get: function () { return file_2_1.bar; } });
          //# sourceMappingURL=index.cjs.map"
        `);
      });

      it('updates the source maps with the correct file path', () => {
        expect(files['dist/index.cjs']).toContain(
          '//# sourceMappingURL=index.cjs.map',
        );

        const sourceMap = parseJson(files['dist/index.cjs.map']);
        expect(sourceMap.file).toBe('index.cjs');
        expect(sourceMap.sources).toStrictEqual(['../src/index.ts']);

        expect(files['dist/index.d.cts']).toContain(
          '//# sourceMappingURL=index.d.cts.map',
        );

        const declarationSourceMap = parseJson(files['dist/index.d.cts.map']);
        expect(declarationSourceMap.file).toBe('index.d.cts');
        expect(declarationSourceMap.sources).toStrictEqual(['../src/index.ts']);
      });
    });

    describe('when targeting both', () => {
      let files: Record<string, string>;

      beforeAll(async () => {
        files = await compile(getFixture('node-10'), ['commonjs', 'module']);
      });

      it('outputs the files with both the `.cjs` and `.mjs` extension', () => {
        expect(Object.keys(files)).toStrictEqual([
          'dist/file-1.mjs.map',
          'dist/file-1.mjs',
          'dist/file-1.d.mts.map',
          'dist/file-1.d.mts',
          'dist/file-2.mjs.map',
          'dist/file-2.mjs',
          'dist/file-2.d.mts.map',
          'dist/file-2.d.mts',
          'dist/index.mjs.map',
          'dist/index.mjs',
          'dist/index.d.mts.map',
          'dist/index.d.mts',
          'dist/file-1.cjs.map',
          'dist/file-1.cjs',
          'dist/file-1.d.cts.map',
          'dist/file-1.d.cts',
          'dist/file-2.cjs.map',
          'dist/file-2.cjs',
          'dist/file-2.d.cts.map',
          'dist/file-2.d.cts',
          'dist/index.cjs.map',
          'dist/index.cjs',
          'dist/index.d.cts.map',
          'dist/index.d.cts',
        ]);
      });
    });
  });

  describe('node 16', () => {
    describe('when targeting `module`', () => {
      let files: Record<string, string>;

      beforeAll(async () => {
        files = await compile(getFixture('node-16'), ['module']);
      });

      it('outputs the files with the `.mjs` extension', () => {
        expect(Object.keys(files)).toStrictEqual([
          'dist/file-1.mjs.map',
          'dist/file-1.mjs',
          'dist/file-1.d.mts.map',
          'dist/file-1.d.mts',
          'dist/file-2.mjs.map',
          'dist/file-2.mjs',
          'dist/file-2.d.mts.map',
          'dist/file-2.d.mts',
          'dist/index.mjs.map',
          'dist/index.mjs',
          'dist/index.d.mts.map',
          'dist/index.d.mts',
        ]);
      });

      it('compiles the files with the correct format', () => {
        expect(files['dist/index.mjs']).toMatchInlineSnapshot(`
          "import { foo } from "./file-1.mjs";
          import { bar } from "./file-2.mjs";
          export { foo, bar };
          //# sourceMappingURL=index.mjs.map"
        `);
      });

      it('updates the source maps with the correct file path', () => {
        expect(files['dist/index.mjs']).toContain(
          '//# sourceMappingURL=index.mjs.map',
        );

        const sourceMap = parseJson(files['dist/index.mjs.map']);
        expect(sourceMap.file).toBe('index.mjs');
        expect(sourceMap.sources).toStrictEqual(['../src/index.ts']);

        expect(files['dist/index.d.mts']).toContain(
          '//# sourceMappingURL=index.d.mts.map',
        );

        const declarationSourceMap = parseJson(files['dist/index.d.mts.map']);
        expect(declarationSourceMap.file).toBe('index.d.mts');
        expect(declarationSourceMap.sources).toStrictEqual(['../src/index.ts']);
      });
    });

    describe('when targeting `commonjs`', () => {
      let files: Record<string, string>;

      beforeAll(async () => {
        files = await compile(getFixture('node-16'), ['commonjs']);
      });

      it('outputs the files with the `.cjs` extension', () => {
        expect(Object.keys(files)).toStrictEqual([
          'dist/file-1.cjs.map',
          'dist/file-1.cjs',
          'dist/file-1.d.cts.map',
          'dist/file-1.d.cts',
          'dist/file-2.cjs.map',
          'dist/file-2.cjs',
          'dist/file-2.d.cts.map',
          'dist/file-2.d.cts',
          'dist/index.cjs.map',
          'dist/index.cjs',
          'dist/index.d.cts.map',
          'dist/index.d.cts',
        ]);
      });

      it('compiles the files with the correct format', () => {
        expect(files['dist/index.cjs']).toMatchInlineSnapshot(`
          ""use strict";
          Object.defineProperty(exports, "__esModule", { value: true });
          exports.bar = exports.foo = void 0;
          const file_1_1 = require("./file-1.cjs");
          Object.defineProperty(exports, "foo", { enumerable: true, get: function () { return file_1_1.foo; } });
          const file_2_1 = require("./file-2.cjs");
          Object.defineProperty(exports, "bar", { enumerable: true, get: function () { return file_2_1.bar; } });
          //# sourceMappingURL=index.cjs.map"
        `);
      });

      it('updates the source maps with the correct file path', () => {
        expect(files['dist/index.cjs']).toContain(
          '//# sourceMappingURL=index.cjs.map',
        );

        const sourceMap = parseJson(files['dist/index.cjs.map']);
        expect(sourceMap.file).toBe('index.cjs');
        expect(sourceMap.sources).toStrictEqual(['../src/index.ts']);

        expect(files['dist/index.d.cts']).toContain(
          '//# sourceMappingURL=index.d.cts.map',
        );

        const declarationSourceMap = parseJson(files['dist/index.d.cts.map']);
        expect(declarationSourceMap.file).toBe('index.d.cts');
        expect(declarationSourceMap.sources).toStrictEqual(['../src/index.ts']);
      });
    });

    describe('when targeting both', () => {
      let files: Record<string, string>;

      beforeAll(async () => {
        files = await compile(getFixture('node-16'), ['commonjs', 'module']);
      });

      it('outputs the files with both the `.cjs` and `.mjs` extension', () => {
        expect(Object.keys(files)).toStrictEqual([
          'dist/file-1.mjs.map',
          'dist/file-1.mjs',
          'dist/file-1.d.mts.map',
          'dist/file-1.d.mts',
          'dist/file-2.mjs.map',
          'dist/file-2.mjs',
          'dist/file-2.d.mts.map',
          'dist/file-2.d.mts',
          'dist/index.mjs.map',
          'dist/index.mjs',
          'dist/index.d.mts.map',
          'dist/index.d.mts',
          'dist/file-1.cjs.map',
          'dist/file-1.cjs',
          'dist/file-1.d.cts.map',
          'dist/file-1.d.cts',
          'dist/file-2.cjs.map',
          'dist/file-2.cjs',
          'dist/file-2.d.cts.map',
          'dist/file-2.d.cts',
          'dist/index.cjs.map',
          'dist/index.cjs',
          'dist/index.d.cts.map',
          'dist/index.d.cts',
        ]);
      });
    });
  });

  describe('project references', () => {
    describe('node 10', () => {
      vi.spyOn(console, 'log').mockImplementation(noOp);

      it('builds all projects and logs the project references', async () => {
        await expect(
          compile(
            getFixture('project-references-node-10'),
            ['commonjs', 'module'],
            {
              references: true,
              verbose: true,
            },
          ),
        ).resolves.not.toThrow();
      });
    });

    describe('node 16', () => {
      vi.spyOn(console, 'log').mockImplementation(noOp);

      it('builds all projects and logs the project references', async () => {
        await expect(
          compile(
            getFixture('project-references-node-16'),
            ['commonjs', 'module'],
            {
              references: true,
              verbose: true,
            },
          ),
        ).resolves.not.toThrow();
      });
    });

    it('removes the output directory of all referenced projects if `clean` is enabled', async () => {
      const path = getFixture('project-references-node-16');
      const dist = join(path, 'dist');

      await compile(
        getFixture('project-references-node-16'),
        ['commonjs', 'module'],
        {
          references: true,
          clean: true,
        },
      );

      // TODO: Test that the output directories of referenced projects are
      // removed as well. This is complicated because references are built in
      // a worker thread.
      expect(vi.mocked(removeDirectory)).toHaveBeenCalledWith(dist, path);
    });
  });

  it('removes the output directory if `clean` is enabled', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(noOp);
    const path = getFixture('node-16');
    const dist = join(path, 'dist');

    await compile(path, ['module'], {
      clean: true,
      verbose: true,
    });

    expect(vi.mocked(removeDirectory)).toHaveBeenCalledWith(dist, path);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Cleaning output directory'),
    );
  });

  it('throws an error if the project fails to initialise', async () => {
    await expect(compile(getFixture('invalid'), ['module'])).rejects.toThrow(
      'Failed to initialise the project.',
    );
  });

  it('logs an error if the project fails to build', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(noOp);
    const system: System = {
      ...sys,
      writeFile() {
        throw new Error('Failed to write file.');
      },
    };

    await buildHandler({
      // ESLint doesn't seem to be able to infer the type of `getFixture` here.
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      project: `${getFixture('node-16')}/tsconfig.json`,
      format: ['module'],
      clean: false,
      system,
    });

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write file.'),
    );
  });
});

describe('getFiles', () => {
  it('returns the files from the `tsconfig.json` if custom files is empty', () => {
    const files = getFiles([], ['foo', 'bar']);

    expect(files).toStrictEqual(['foo', 'bar']);
  });

  it('returns the files from the `tsconfig.json` if custom files is undefined', () => {
    const files = getFiles(undefined, ['foo', 'bar']);

    expect(files).toStrictEqual(['foo', 'bar']);
  });

  it('returns the custom files', () => {
    const files = getFiles(['baz'], ['foo', 'bar']);

    expect(files).toStrictEqual(['baz']);
  });
});
