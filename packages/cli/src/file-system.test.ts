import { getVirtualEnvironment, noOp } from '@ts-bridge/test-utils';
import { existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';

import {
  getCanonicalFileName,
  getNewFileName,
  getWriteFileFunction,
  readJsonFile,
  removeDirectory,
} from './file-system.js';

// TODO: Change these tests to use the real file system, to avoid the need for
// mocking the resolver.
vi.mock('@ts-bridge/resolver', () => ({
  resolve: vi.fn().mockImplementation(() => ({
    format: 'commonjs',
    path: '/fake.js',
  })),
}));

describe('removeDirectory', () => {
  const TEMPORARY_DIRECTORY = tmpdir();

  it('removes a directory', () => {
    const path = resolve(TEMPORARY_DIRECTORY, 'test-directory');
    mkdirSync(path, { recursive: true });

    expect(existsSync(path)).toBe(true);
    removeDirectory(
      resolve(TEMPORARY_DIRECTORY, 'test-directory'),
      TEMPORARY_DIRECTORY,
    );
    expect(existsSync(path)).toBe(false);
  });

  it('removes a directory with sub-directories', () => {
    const path = resolve(TEMPORARY_DIRECTORY, 'test-directory');
    mkdirSync(path, { recursive: true });
    mkdirSync(resolve(path, 'sub-directory'), { recursive: true });
    mkdirSync(resolve(path, 'sub-directory-2'), { recursive: true });
    mkdirSync(resolve(path, 'sub-directory-3'), { recursive: true });

    expect(existsSync(path)).toBe(true);
    removeDirectory(
      resolve(TEMPORARY_DIRECTORY, 'test-directory'),
      TEMPORARY_DIRECTORY,
    );
    expect(existsSync(path)).toBe(false);
  });

  it('throws an error if the directory is outside of the base directory', () => {
    const path = resolve(TEMPORARY_DIRECTORY, 'test-directory');
    mkdirSync(path, { recursive: true });

    expect(() =>
      removeDirectory(path, resolve(TEMPORARY_DIRECTORY, 'other-directory')),
    ).toThrowError('Cannot remove directory outside of the base directory.');

    expect(existsSync(path)).toBe(true);
  });
});

describe('getNewFileName', () => {
  it('changes the extension for source files', () => {
    expect(getNewFileName('test.js', '.mjs', '.d.mts')).toBe('test.mjs');
  });

  it('changes the extension for declaration files', () => {
    expect(getNewFileName('test.d.ts', '.mjs', '.d.mts')).toBe('test.d.mts');
  });

  it('changes the extension for declaration source map files', () => {
    expect(getNewFileName('test.d.ts.map', '.mjs', '.d.mts')).toBe(
      'test.d.mts.map',
    );
  });

  it('changes the extension for source map files', () => {
    expect(getNewFileName('test.js.map', '.mjs', '.d.mts')).toBe(
      'test.mjs.map',
    );
  });
});

describe('getWriteFileFunction', () => {
  it('returns a function that writes files to the file system', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
    });

    const writeFile = getWriteFileFunction('module', {}, system);
    writeFile('/foo.ts', 'console.log("Hello, world!");', false);

    expect(system.fileExists('/foo.ts')).toBe(true);
  });

  it('returns a function that writes files to the file system with the correct extension', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
    });

    const writeFile = getWriteFileFunction('module', {}, system);
    writeFile('/foo.js', 'console.log("Hello, world!");', false);

    expect(system.fileExists('/foo.mjs')).toBe(true);
  });

  it('returns a function that writes files to the file system with the correct extension for declaration files', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
    });

    const writeFile = getWriteFileFunction('module', {}, system);
    writeFile('/foo.d.ts', 'console.log("Hello, world!");', false);

    expect(system.fileExists('/foo.d.mts')).toBe(true);
  });

  it('returns a function that writes files to the file system with the correct extension for declaration source map files', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
    });

    const writeFile = getWriteFileFunction('module', {}, system);
    writeFile('/foo.d.ts.map', JSON.stringify({ file: '/index.js' }), false);

    expect(system.fileExists('/foo.d.mts.map')).toBe(true);
    expect(system.readFile('/foo.d.mts.map')).toMatchInlineSnapshot(
      `"{"file":"/index.d.mts"}"`,
    );
  });

  it('creates the directory if it does not exist', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
    });

    const writeFile = getWriteFileFunction(
      'module',
      {},
      {
        ...system,
        // The virtual file system does not have a `createDirectory` method, so we
        // need to add a no-op method to avoid an error.
        createDirectory: noOp,
      },
    );

    writeFile('/foo/bar/baz.ts', 'console.log("Hello, world!");', false);
    expect(system.fileExists('/foo/bar/baz.ts')).toBe(true);
  });

  it('transforms dynamic imports in declaration files before writing them to the file system', () => {
    const code = `
      /**
       * This function results in a case where TypeScript emits the declaration file
       * with a dynamic import.
       *
       * @returns A class that extends \`Foo\`.
       */
      export declare function bar(): {
          new (): {
              getFoo(): import("./dummy").Value;
          };
      };
      //# sourceMappingURL=declaration.d.ts.map
    `;

    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
    });

    const writeFile = getWriteFileFunction(
      'module',
      {
        rootDir: '/',
        outDir: '/dist',
      },
      system,
    );
    writeFile('/foo.d.ts', code, false);

    expect(system.fileExists('/foo.d.mts')).toBe(true);
    expect(system.readFile('/foo.d.mts')).toMatchInlineSnapshot(`
      "
            /**
             * This function results in a case where TypeScript emits the declaration file
             * with a dynamic import.
             *
             * @returns A class that extends \`Foo\`.
             */
            export declare function bar(): {
                new (): {
                    getFoo(): import("./dummy.mjs").Value;
                };
            };
            //# sourceMappingURL=declaration.d.ts.map
          "
    `);
  });
});

describe('readJsonFile', () => {
  it('returns the parsed JSON content of a file', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
        '/foo.json': '{"foo": "bar"}',
      },
    });

    expect(readJsonFile('/foo.json', system)).toEqual({ foo: 'bar' });
  });

  it('returns null if the file does not exist', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
    });

    expect(readJsonFile('/foo.json', system)).toBeNull();
  });

  it('returns null if the file is not valid JSON', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
        '/foo.json': 'invalid',
      },
    });

    expect(readJsonFile('/foo.json', system)).toBeNull();
  });

  it('returns null if the file is empty', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
        '/foo.json': '',
      },
    });

    expect(readJsonFile('/foo.json', system)).toBeNull();
  });
});

describe('getCanonicalFileName', () => {
  it('returns the canonical file name', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
    });

    expect(
      getCanonicalFileName('/FOO.ts', {
        ...system,
        useCaseSensitiveFileNames: false,
      }),
    ).toBe('/foo.ts');
  });

  it('returns the canonical file name when the file system is case-sensitive', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
    });

    expect(
      getCanonicalFileName('/FOO.ts', {
        ...system,
        useCaseSensitiveFileNames: true,
      }),
    ).toBe('/FOO.ts');
  });
});
