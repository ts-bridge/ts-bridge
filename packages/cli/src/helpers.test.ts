import { evaluateModule, getVirtualEnvironment } from '@ts-bridge/test-utils';
import type { Statement } from 'typescript';
import { factory } from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';

import { getImportDefaultHelper } from './helpers.js';

/**
 * Compile a statement. This is used to test the output of the shim functions.
 *
 * @param node - The statement to compile.
 * @returns The compiled code.
 */
function compile(node: Statement | Statement[]): string {
  const { program, system } = getVirtualEnvironment({
    files: {
      '/index.ts': '// no-op',
    },
  });

  const statements = Array.isArray(node) ? node : [node];
  program.emit(undefined, undefined, undefined, false, {
    before: [
      () => {
        return (sourceFile) => {
          // TypeScript doesn't provide a nice way to add a new source file, so
          // instead we update the dummy source file with the new node.
          return factory.updateSourceFile(sourceFile, statements);
        };
      },
    ],
  });

  const code = system.readFile('/index.js');
  if (!code) {
    throw new Error('Compilation failed.');
  }

  return code;
}

describe('getImportDefaultHelper', () => {
  it('returns the `importDefault` helper function', () => {
    const ast = getImportDefaultHelper('importDefault');

    expect(compile(ast)).toMatchInlineSnapshot(`
      ""use strict";
      function importDefault(module) {
          if (module?.__esModule) {
              return module.default;
          }
          return module;
      }
      "
    `);
  });

  describe('importDefault', () => {
    type Module = {
      importDefault: (module: any) => any;
    };

    let importDefault: Module['importDefault'];

    beforeAll(async () => {
      const code = `
        ${compile(getImportDefaultHelper('importDefault'))}
        export { importDefault };
      `;

      const module = await evaluateModule<Module>(code);
      importDefault = module.importDefault;
    });

    it('returns the default export if `__esModule` is `true`', () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const module = { default: 'default export', __esModule: true };
      expect(importDefault(module)).toBe('default export');
    });

    it('returns the module if `__esModule` is `false`', () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const module = { default: 'default export', __esModule: false };
      expect(importDefault(module)).toBe(module);
    });

    it('returns the module if `__esModule` is `undefined`', () => {
      const module = { default: 'default export' };
      expect(importDefault(module)).toBe(module);
    });

    it('returns `undefined` if the module is `undefined`', () => {
      expect(importDefault(undefined)).toBe(undefined);
    });
  });
});
