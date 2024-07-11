import { noOp } from '@ts-bridge/test-utils';
import { dirname, resolve } from 'path';
import typescript from 'typescript';
import { fileURLToPath } from 'url';
import { describe, expect, it, vi } from 'vitest';

import {
  getFileSystemFromTypeScript,
  getModulePath,
  getModuleType,
  resolvePackageSpecifier,
  resolveRelativePackageSpecifier,
} from './module-resolver.js';

const { sys } = typescript;

const BASE_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'test-utils',
  'test',
  'fixtures',
  'import-resolver',
);

const PARENT_URL = resolve(BASE_DIRECTORY, 'src', 'index.ts');

describe('resolvePackageSpecifier', () => {
  it('resolves a package specifier', () => {
    const packageSpecifier = resolvePackageSpecifier(
      'typescript',
      PARENT_URL,
      sys,
    );

    expect(packageSpecifier).toStrictEqual({
      specifier: 'typescript',
      format: 'commonjs',
    });
  });

  it('resolves a package specifier for a package without a `main` field', () => {
    const packageSpecifier = resolvePackageSpecifier(
      'is-stream',
      PARENT_URL,
      sys,
    );

    expect(packageSpecifier).toStrictEqual({
      specifier: 'is-stream/index.js',
      format: 'commonjs',
    });
  });

  it('resolves a package specifier with an extension', () => {
    const packageSpecifier = resolvePackageSpecifier(
      'semver/preload',
      PARENT_URL,
      sys,
    );

    expect(packageSpecifier).toStrictEqual({
      specifier: 'semver/preload.js',
      format: 'commonjs',
    });
  });
});

describe('resolveRelativePackageSpecifier', () => {
  it('resolves a relative package specifier', () => {
    const packageSpecifier = resolveRelativePackageSpecifier(
      './dummy',
      PARENT_URL,
      sys,
    );

    expect(packageSpecifier).toStrictEqual({
      specifier: './dummy.ts',
      format: null,
    });
  });

  it('resolves a directory import', () => {
    const packageSpecifier = resolveRelativePackageSpecifier(
      './folder',
      PARENT_URL,
      sys,
    );

    expect(packageSpecifier).toStrictEqual({
      specifier: './folder/index.ts',
      format: null,
    });
  });
});

describe('getModulePath', () => {
  it('returns the path for built-in modules as-is', () => {
    expect(
      getModulePath({
        packageSpecifier: 'fs',
        extension: '.mjs',
        parentUrl: PARENT_URL,
        system: sys,
      }),
    ).toBe('fs');

    expect(
      getModulePath({
        packageSpecifier: 'path',
        extension: '.mjs',
        parentUrl: PARENT_URL,
        system: sys,
      }),
    ).toBe('path');

    expect(
      getModulePath({
        packageSpecifier: 'path/posix',
        extension: '.mjs',
        parentUrl: PARENT_URL,
        system: sys,
      }),
    ).toBe('path/posix');
  });

  it('returns the path for a `node_modules` package', () => {
    expect(
      getModulePath({
        packageSpecifier: 'semver',
        extension: '.mjs',
        parentUrl: PARENT_URL,
        system: sys,
      }),
    ).toBe('semver');

    expect(
      getModulePath({
        packageSpecifier: 'typescript',
        extension: '.mjs',
        parentUrl: PARENT_URL,
        system: sys,
      }),
    ).toBe('typescript');

    expect(
      getModulePath({
        packageSpecifier: '@babel/core',
        extension: '.mjs',
        parentUrl: PARENT_URL,
        system: sys,
      }),
    ).toBe('@babel/core');
  });

  it('returns the path for a `node_modules` package with a path', () => {
    expect(
      getModulePath({
        packageSpecifier: 'semver/preload',
        extension: '.mjs',
        parentUrl: PARENT_URL,
        system: sys,
      }),
    ).toBe('semver/preload.js');

    expect(
      getModulePath({
        packageSpecifier: '@babel/core/lib/index.js',
        extension: '.mjs',
        parentUrl: PARENT_URL,
        system: sys,
      }),
    ).toBe('@babel/core/lib/index.js');
  });

  it('returns the same path if the package specifier cannot be resolved', () => {
    expect(
      getModulePath({
        packageSpecifier: 'non-existing',
        extension: '.mjs',
        parentUrl: PARENT_URL,
        system: sys,
      }),
    ).toBe('non-existing');
  });

  it('replaces the extension for relative paths', () => {
    expect(
      getModulePath({
        packageSpecifier: './dummy.js',
        extension: '.mjs',
        parentUrl: PARENT_URL,
        system: sys,
      }),
    ).toBe('./dummy.mjs');
  });

  it('returns the path for a directory', () => {
    expect(
      getModulePath({
        packageSpecifier: './folder',
        extension: '.mjs',
        parentUrl: PARENT_URL,
        system: sys,
      }),
    ).toBe('./folder/index.mjs');
  });

  it('logs a warning if the package specifier cannot be resolved', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(noOp);

    getModulePath({
      packageSpecifier: 'non-existing',
      extension: '.mjs',
      parentUrl: PARENT_URL,
      system: sys,
      verbose: true,
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not resolve module:'),
    );
  });
});

