import { getVirtualEnvironment } from '@ts-bridge/test-utils';
import type { Statement } from 'typescript';
import { factory } from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  getDirnameGlobalFunction,
  getDirnameHelperFunction,
  getFileUrlToPathHelperFunction,
  getImportMetaUrlFunction,
  getRequireHelperFunction,
} from './shims.js';

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

describe('getFileUrlToPathHelperFunction', () => {
  it('returns the `fileUrlToPath` function', () => {
    const ast = getFileUrlToPathHelperFunction('fileUrlToPath');

    expect(compile(ast)).toMatchInlineSnapshot(`
      ""use strict";
      function fileUrlToPath(fileUrl) {
          const url = new URL(fileUrl);
          return url.pathname.replace(/^\\/([a-zA-Z]:)/u, "$1");
      }
      "
    `);
  });
});

describe('getDirnameHelperFunction', () => {
  it('returns the `dirname` function', () => {
    const ast = getDirnameHelperFunction('dirname');

    expect(compile(ast)).toMatchInlineSnapshot(`
      ""use strict";
      function dirname(path) {
          const sanitisedPath = path.toString().replace(/\\\\/gu, "/").replace(/\\/$/u, "");
          const index = sanitisedPath.lastIndexOf("/");
          if (index === -1) {
              return path;
          }
          if (index === 0) {
              return "/";
          }
          return sanitisedPath.slice(0, index);
      }
      "
    `);
  });
});

describe('getDirnameGlobalFunction', () => {
  it('returns the `dirname` global function', () => {
    const ast = getDirnameGlobalFunction(
      'dirname',
      'fileUrlToPath',
      'getDirname',
    );

    expect(compile(ast)).toMatchInlineSnapshot(`
      ""use strict";
      function dirname(url) {
          return getDirname(fileUrlToPath(url));
      }
      "
    `);
  });
});

describe('getImportMetaUrlFunction', () => {
  it('returns the `importMetaUrl` function', () => {
    const ast = getImportMetaUrlFunction('importMetaUrl');

    expect(compile(ast)).toMatchInlineSnapshot(`
      ""use strict";
      function importMetaUrl(fileName) {
          return typeof document === "undefined" ? new URL(\`file:\${fileName}\`).href : document.currentScript?.src ?? new URL("main.js", document.baseURI).href;
      }
      "
    `);
  });
});

describe('getRequireHelperFunction', () => {
  it('returns the `require` helper function', () => {
    const ast = getRequireHelperFunction('require');

    expect(compile(ast)).toMatchInlineSnapshot(`
      ""use strict";
      import { createRequire as require } from "module";
      function require(identifier, url) {
          const fn = require(url);
          return fn(identifier);
      }
      "
    `);
  });
});
