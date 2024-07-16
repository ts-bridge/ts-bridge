import {
  getMockTsConfig,
  getVirtualEnvironment,
  noOp,
} from '@ts-bridge/test-utils';
import type { CompilerOptions } from 'typescript';
import { ScriptTarget, sys } from 'typescript';
import { describe, expect, it, vi } from 'vitest';

import {
  BASE_COMPILER_OPTIONS,
  getBaseCompilerOptions,
  getCompilerOptions,
  getTypeScriptConfig,
} from './config.js';

describe('getTypeScriptConfig', () => {
  it('reads the TypeScript configuration', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
      tsconfig: getMockTsConfig({
        compilerOptions: {
          lib: ['ES2022'],
          module: 'Node16',
          moduleResolution: 'Node16',
          outDir: '/foo',
          skipLibCheck: true,
          strict: true,
          target: 'ES2022',
        },
      }),
    });

    expect(getTypeScriptConfig('/tsconfig.json', system).options)
      .toMatchInlineSnapshot(`
        {
          "configFilePath": "/tsconfig.json",
          "declaration": true,
          "declarationDir": "/",
          "declarationMap": true,
          "esModuleInterop": true,
          "lib": [
            "lib.es2022.d.ts",
          ],
          "module": 100,
          "moduleResolution": 3,
          "outDir": "/foo",
          "skipLibCheck": true,
          "strict": true,
          "target": 9,
        }
      `);
  });

  it('reads the TypeScript configuration from `/tsconfig.json` when specifying `/`', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
      tsconfig: getMockTsConfig({
        compilerOptions: {
          lib: ['ES2022'],
          module: 'Node16',
          moduleResolution: 'Node16',
          outDir: '/foo',
          skipLibCheck: true,
          strict: true,
          target: 'ES2022',
        },
      }),
    });

    expect(getTypeScriptConfig('/', system).options).toMatchInlineSnapshot(`
        {
          "configFilePath": "/tsconfig.json",
          "declaration": true,
          "declarationDir": "/",
          "declarationMap": true,
          "esModuleInterop": true,
          "lib": [
            "lib.es2022.d.ts",
          ],
          "module": 100,
          "moduleResolution": 3,
          "outDir": "/foo",
          "skipLibCheck": true,
          "strict": true,
          "target": 9,
        }
      `);
  });

  it('throws an error if the file does not exist', () => {
    expect(() => getTypeScriptConfig('/')).toThrowError(
      'The TypeScript configuration file does not exist at "/" or "/tsconfig.json".',
    );
  });

  it('throws an error if the file cannot be read', () => {
    expect(() =>
      getTypeScriptConfig('/tsconfig.json', {
        ...sys,
        fileExists(path: string): boolean {
          return path === '/tsconfig.json';
        },
        readFile: () => {
          throw new Error('Failed to read file.');
        },
      }),
    ).toThrowError('Failed to read the TypeScript configuration.');
  });

  it('throws an error if the file is invalid', () => {
    const { system } = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
      tsconfig: {
        compilerOptions: {
          lib: false,
        },
      },
    });

    expect(() => getTypeScriptConfig('/tsconfig.json', system)).toThrowError(
      'Failed to parse the TypeScript configuration.',
    );
  });
});

describe('getBaseCompilerOptions', () => {
  it('returns the base compiler options', () => {
    expect(getBaseCompilerOptions('/base', BASE_COMPILER_OPTIONS))
      .toMatchInlineSnapshot(`
        {
          "declaration": true,
          "declarationDir": "/base/dist",
          "declarationMap": true,
          "emitDeclarationOnly": false,
          "noEmit": false,
          "noEmitOnError": true,
          "outDir": "/base/dist",
        }
      `);
  });
});

describe('getCompilerOptions', () => {
  it('returns the compiler options', () => {
    const baseOptions: CompilerOptions = {
      target: ScriptTarget.ES2021,
    };

    expect(getCompilerOptions(baseOptions)).toMatchInlineSnapshot(`
      {
        "declaration": true,
        "declarationMap": true,
        "emitDeclarationOnly": false,
        "noEmit": false,
        "noEmitOnError": true,
        "target": 8,
      }
    `);
  });

  it('logs a warning if any options are overridden', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(noOp);
    const baseOptions: CompilerOptions = {
      emitDeclarationOnly: true,
      noEmit: true,
    };

    getCompilerOptions(baseOptions);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'The compiler option "emitDeclarationOnly" in the provided "tsconfig.json" will be overridden.',
      ),
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'The compiler option "noEmit" in the provided "tsconfig.json" will be overridden.',
      ),
    );
  });
});