describe('getModuleType', () => {
  it('returns the type for a package specifier', () => {
    expect(getModuleType('typescript', sys, PARENT_URL)).toBe('commonjs');
    expect(getModuleType('is-stream', sys, PARENT_URL)).toBe('commonjs');
    expect(getModuleType('semver/preload', sys, PARENT_URL)).toBe('commonjs');

    expect(getModuleType('fs', sys, PARENT_URL)).toBe('builtin');
    expect(getModuleType('chalk', sys, PARENT_URL)).toBe('module');

    expect(getModuleType('./dummy', sys, PARENT_URL)).toBe(null);
    expect(getModuleType('./folder', sys, PARENT_URL)).toBe(null);
  });
});

describe('getFileSystemFromTypeScript', () => {
  it("returns the file system interface from TypeScript's `system`", () => {
    const fileSystem = getFileSystemFromTypeScript(sys);

    expect(fileSystem.isFile).toBeInstanceOf(Function);
    expect(fileSystem.isDirectory).toBeInstanceOf(Function);
    expect(fileSystem.readFile).toBeInstanceOf(Function);
    expect(fileSystem.readBytes).toBeInstanceOf(Function);
  });

  describe('isFile', () => {
    it('returns true for existing files', () => {
      const fileSystem = getFileSystemFromTypeScript(sys);

      expect(
        fileSystem.isFile(resolve(BASE_DIRECTORY, 'src', 'dummy.ts')),
      ).toBe(true);
    });

    it('returns false for non-existing files', () => {
      const fileSystem = getFileSystemFromTypeScript(sys);

      expect(
        fileSystem.isFile(resolve(BASE_DIRECTORY, 'src', 'non-existing.ts')),
      ).toBe(false);
    });

    it('returns false for directories', () => {
      const fileSystem = getFileSystemFromTypeScript(sys);

      expect(fileSystem.isFile(resolve(BASE_DIRECTORY, 'src'))).toBe(false);
    });
  });

  describe('isDirectory', () => {
    it('returns true for existing directories', () => {
      const fileSystem = getFileSystemFromTypeScript(sys);

      expect(fileSystem.isDirectory(resolve(BASE_DIRECTORY, 'src'))).toBe(true);
    });

    it('returns false for non-existing directories', () => {
      const fileSystem = getFileSystemFromTypeScript(sys);

      expect(
        fileSystem.isDirectory(resolve(BASE_DIRECTORY, 'non-existing')),
      ).toBe(false);
    });

    it('returns false for files', () => {
      const fileSystem = getFileSystemFromTypeScript(sys);

      expect(
        fileSystem.isDirectory(resolve(BASE_DIRECTORY, 'src', 'dummy.ts')),
      ).toBe(false);
    });
  });

  describe('readFile', () => {
    it('reads the contents of a file', () => {
      const fileSystem = getFileSystemFromTypeScript(sys);

      expect(
        fileSystem.readFile(resolve(BASE_DIRECTORY, 'src', 'dummy.ts')),
      ).toBe('export const foo = 42;\n');
    });

    it('throws an error for non-existing files', () => {
      const fileSystem = getFileSystemFromTypeScript(sys);

      expect(() =>
        fileSystem.readFile(resolve(BASE_DIRECTORY, 'src', 'non-existing.ts')),
      ).toThrow(/File not found: ".*"\./u);
    });
  });

  describe('readBytes', () => {
    it('reads the contents of a file as bytes', () => {
      const fileSystem = getFileSystemFromTypeScript(sys);

      expect(
        fileSystem.readBytes(resolve(BASE_DIRECTORY, 'src', 'dummy.ts'), 20),
      ).toStrictEqual(
        new Uint8Array([
          101, 120, 112, 111, 114, 116, 32, 99, 111, 110, 115, 116, 32, 102,
          111, 111, 32, 61, 32, 52,
        ]),
      );
    });

    it('throws an error for non-existing files', () => {
      const fileSystem = getFileSystemFromTypeScript(sys);

      expect(() =>
        fileSystem.readBytes(
          resolve(BASE_DIRECTORY, 'src', 'non-existing.ts'),
          0,
        ),
      ).toThrow(/File not found: ".*"\./u);
    });
  });
});
