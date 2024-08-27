import { getVirtualEnvironment } from '@ts-bridge/test-utils';
import type { Statement } from 'typescript';
import { factory } from 'typescript';
import { describe, expect, it } from 'vitest';

import { getImportDefaultHelper } from './helpers.js';

/**
 * Compile a statement. This is used to test the output of the shim functions.
 *
 * @param node - The statement to compile.
 * @returns The compiled code.
 */
function compile(node: Statement | Statement[]) {
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

  return system.readFile('/index.js');
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
});
