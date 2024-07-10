import { getFixture, noOp, parseJson } from '@ts-bridge/test-utils';
import { join, relative } from 'path';
import type { System } from 'typescript';
import typescript from 'typescript';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { BuildType } from './build-type.js';
import type { BuildHandlerOptions } from './build.js';
import { getFiles, getTransformers, buildHandler } from './build.js';
import { removeDirectory } from './file-system.js';

const { sys } = typescript;

vi.mock('./shims.js', async (importOriginal) => ({
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  ...(await importOriginal<typeof import('./shims.js')>()),
  isShimsPackageInstalled: vi.fn(() => true),
}));

vi.mock('./file-system.js', async (importOriginal) => ({
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  ...(await importOriginal<typeof import('./file-system.js')>()),
  removeDirectory: vi.fn(),
}));

/**
 * Compile a TypeScript project.
 *
 * @param projectPath - The path to the project.
 * @param formats - The build formats.
 * @param options - Options to pass to the build handler.
 * @returns The compiled files.
 */
function compile(
  projectPath: string,
  formats: BuildType[],
  options: Partial<BuildHandlerOptions> = {},
) {
  const files: Record<string, string> = {};

  const system: System = {
    ...sys,
    writeFile(path: string, data: string) {
      files[relative(projectPath, path)] = data;
    },
  };

  buildHandler({
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

      beforeAll(() => {
        files = compile(getFixture('node-10'), ['module']);
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

      beforeAll(() => {
        files = compile(getFixture('node-10'), ['commonjs']);
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

      beforeAll(() => {
        files = compile(getFixture('node-10'), ['commonjs', 'module']);
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

      beforeAll(() => {
        files = compile(getFixture('node-16'), ['module']);
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

      beforeAll(() => {
        files = compile(getFixture('node-16'), ['commonjs']);
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

      beforeAll(() => {
        files = compile(getFixture('node-16'), ['commonjs', 'module']);
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

  it('removes the output directory if `clean` is enabled', () => {
    const path = getFixture('node-16');
    const dist = join(path, 'dist');

    compile(path, ['module'], {
      clean: true,
    });

    expect(vi.mocked(removeDirectory)).toHaveBeenCalledWith(dist, path);
  });

  it('throws an error if the project fails to initialise', () => {
    expect(() => compile(getFixture('invalid'), ['module'])).toThrow(
      'Failed to initialise the project.',
    );
  });

  it('logs an error if the project fails to build', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(noOp);
    const system: System = {
      ...sys,
      writeFile() {
        throw new Error('Failed to write file.');
      },
    };

    buildHandler({
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

describe('getTransformers', () => {
  it('returns the correct transformers for the `module` format', () => {
    const transformers = getTransformers(
      'module',
      {
        system: sys,
        // @ts-expect-error - The `typeChecker` parameter is invalid.
        typeChecker: {},
        baseDirectory: '/',
      },
      true,
    );

    expect(transformers).toHaveLength(4);
  });

  it('returns the correct transformers for the `commonjs` format', () => {
    const transformers = getTransformers(
      'commonjs',
      {
        system: sys,
        // @ts-expect-error - The `typeChecker` parameter is invalid.
        typeChecker: {},
        baseDirectory: '/',
      },
      true,
    );

    expect(transformers).toHaveLength(2);
  });

  it('returns the correct transformers for the `module` format without shims', () => {
    const transformers = getTransformers(
      'module',
      {
        system: sys,
        // @ts-expect-error - The `typeChecker` parameter is invalid.
        typeChecker: {},
        baseDirectory: '/',
      },
      false,
    );

    expect(transformers).toHaveLength(2);
  });

  it('returns the correct transformers for the `commonjs` format without shims', () => {
    const transformers = getTransformers(
      'commonjs',
      {
        system: sys,
        // @ts-expect-error - The `typeChecker` parameter is invalid.
        typeChecker: {},
        baseDirectory: '/',
      },
      false,
    );

    expect(transformers).toHaveLength(1);
  });
});
