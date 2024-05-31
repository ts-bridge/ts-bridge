import { getFileSystem, getPathFromRoot } from '@ts-bridge/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { comparePatternKeys, resolve } from './resolver.js';
import { isFlagEnabled } from './utils.js';

vi.mock('./utils.js', async (importOriginal) => {
  return {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    ...(await importOriginal<typeof import('./utils.js')>()),
    isFlagEnabled: vi.fn().mockReturnValue(false),
  };
});

describe('resolve', () => {
  describe('`file:` URLs', () => {
    it('resolves a file URL', () => {
      const fileSystem = getFileSystem({
        '/path/to/file.js': 'console.log("hello!");',
      });

      expect(
        resolve('file:///path/to/file.js', import.meta.url, fileSystem, false),
      ).toStrictEqual({
        path: '/path/to/file.js',
        format: 'commonjs',
      });
    });

    it('resolves a CommonJS file', () => {
      const fileSystem = getFileSystem({
        '/path/to/file.cjs': 'console.log("hello!");',
      });

      expect(
        resolve('file:///path/to/file.cjs', import.meta.url, fileSystem, false),
      ).toStrictEqual({
        path: '/path/to/file.cjs',
        format: 'commonjs',
      });
    });

    it('resolves a ES module file', () => {
      const fileSystem = getFileSystem({
        '/path/to/file.mjs': 'console.log("hello!");',
      });

      expect(
        resolve('file:///path/to/file.mjs', import.meta.url, fileSystem, false),
      ).toStrictEqual({
        path: '/path/to/file.mjs',
        format: 'module',
      });
    });

    it('resolves a JSON module file', () => {
      const fileSystem = getFileSystem({
        '/path/to/file.json': '{"hello": "world"}',
      });

      expect(
        resolve(
          'file:///path/to/file.json',
          import.meta.url,
          fileSystem,
          false,
        ),
      ).toStrictEqual({
        path: '/path/to/file.json',
        format: 'json',
      });
    });

    it('resolves a WASM module file if `--experimental-wasm-modules` is enabled', () => {
      vi.mocked(isFlagEnabled).mockReturnValue(true);

      const fileSystem = getFileSystem({
        '/path/to/file.wasm': 'wasm code',
      });

      expect(
        resolve(
          'file:///path/to/file.wasm',
          import.meta.url,
          fileSystem,
          false,
        ),
      ).toStrictEqual({
        path: '/path/to/file.wasm',
        format: 'wasm',
      });

      vi.mocked(isFlagEnabled).mockReturnValue(false);
    });

    it('resolves a WASM module file if `--experimental-wasm-modules` is enabled, the file does not have an extension, and the file starts with the WASM magic bytes', () => {
      vi.mocked(isFlagEnabled).mockReturnValue(true);

      const fileSystem = getFileSystem({
        '/path/to/file': new Uint8Array([0x00, 0x61, 0x73, 0x6d]),
      });

      expect(
        resolve('file:///path/to/file', import.meta.url, fileSystem, false),
      ).toStrictEqual({
        path: '/path/to/file',
        format: 'wasm',
      });

      vi.mocked(isFlagEnabled).mockReturnValue(false);
    });

    it('does not resolve a WASM module file if `--experimental-wasm-modules` is disabled', () => {
      vi.mocked(isFlagEnabled).mockReturnValue(false);

      const fileSystem = getFileSystem({
        '/path/to/file.wasm': 'wasm code',
      });

      expect(
        resolve(
          'file:///path/to/file.wasm',
          import.meta.url,
          fileSystem,
          false,
        ),
      ).toStrictEqual({
        path: '/path/to/file.wasm',
        format: null,
      });
    });

    it('does not resolve a WASM module file if `--experimental-wasm-modules` is enabled, the file does not have an extension, and the file does not start with the WASM magic bytes', () => {
      vi.mocked(isFlagEnabled).mockReturnValue(true);

      const fileSystem = getFileSystem({
        '/path/to/file': new Uint8Array([0x00, 0x01, 0x02, 0x03]),
        '/path/to/package.json': JSON.stringify({
          type: 'module',
        }),
      });

      expect(
        resolve('file:///path/to/file', import.meta.url, fileSystem, false),
      ).toStrictEqual({
        path: '/path/to/file',
        format: 'module',
      });

      vi.mocked(isFlagEnabled).mockReturnValue(false);
    });

    it('does not resolve a WASM module file if `--experimental-wasm-modules` is disabled, and the file does not have an extension', () => {
      vi.mocked(isFlagEnabled).mockReturnValue(false);

      const fileSystem = getFileSystem({
        '/path/to/file': new Uint8Array([0x00, 0x01, 0x02, 0x03]),
        '/path/to/package.json': JSON.stringify({
          type: 'module',
        }),
      });

      expect(
        resolve('file:///path/to/file', import.meta.url, fileSystem, false),
      ).toStrictEqual({
        path: '/path/to/file',
        format: 'module',
      });

      vi.mocked(isFlagEnabled).mockReturnValue(false);
    });

    it('does not resolve a WASM module file if `--experimental-wasm-modules` is disabled, and the file does not have an extension, and there is no `package.json`', () => {
      vi.mocked(isFlagEnabled).mockReturnValue(false);

      const fileSystem = getFileSystem({
        '/path/to/file': new Uint8Array([0x00, 0x01, 0x02, 0x03]),
      });

      expect(
        resolve('file:///path/to/file', import.meta.url, fileSystem, false),
      ).toStrictEqual({
        path: '/path/to/file',
        format: null,
      });

      vi.mocked(isFlagEnabled).mockReturnValue(false);
    });

    it('throws an error if the file is a directory', () => {
      const fileSystem = getFileSystem({
        '/path/to/directory': { type: 'directory' },
      });

      expect(() =>
        resolve(
          'file:///path/to/directory',
          import.meta.url,
          fileSystem,
          false,
        ),
      ).toThrow(
        'The resolved path corresponds to a directory, which is not a supported target for module imports: "file:///path/to/directory".',
      );
    });

    it('throws an error if the file does not exist', () => {
      const fileSystem = getFileSystem();

      expect(() =>
        resolve(
          'file:///path/to/missing.js',
          import.meta.url,
          fileSystem,
          false,
        ),
      ).toThrow(
        'The package or module requested does not exist: "file:///path/to/missing.js".',
      );
    });
  });

  describe('`node:` URLs', () => {
    it('resolves a builtin module', () => {
      expect(resolve('node:fs', import.meta.url)).toStrictEqual({
        path: 'node:fs',
        format: 'builtin',
      });
    });

    it('resolves a builtin module without the `node:` prefix', () => {
      expect(resolve('path', import.meta.url)).toStrictEqual({
        path: 'node:path',
        format: 'builtin',
      });
    });
  });

  describe('`data:` URLs', () => {
    it('resolves a JavaScript module', () => {
      expect(
        resolve('data:text/javascript,console.log("hello!");', import.meta.url),
      ).toStrictEqual({
        path: 'data:text/javascript,console.log("hello!");',
        format: 'module',
      });
    });

    it('resolves a JSON module', () => {
      expect(
        resolve('data:application/json,"world!"', import.meta.url),
      ).toStrictEqual({
        path: 'data:application/json,"world!"',
        format: 'json',
      });
    });

    it('resolves a WebAssembly module', () => {
      expect(
        resolve(
          'data:application/wasm,base64,AGFzbQEAAAABCAJgAn9/AX8DAgA=',
          import.meta.url,
        ),
      ).toStrictEqual({
        path: 'data:application/wasm,base64,AGFzbQEAAAABCAJgAn9/AX8DAgA=',
        format: 'wasm',
      });
    });
  });

  describe('`http:` URLs', () => {
    it('returns `null` as format', () => {
      expect(
        resolve('http://example.com/file.js', import.meta.url),
      ).toStrictEqual({
        path: 'http://example.com/file.js',
        format: null,
      });
    });
  });

  describe('file paths', () => {
    it('resolves a relative path', () => {
      const fileSystem = getFileSystem({
        '/path/to/directory/file.js': 'console.log("hello!");',
      });

      expect(
        resolve('./file.js', 'file:///path/to/directory/', fileSystem, false),
      ).toStrictEqual({
        path: '/path/to/directory/file.js',
        format: 'commonjs',
      });
    });

    it('resolves an absolute path', () => {
      const fileSystem = getFileSystem({
        '/file.js': 'console.log("hello!");',
      });

      expect(
        resolve('/file.js', 'file:///path/to/directory/', fileSystem, false),
      ).toStrictEqual({
        path: '/file.js',
        format: 'commonjs',
      });
    });

    it('throws an error if the file is a directory', () => {
      const fileSystem = getFileSystem({
        '/path/to/directory': { type: 'directory' },
      });

      expect(() =>
        resolve(
          '/path/to/directory',
          'file:///path/to/directory/',
          fileSystem,
          false,
        ),
      ).toThrow(
        'The resolved path corresponds to a directory, which is not a supported target for module imports: "file:///path/to/directory".',
      );
    });

    it('throws an error if the file does not exist', () => {
      const fileSystem = getFileSystem();

      expect(() =>
        resolve(
          '/path/to/missing.js',
          'file:///path/to/directory/',
          fileSystem,
        ),
      ).toThrow(
        'The package or module requested does not exist: "file:///path/to/missing.js".',
      );
    });
  });

  describe('imports', () => {
    it('resolves an import', () => {
      const fileSystem = getFileSystem({
        '/foo/module.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          imports: {
            '#module': './module.js',
          },
        }),
      });

      expect(
        resolve('#module', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/module.js',
        format: 'commonjs',
      });
    });

    it('resolves an import not starting with `./`', () => {
      const fileSystem = getFileSystem({
        '/foo/module.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          imports: {
            '#module': 'fs',
          },
        }),
      });

      expect(
        resolve('#module', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: 'node:fs',
        format: 'builtin',
      });
    });

    it('resolves a wildcard import', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          imports: {
            '#foo/*': './*.js',
          },
        }),
      });

      expect(
        resolve('#foo/bar', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/bar.js',
        format: 'commonjs',
      });
    });

    it('resolves a wildcard import for an import not starting with `./`', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          imports: {
            '#foo/*': '*',
          },
        }),
      });

      expect(
        resolve('#foo/fs', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: 'node:fs',
        format: 'builtin',
      });
    });

    it('throws an error if the import is "#"', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          imports: {
            '#': './bar.js',
          },
        }),
      });

      expect(() =>
        resolve('#', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'Module specifier is an invalid URL, package name or package subpath specifier: "#".',
      );
    });

    it('throws an error if the import starts with "#/"', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          imports: {
            '#/foo': './bar.js',
          },
        }),
      });

      expect(() =>
        resolve('#/foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'Module specifier is an invalid URL, package name or package subpath specifier: "#/foo".',
      );
    });

    it('throws an error if the import does not exist', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          imports: {
            '#foo/*': './*.js',
          },
        }),
      });

      expect(() =>
        resolve('#bar', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow('Package imports do not define the specifier: "#bar".');
    });

    it('throws an error if the referenced file does not exist', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          imports: {
            '#foo/*': './*.js',
          },
        }),
      });

      expect(() =>
        resolve('#foo/baz', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'The package or module requested does not exist: "file:///foo/baz.js".',
      );
    });

    it('throws an error if there is no `package.json`', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
      });

      expect(() =>
        resolve('#foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow('Package imports do not define the specifier: "#foo".');
    });

    it('throws an error if the imports in `package.json` is not an object', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          imports: ['#foo'],
        }),
      });

      expect(() =>
        resolve('#foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow('Package imports do not define the specifier: "#foo".');
    });

    it.each(['../', '/'])(
      'throws an error if the import starts with `%s`',
      (segment) => {
        const fileSystem = getFileSystem({
          '/foo/bar.js': 'console.log("hello!");',
          '/foo/package.json': JSON.stringify({
            imports: {
              '#foo': `${segment}foo.js`,
            },
          }),
        });

        expect(() =>
          resolve('#foo', 'file:///foo/bar.js', fileSystem, false),
        ).toThrow(
          `Package exports or imports define a target module for the package that is an invalid type or string target: "${segment}foo.js".`,
        );
      },
    );

    it('throws an error if the import is a valid URL', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          imports: {
            '#foo': 'file:///foo.js',
          },
        }),
      });

      expect(() =>
        resolve('#foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'Package exports or imports define a target module for the package that is an invalid type or string target: "file:///foo.js".',
      );
    });

    it.each(['', '.', '..', 'node_modules'])(
      'throws an error if the import contains a "%s" segment after the first "."',
      (segment) => {
        const fileSystem = getFileSystem({
          '/foo/bar.js': 'console.log("hello!");',
          '/foo/package.json': JSON.stringify({
            name: 'foo',
            imports: {
              '#foo': `./${segment}/bar.js`,
            },
          }),
        });

        expect(() =>
          resolve('#foo', 'file:///foo/bar.js', fileSystem, false),
        ).toThrow(
          `Package exports or imports define a target module for the package that is an invalid type or string target: "./${segment}/bar.js".`,
        );
      },
    );

    it.each(['', '.', '..', 'node_modules'])(
      'throws an error if the import pattern contains a "%s" segment after the first "."',
      (segment) => {
        const fileSystem = getFileSystem({
          '/foo/bar.js': 'console.log("hello!");',
          '/foo/package.json': JSON.stringify({
            name: 'foo',
            imports: {
              '#foo/*': `./*/bar.js`,
            },
          }),
        });

        expect(() =>
          resolve(
            `#foo/${segment}/bar.js`,
            'file:///foo/bar.js',
            fileSystem,
            false,
          ),
        ).toThrow(
          `Module specifier is an invalid URL, package name or package subpath specifier: "${segment}/bar.js".`,
        );
      },
    );
  });

  describe('exports', () => {
    it('resolves an object export', () => {
      const fileSystem = getFileSystem({
        '/foo/module.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: {
            '.': './module.js',
          },
        }),
      });

      expect(
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/module.js',
        format: 'commonjs',
      });
    });

    it('resolves an object export with a previous condition not resolving', () => {
      const fileSystem = getFileSystem({
        '/foo/module.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: {
            '.': {
              default: null,
              node: './module.js',
            },
          },
        }),
      });

      expect(
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/module.js',
        format: 'commonjs',
      });
    });

    it('resolves a wildcard object export', () => {
      const fileSystem = getFileSystem({
        '/foo/dist/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: {
            './*': './dist/*.js',
          },
        }),
      });

      expect(
        resolve('foo/bar', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/dist/bar.js',
        format: 'commonjs',
      });
    });

    it('resolves a wildcard object export with a pattern trailer', () => {
      const fileSystem = getFileSystem({
        '/foo/dist/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: {
            './*/trailer': './dist/*.js',
          },
        }),
      });

      expect(
        resolve('foo/bar/trailer', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/dist/bar.js',
        format: 'commonjs',
      });
    });

    it('resolves an object export with multiple wildcards', () => {
      const fileSystem = getFileSystem({
        '/foo/dist/bar.js': 'console.log("hello!");',
        '/foo/dist/baz.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: {
            './*/baz': './dist/*/baz.js',
            './*': './dist/*.js',
          },
        }),
      });

      expect(
        resolve('foo/bar', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/dist/bar.js',
        format: 'commonjs',
      });
    });

    it('resolves an object export with multiple wildcards in order of specificity', () => {
      const fileSystem = getFileSystem({
        '/foo/dist/bar.js': 'console.log("hello!");',
        '/foo/dist/bar/baz.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: {
            './*': './dist/*.js',
            './specific/*': './dist/*/baz.js',
          },
        }),
      });

      expect(
        resolve('foo/specific/bar', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/dist/bar/baz.js',
        format: 'commonjs',
      });
    });

    it('resolves an object export with multiple wildcards and non-wildcards in order of specificity', () => {
      const fileSystem = getFileSystem({
        '/foo/dist/b.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: {
            './*': './dist/*.js',
            './a/*': './dist/a.js',
            './a/b': './dist/b.js',
          },
        }),
      });

      expect(
        resolve('foo/a/b', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/dist/b.js',
        format: 'commonjs',
      });
    });

    it('resolves a string export', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: './bar.js',
        }),
      });

      expect(
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/bar.js',
        format: 'commonjs',
      });
    });

    it('resolves an array export', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: ['./bar.js', './baz.js'],
        }),
      });

      expect(
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/bar.js',
        format: 'commonjs',
      });
    });

    it('resolves an array export with an invalid target', () => {
      const fileSystem = getFileSystem({
        '/foo/baz.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: [0, './baz.js'],
        }),
      });

      expect(
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/baz.js',
        format: 'commonjs',
      });
    });

    it('throws an error if the export does not exist', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: {
            '.': './dist/*.js',
          },
        }),
      });

      expect(() =>
        resolve('foo/baz', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'Package exports do not define or permit a target subpath in the package for the given module: "./baz".',
      );
    });

    it('throws an error if the referenced file does not exist', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          exports: {
            './*': './*.js',
          },
        }),
      });

      expect(() =>
        resolve('foo/baz', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow('The package or module requested does not exist: "foo/baz".');
    });

    it('throws an error if a string export does not start with `./`', () => {
      const fileSystem = getFileSystem({
        '/foo/bar.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: 'bar.js',
        }),
      });

      expect(() =>
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'Package exports or imports define a target module for the package that is an invalid type or string target: "bar.js".',
      );
    });

    it.each(['', '.', '..', 'node_modules'])(
      'throws an error if a string export contains a "%s" segment after the first "."',
      (segment) => {
        const fileSystem = getFileSystem({
          '/foo/bar.js': 'console.log("hello!");',
          '/foo/package.json': JSON.stringify({
            name: 'foo',
            exports: `./${segment}/bar.js`,
          }),
        });

        expect(() =>
          resolve('foo', 'file:///foo/bar.js', fileSystem, false),
        ).toThrow(
          `Package exports or imports define a target module for the package that is an invalid type or string target: "./${segment}/bar.js".`,
        );
      },
    );

    it('throws an error if all targets in an array are invalid', () => {
      const fileSystem = getFileSystem({
        '/foo/baz.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: [0, 1],
        }),
      });

      expect(() =>
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'Package exports or imports define a target module for the package that is an invalid type or string target: "/foo".',
      );
    });

    it('throws an error if all targets in an array are invalid', () => {
      const fileSystem = getFileSystem({
        '/foo/baz.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: [0, 1],
        }),
      });

      expect(() =>
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'Package exports or imports define a target module for the package that is an invalid type or string target: "/foo".',
      );
    });

    it('throws an error if no target in an array resolves', () => {
      const fileSystem = getFileSystem({
        '/foo/baz.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: [null],
        }),
      });

      expect(() =>
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'Package exports do not define or permit a target subpath in the package for the given module: ".".',
      );
    });

    it('throws an error if the array is empty', () => {
      const fileSystem = getFileSystem({
        '/foo/baz.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: [],
        }),
      });

      expect(() =>
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'Package exports do not define or permit a target subpath in the package for the given module: ".".',
      );
    });

    it('throws an error if the conditions in an object are not met', () => {
      const fileSystem = getFileSystem({
        '/foo/baz.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: {
            '.': {
              browser: './bar.js',
            },
          },
        }),
      });

      expect(() =>
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'Package exports do not define or permit a target subpath in the package for the given module: ".".',
      );
    });

    it('throws an error if the package does not export "."', () => {
      const fileSystem = getFileSystem({
        '/foo/baz.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: {
            './bar': {
              browser: './bar.js',
            },
          },
        }),
      });

      expect(() =>
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'Package exports do not define or permit a target subpath in the package for the given module: ".".',
      );
    });

    it('throws an error if the package does not have relative exports', () => {
      const fileSystem = getFileSystem({
        '/foo/baz.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: {
            bar: {
              browser: './bar.js',
            },
          },
        }),
      });

      expect(() =>
        resolve('foo/bar', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow(
        'Package exports do not define or permit a target subpath in the package for the given module: "./bar".',
      );
    });
  });

  describe('externals', () => {
    it('resolves an external ES module package', () => {
      expect(resolve('vite', import.meta.url)).toStrictEqual({
        path: getPathFromRoot('node_modules/vite/dist/node/index.js'),
        format: 'module',
      });
    });

    it('resolves an external ES module with a subpath', () => {
      expect(resolve('vite/runtime', import.meta.url)).toStrictEqual({
        path: getPathFromRoot('node_modules/vite/dist/node/runtime.js'),
        format: 'module',
      });
    });

    it('resolves an external ES module with a wildcard export', () => {
      expect(
        resolve('vite/dist/client/env.mjs', import.meta.url),
      ).toStrictEqual({
        path: getPathFromRoot('node_modules/vite/dist/client/env.mjs'),
        format: 'module',
      });
    });

    it('resolves an external CommonJS package', () => {
      expect(resolve('typescript', import.meta.url)).toStrictEqual({
        path: getPathFromRoot('node_modules/typescript/lib/typescript.js'),
        format: 'commonjs',
      });
    });

    it('resolves an external JSON module', () => {
      expect(resolve('vite/package.json', import.meta.url)).toStrictEqual({
        path: getPathFromRoot('node_modules/vite/package.json'),
        format: 'json',
      });
    });

    it('resolves an external scoped ES module package', () => {
      expect(resolve('@scure/base', import.meta.url)).toStrictEqual({
        path: getPathFromRoot('node_modules/@scure/base/lib/esm/index.js'),
        format: 'module',
      });
    });

    it('resolves an external scoped CommonJS package', () => {
      expect(resolve('@babel/core', import.meta.url)).toStrictEqual({
        path: getPathFromRoot('node_modules/@babel/core/lib/index.js'),
        format: 'commonjs',
      });
    });

    it('resolves an external scoped JSON module', () => {
      expect(
        resolve('@typescript/vfs/package.json', import.meta.url),
      ).toStrictEqual({
        path: getPathFromRoot('node_modules/@typescript/vfs/package.json'),
        format: 'json',
      });
    });

    it('does not resolve an external package without a `package.json`', () => {
      const fileSystem = getFileSystem({
        '/foo/node_modules/bar': { type: 'directory' },
        '/foo/node_modules/bar/index.js': 'console.log("hello!");',
        '/foo/node_modules/bar/package.json': JSON.stringify({
          name: 'bar',
          main: 'index.js',
        }),
        '/foo/bar/node_modules/bar': { type: 'directory' },
        '/foo/bar/node_modules/bar/index.js': 'console.log("hello!");',
      });

      expect(
        resolve('bar', 'file:///foo/bar/baz.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/node_modules/bar/index.js',
        format: 'commonjs',
      });
    });

    it('throws an error if the package specifier is empty', () => {
      expect(() => resolve('', import.meta.url)).toThrow(
        'Module specifier is an invalid URL, package name or package subpath specifier: "".',
      );
    });

    it('throws an error if the package specifier contains a backslash', () => {
      expect(() => resolve('vite\\runtime', import.meta.url)).toThrow(
        'Module specifier is an invalid URL, package name or package subpath specifier: "vite\\runtime".',
      );
    });

    it('throws an error if the package specifier contains a percent symbol', () => {
      expect(() => resolve('vite%runtime', import.meta.url)).toThrow(
        'Module specifier is an invalid URL, package name or package subpath specifier: "vite%runtime".',
      );
    });

    it('throws an error if the package specifier subpath ends with a slash', () => {
      expect(() => resolve('vite/runtime/', import.meta.url)).toThrow(
        'Module specifier is an invalid URL, package name or package subpath specifier: "vite/runtime/".',
      );
    });

    it('throws an error if the package does not exist', () => {
      expect(() => resolve('missing-package', import.meta.url)).toThrow(
        'The package or module requested does not exist: "missing-package".',
      );
    });

    it('throws if the package specifier contains an `@` symbol, but does not have a slash', () => {
      expect(() => resolve('@foo', import.meta.url)).toThrow(
        'Module specifier is an invalid URL, package name or package subpath specifier: "@foo".',
      );
    });
  });

  describe('self', () => {
    it('resolves the current module by the `package.json` name', () => {
      const fileSystem = getFileSystem({
        '/foo/module.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
          exports: {
            '.': './module.js',
          },
        }),
      });

      expect(
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toStrictEqual({
        path: '/foo/module.js',
        format: 'commonjs',
      });
    });

    it('throws an error if the `package.json` name does not match', () => {
      const fileSystem = getFileSystem({
        '/foo/module.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'bar',
          exports: {
            '.': './module.js',
          },
        }),
      });

      expect(() =>
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow('The package or module requested does not exist: "foo".');
    });

    it('throws an error if no `package.json` was found', () => {
      const fileSystem = getFileSystem({
        '/foo/module.js': 'console.log("hello!");',
      });

      expect(() =>
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow('The package or module requested does not exist: "foo".');
    });

    it('throws an error if `package.json` does not contain exports', () => {
      const fileSystem = getFileSystem({
        '/foo/module.js': 'console.log("hello!");',
        '/foo/package.json': JSON.stringify({
          name: 'foo',
        }),
      });

      expect(() =>
        resolve('foo', 'file:///foo/bar.js', fileSystem, false),
      ).toThrow('The package or module requested does not exist: "foo".');
    });

    it('throws an error if the current directory is "node_modules"', () => {
      const fileSystem = getFileSystem({
        '/foo/node_modules/bar/module.js': 'console.log("hello!");',
      });

      expect(() =>
        resolve(
          'foo',
          'file:///foo/node_modules/bar/baz.js',
          fileSystem,
          false,
        ),
      ).toThrow('The package or module requested does not exist: "foo".');
    });
  });

  it('caches the result of a resolution', () => {
    const emptyFileSystem = getFileSystem();
    const fileSystem = getFileSystem({
      '/foo/module.js': 'console.log("hello!");',
      '/foo/package.json': JSON.stringify({
        name: 'foo',
        exports: {
          '.': './module.js',
        },
      }),
    });

    const first = resolve('foo', 'file:///foo/bar.js', fileSystem, true);

    // The second call is done on an empty file system, but since the result is
    // cached, the same result should be returned.
    const second = resolve('foo', 'file:///foo/bar.js', emptyFileSystem, true);

    expect(first).toBe(second);
  });

  it('throws an error if the specifier is invalid', () => {
    expect(() => resolve('foo%2fbar', import.meta.url)).toThrow(
      'Module specifier is an invalid URL, package name or package subpath specifier: "foo%2fbar".',
    );
  });

  it('throws an error if the resolved path contains invalid characters', () => {
    const fileSystem = getFileSystem({
      '/foo/module.js': 'console.log("hello!");',
      '/foo/package.json': JSON.stringify({
        name: 'foo',
        exports: {
          '.': './foo%2fbar.js',
        },
      }),
    });

    expect(() =>
      resolve('foo', 'file:///foo/bar.js', fileSystem, false),
    ).toThrow(
      'Module specifier is an invalid URL, package name or package subpath specifier: "file:///foo/foo%2fbar.js".',
    );
  });

  it('throws an error if the resolved `package.json` is null', () => {
    const fileSystem = getFileSystem({
      '/foo/module.js': 'console.log("hello!");',
      '/foo/package.json': JSON.stringify(null),
    });

    expect(() =>
      resolve('foo', 'file:///foo/bar.js', fileSystem, false),
    ).toThrow(
      '`package.json` configuration is invalid or contains an invalid configuration: "/foo".',
    );
  });
});

