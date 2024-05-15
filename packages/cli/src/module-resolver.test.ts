import {
  getMockNodeModule,
  getMockPackageJson,
  getVirtualEnvironment,
} from '@ts-bridge/test-utils';
import { dirname, resolve } from 'path';
import typescript from 'typescript';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

import {
  getPackageEntryPoint,
  getPackageJson,
  getPackageName,
  getPackageParentPaths,
  getPackagePath,
  isESModule,
} from './module-resolver.js';

const { sys } = typescript;

const BASE_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

describe('getPackageName', () => {
  it('returns the name of a scoped package', () => {
    expect(getPackageName('@babel/core')).toBe('@babel/core');
  });

  it('returns the name of a scoped package with a path', () => {
    expect(getPackageName('@babel/core/lib/index.js')).toBe('@babel/core');
  });

  it('returns the name of an unscoped package', () => {
    expect(getPackageName('typescript')).toBe('typescript');
  });

  it('returns the name of an unscoped package with a path', () => {
    expect(getPackageName('typescript/lib/typescript.js')).toBe('typescript');
  });

  it('throws an error for an invalid package name', () => {
    expect(() => getPackageName('')).toThrowError(
      'Invalid package specifier: "".',
    );
  });
});

describe('getPackageParentPaths', () => {
  it('returns the paths of the parent directories of a package', () => {
    const paths = getPackageParentPaths(
      'typescript/foo/bar/baz',
      BASE_DIRECTORY,
    );

    expect(paths[0]).toBe(resolve(BASE_DIRECTORY, 'typescript/foo/bar'));
    expect(paths[1]).toBe(resolve(BASE_DIRECTORY, 'typescript/foo'));
    expect(paths).not.toContain(resolve(BASE_DIRECTORY, 'typescript'));
  });

  it('returns the paths of the parent directories of a scoped package', () => {
    const paths = getPackageParentPaths(
      '@babel/core/foo/bar/baz',
      BASE_DIRECTORY,
    );

    expect(paths[0]).toBe(resolve(BASE_DIRECTORY, '@babel/core/foo/bar'));
    expect(paths[1]).toBe(resolve(BASE_DIRECTORY, '@babel/core/foo'));
    expect(paths).not.toContain(resolve(BASE_DIRECTORY, '@babel/core'));
  });
});

describe('getPackageJson', () => {
  it('returns the package.json file for a given module', () => {
    expect(getPackageJson('typescript', sys)).toStrictEqual(
      expect.objectContaining({
        name: 'typescript',
      }),
    );

    expect(getPackageJson('vitest', sys)).toStrictEqual(
      expect.objectContaining({
        name: 'vitest',
      }),
    );
  });

  it('returns `null` if it cannot resolve the module', () => {
    expect(getPackageJson('foo', sys)).toBeNull();
  });

  it('returns `null` for built-in modules', () => {
    expect(getPackageJson('fs', sys)).toBeNull();
    expect(getPackageJson('path', sys)).toBeNull();
  });
});

describe('getPackageEntryPoint', () => {
  it('returns the import entry point for a given module', () => {
    expect(
      getPackageEntryPoint(
        {
          name: 'foo',
          main: 'dist/foo.js',
          exports: {
            '.': {
              import: './dist/bar.js',
              require: './dist/baz.js',
            },
          },
        },
        'foo',
      ),
    ).toBe('./dist/bar.js');
  });

  it('returns the main entry point if it cannot resolve the module', () => {
    expect(
      getPackageEntryPoint(
        {
          name: 'foo',
          main: 'dist/foo.js',
          exports: {
            '.': {
              require: './dist/baz.js',
            },
          },
        },
        'bar',
      ),
    ).toBe('./dist/foo.js');
  });

  it('returns the main entry point if the package does not have exports', () => {
    expect(
      getPackageEntryPoint(
        {
          name: 'foo',
          main: 'dist/foo.js',
        },
        'bar',
      ),
    ).toBe('./dist/foo.js');
  });

  it('returns `null` if the package does not have a main field', () => {
    expect(
      getPackageEntryPoint(
        {
          name: 'foo',
        },
        'bar',
      ),
    ).toBeNull();
  });
});

describe('isESModule', () => {
  it('returns true for built-in modules', () => {
    expect(isESModule('fs', sys, BASE_DIRECTORY)).toBe(true);
    expect(isESModule('path', sys, BASE_DIRECTORY)).toBe(true);
  });

  it('returns true for modules with a .mjs extension', () => {
    expect(
      isESModule('typescript/lib/typescript.mjs', sys, BASE_DIRECTORY),
    ).toBe(true);
  });

  it('returns true for modules with a .mjs entry point', () => {
    expect(isESModule('vite', sys, BASE_DIRECTORY)).toBe(true);
  });

  it('returns true for modules with "type: module"', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
        ...getMockNodeModule({
          name: 'foo',
          files: {},
          packageJson: getMockPackageJson({
            name: 'foo',
            main: 'index.js',
            type: 'module',
          }),
        }),
        ...getMockNodeModule({
          name: 'bar',
          files: {
            'dist/esm/index.js': '// no-op',
            'dist/esm/package.json': '{ "type": "module" }',
            'dist/cjs/index.js': '// no-op',
          },
          packageJson: getMockPackageJson({
            name: 'bar',
            exports: {
              '.': {
                import: './dist/esm/index.js',
                require: './dist/cjs/index.js',
              },
            },
          }),
        }),
      },
    });

    // expect(isESModule('foo', system, '/')).toBe(true);
    expect(isESModule('bar', system, '/')).toBe(true);
  });

  it('returns false for CommonJS modules', () => {
    expect(isESModule('typescript', sys, BASE_DIRECTORY)).toBe(false);
    expect(
      isESModule('typescript/lib/typescript.js', sys, BASE_DIRECTORY),
    ).toBe(false);
    expect(isESModule('@jest/globals', sys, BASE_DIRECTORY)).toBe(false);
  });
});

describe('getPackagePath', () => {
  it('returns the path to a file in a package', () => {
    expect(getPackagePath('globals/index', sys, BASE_DIRECTORY)).toBe(
      'globals/index.js',
    );
  });

  it('returns the path to a file in a package with a .js extension', () => {
    expect(getPackagePath('globals/index.js', sys, BASE_DIRECTORY)).toBe(
      'globals/index.js',
    );
  });

  it('returns the path to a file in a package with a .cjs extension', () => {
    expect(getPackagePath('globals/index.cjs', sys, BASE_DIRECTORY)).toBe(
      'globals/index.cjs',
    );
  });

  it('returns `null` if the package could not be found', () => {
    expect(getPackagePath('foo', sys, BASE_DIRECTORY)).toBeNull();
  });

  it('returns `null` for built-in modules', () => {
    expect(getPackagePath('fs', sys, BASE_DIRECTORY)).toBeNull();
    expect(getPackagePath('path', sys, BASE_DIRECTORY)).toBeNull();
  });
});
