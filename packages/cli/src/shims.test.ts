import { evaluateModule, getVirtualEnvironment } from '@ts-bridge/test-utils';
import type { Statement } from 'typescript';
import { factory } from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';

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

  describe('fileUrlToPath', () => {
    type Module = {
      fileUrlToPath: (fileUrl: string) => string;
    };

    let fileUrlToPath: Module['fileUrlToPath'];

    beforeAll(async () => {
      const code = `
        ${compile(getFileUrlToPathHelperFunction('fileUrlToPath'))}
        export { fileUrlToPath };
      `;

      const module = await evaluateModule<Module>(code);
      fileUrlToPath = module.fileUrlToPath;
    });

    it('converts a file URL to a path', () => {
      const fileUrl = 'file:///Users/test/file.js';
      expect(fileUrlToPath(fileUrl)).toBe('/Users/test/file.js');
    });

    it('converts a file URL to a path with a drive letter', () => {
      const fileUrl = 'file:///C:/Users/test/file.js';
      expect(fileUrlToPath(fileUrl)).toBe('C:/Users/test/file.js');
    });
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

  describe('dirname', () => {
    type Module = {
      dirname: (path: string) => string;
    };

    let dirname: Module['dirname'];

    beforeAll(async () => {
      const code = `
        ${compile(getDirnameHelperFunction('dirname'))}
        export { dirname };
      `;

      const module = await evaluateModule<Module>(code);
      dirname = module.dirname;
    });

    it('returns the directory name of a path', () => {
      expect(dirname('/path/to/file')).toBe('/path/to');
    });

    it('returns the directory name of a path with a trailing slash', () => {
      expect(dirname('/path/to/file/')).toBe('/path/to');
    });

    it('returns the directory name of a path with a drive letter', () => {
      expect(dirname('C:/path/to/file')).toBe('C:/path/to');
    });

    it('returns the directory name of a path with a drive letter and trailing slash', () => {
      expect(dirname('C:/path/to/file/')).toBe('C:/path/to');
    });

    it('returns the directory name of a path with a root directory', () => {
      expect(dirname('/')).toBe('/');
    });

    it('returns the directory name of a path with a root directory and trailing slash', () => {
      expect(dirname('//')).toBe('/');
    });

    it('returns the directory name of a path with a root directory and a trailing slash', () => {
      expect(dirname('/path/to/')).toBe('/path');
    });

    it('returns the directory name of a path with a root directory and a drive letter', () => {
      expect(dirname('C:/')).toBe('C:/');
    });

    it('returns the directory name of a path with a root directory and a drive letter and a trailing slash', () => {
      expect(dirname('C:/path/to/')).toBe('C:/path');
    });
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

  describe('dirname', () => {
    type Module = {
      dirname: (url: string) => string;
    };

    let dirname: Module['dirname'];

    beforeAll(async () => {
      const code = `
        ${compile(getFileUrlToPathHelperFunction('fileUrlToPath'))}
        ${compile(getDirnameHelperFunction('getDirname'))}
        ${compile(
          getDirnameGlobalFunction('dirname', 'fileUrlToPath', 'getDirname'),
        )}
        export { dirname };
      `;

      const module = await evaluateModule<Module>(code);
      dirname = module.dirname;
    });

    it('returns the directory name of a URL', () => {
      const url = 'file:///path/to/file.js';
      expect(dirname(url)).toBe('/path/to');
    });

    it('returns the directory name of a URL with a drive letter', () => {
      const url = 'file:///C:/path/to/file.js';
      expect(dirname(url)).toBe('C:/path/to');
    });
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

  describe('importMetaUrl', () => {
    type Module = {
      importMetaUrl: (fileName: string) => string;
    };

    let importMetaUrl: Module['importMetaUrl'];

    beforeAll(async () => {
      const code = `
        ${compile(getImportMetaUrlFunction('importMetaUrl'))}
        export { importMetaUrl };
      `;

      const module = await evaluateModule<Module>(code);
      importMetaUrl = module.importMetaUrl;
    });

    it('returns the import meta URL', () => {
      const fileName = '/path/to/file.js';
      expect(importMetaUrl(fileName)).toBe(`file://${fileName}`);
    });
  });
});

describe('getRequireHelperFunction', () => {
  it('returns the `require` helper function', () => {
    const ast = getRequireHelperFunction('require', 'createRequire');

    expect(compile(ast)).toMatchInlineSnapshot(`
      ""use strict";
      import { createRequire as createRequire } from "module";
      const require = createRequire(import.meta.url);
      "
    `);
  });

  describe('require', () => {
    type Module = {
      require: (identifier: string, url: string) => unknown;
    };

    let require: Module['require'];

    beforeAll(async () => {
      const code = `
        ${compile(getRequireHelperFunction('require', 'createRequire'))}
        export { require };
      `;

      const module = await evaluateModule<Module>(code);
      require = module.require;
    });

    it('requires a module', () => {
      const url = 'file:///path/to/file.js';
      expect(require('fs', url)).toBeDefined();
    });
  });
});