describe('comparePatternKeys', () => {
  it('returns 1 if the A contains a wildcard', () => {
    expect(comparePatternKeys('./*', './foo/')).toBe(1);
  });

  it('returns 1 if B is longer than A', () => {
    expect(comparePatternKeys('./*', './foo/*')).toBe(1);
  });

  it('returns 1 if B is longer than A without wildcards', () => {
    expect(comparePatternKeys('./', './foo/')).toBe(1);
  });

  it("returns 1 if B has a wildcard but A doesn't and the lengths are equal", () => {
    expect(comparePatternKeys('./foo/ab/', './foo/a/*')).toBe(1);
  });

  it('returns 1 if the actual length of B is longer than the actual length of A', () => {
    expect(comparePatternKeys('./foo/*/bar', './foo/*/bar/baz')).toBe(1);
  });

  it('returns 1 if both keys are the same', () => {
    expect(comparePatternKeys('./foo/', './foo/')).toBe(1);
  });

  it('returns -1 if the B contains a wildcard', () => {
    expect(comparePatternKeys('./foo/', './*')).toBe(-1);
  });

  it('returns -1 if A is longer than B', () => {
    expect(comparePatternKeys('./foo/*', './*')).toBe(-1);
  });

  it('returns -1 if A is longer than B without wildcards', () => {
    expect(comparePatternKeys('./foo/', './')).toBe(-1);
  });

  it("returns -1 if A has a wildcard but B doesn't and the lengths are equal", () => {
    expect(comparePatternKeys('./foo/a/*', './foo/ab/')).toBe(-1);
  });

  it('returns -1 if the actual length of A is longer than the actual length of B', () => {
    expect(comparePatternKeys('./foo/*/bar/baz', './foo/*/bar')).toBe(-1);
  });

  it('returns 0 if both keys contain a wildcard and the lengths are equal', () => {
    expect(comparePatternKeys('./*', './*')).toBe(0);
  });
});
