import { getFixture } from '@ts-bridge/test-utils';
import { basename } from 'path';
import type {
  CustomTransformerFactory,
  Program,
  SourceFile,
  TransformerFactory,
  TypeChecker,
} from 'typescript';
import { createProgram, sys } from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';

import type { BuildType } from './build-type.js';
import { getBuildTypeOptions } from './build-type.js';
import { getTypeScriptConfig } from './config.js';
import {
  getExportExtensionTransformer,
  getGlobalsTransformer,
  getImportAttributeTransformer,
  getImportExtensionTransformer,
  getImportMetaTransformer,
  getNamedImportTransformer,
  getRemoveImportAttributeTransformer,
  getRequireExtensionTransformer,
  getRequireTransformer,
  getTargetTransformer,
  getTypeImportExportTransformer,
} from './transformers.js';

type CompileOptions = {
  program: Program;
  format: BuildType;
  transformer: TransformerFactory<SourceFile> | CustomTransformerFactory;
};

/**
 * Compile a string of (TypeScript) code to JavaScript, and return the compiled
 * code.
 *
 * @param options - Options bag.
 * @param options.program - The TypeScript program to compile.
 * @param options.format - The format to compile the code to.
 * @param options.transformer - The transformer to use.
 * @returns The compiled code.
 */
function compile({ program, format, transformer }: CompileOptions) {
  const { target } = getBuildTypeOptions(format);
  const files: Record<string, string> = {};

  program.emit(
    undefined,
    (fileName, text) => {
      files[basename(fileName)] = text;
    },
    undefined,
    undefined,
    {
      before: [transformer, getTargetTransformer(target)],
    },
  );

  return files;
}

type Compiler = ((
  format: BuildType,
  transformer: TransformerFactory<SourceFile> | CustomTransformerFactory,
) => Record<string, string>) & {
  typeChecker: TypeChecker;
};

/**
 * Create a TypeScript compiler for a project.
 *
 * @param projectPath - The path to the project.
 * @returns The compiler.
 */
function createCompiler(projectPath: string) {
  const { fileNames, options } = getTypeScriptConfig(
    `${projectPath}/tsconfig.json`,
    sys,
  );

  const program = createProgram({
    rootNames: fileNames,
    options,
  });

  const fn: Compiler = (
    format: BuildType,
    transformer: TransformerFactory<SourceFile> | CustomTransformerFactory,
  ) => {
    return compile({ program, format, transformer });
  };

  fn.typeChecker = program.getTypeChecker();
  return fn;
}

describe('getImportExtensionTransformer', () => {
  describe('when targeting `module`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('import-resolver'));
      files = compiler(
        'module',
        getImportExtensionTransformer('.mjs', {
          typeChecker: compiler.typeChecker,
          system: sys,
        }),
      );
    });

    it('adds the `.mjs` extension to the import statement', async () => {
      expect(files['add.js']).toMatchInlineSnapshot(`
        "import { foo } from "./dummy.mjs";
        foo;
        "
      `);
    });

    it('rewrites the import to `index.mjs` when importing from a directory', async () => {
      expect(files['import-folder.js']).toMatchInlineSnapshot(`
        "import { foo } from "./folder/index.mjs";
        foo;
        "
      `);
    });

    it('overrides an existing extension', async () => {
      expect(files['override.js']).toMatchInlineSnapshot(`
        "import { foo } from "./dummy.mjs";
        foo;
        "
      `);
    });

    it('resolves external imports with paths', async () => {
      expect(files['external.js']).toMatchInlineSnapshot(`
        "import { compare } from "semver";
        import { compareLoose } from "semver/preload.js";
        compare;
        compareLoose;
        "
      `);
    });

    it('does not add an extension if the module fails to resolve', async () => {
      expect(files['unresolved.js']).toMatchInlineSnapshot(`
        "import "./unresolved-module";
        "
      `);
    });

    it('does not add an extension if the module specifier is invalid', async () => {
      expect(files['invalid.js']).toMatchInlineSnapshot(`
        "// @ts-expect-error - Invalid module specifier.
        import { foo } from bar;
        foo;
        "
      `);
    });
  });

  describe('when targeting `commonjs`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('import-resolver'));
      files = compiler(
        'commonjs',
        getImportExtensionTransformer('.cjs', {
          typeChecker: compiler.typeChecker,
          system: sys,
        }),
      );
    });

    it('adds the `.cjs` extension to the import statement', async () => {
      expect(files['add.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        const dummy_1 = require("./dummy.cjs");
        dummy_1.foo;
        "
      `);
    });

    it('rewrites the import to `index.cjs` when importing from a directory', async () => {
      expect(files['import-folder.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        const folder_1 = require("./folder/index.cjs");
        folder_1.foo;
        "
      `);
    });

    it('overrides an existing extension', async () => {
      expect(files['override.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        const dummy_js_1 = require("./dummy.cjs");
        dummy_js_1.foo;
        "
      `);
    });

    it('resolves external imports with paths', async () => {
      expect(files['external.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        const semver_1 = require("semver");
        const preload_1 = require("semver/preload.js");
        semver_1.compare;
        preload_1.compareLoose;
        "
      `);
    });

    it('does not add an extension if the module fails to resolve', async () => {
      expect(files['unresolved.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        require("./unresolved-module");
        "
      `);
    });

    it('does not add an extension if the module specifier is invalid', async () => {
      expect(files['invalid.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        // @ts-expect-error - Invalid module specifier.
        const module_1 = require();
        module_1.foo;
        "
      `);
    });
  });
});

describe('getRequireExtensionTransformer', () => {
  describe('when targeting `module`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('require-resolver'));
      files = compiler(
        'module',
        getRequireExtensionTransformer('.mjs', {
          typeChecker: compiler.typeChecker,
          system: sys,
        }),
      );
    });

    it('adds the `.mjs` extension to the require statement', () => {
      expect(files['add.js']).toMatchInlineSnapshot(`
        "const { foo } = require("./dummy.mjs");
        foo;
        export {};
        "
      `);
    });

    it('overrides an existing extension', () => {
      expect(files['override.js']).toMatchInlineSnapshot(`
        "const { foo } = require("./dummy.mjs");
        foo;
        export {};
        "
      `);
    });

    it('resolves external imports with paths', async () => {
      expect(files['external.js']).toMatchInlineSnapshot(`
        "const { compare } = require("semver");
        const { compareLoose } = require("semver/preload.js");
        compare;
        compareLoose;
        export {};
        "
      `);
    });

    it('does not add an extension if the module fails to resolve', async () => {
      expect(files['unresolved.js']).toMatchInlineSnapshot(`
        "require("./unresolved-module");
        export {};
        "
      `);
    });

    it('does not add an extension if the module specifier is invalid', async () => {
      expect(files['invalid.js']).toMatchInlineSnapshot(`
        "// @ts-expect-error - Invalid module specifier.
        require(bar);
        export {};
        "
      `);
    });
  });

  describe('when targeting `commonjs`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('require-resolver'));
      files = compiler(
        'commonjs',
        getRequireExtensionTransformer('.cjs', {
          typeChecker: compiler.typeChecker,
          system: sys,
        }),
      );
    });

    it('adds the `.mjs` extension to the require statement', () => {
      expect(files['add.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        const { foo } = require("./dummy.cjs");
        foo;
        "
      `);
    });

    it('overrides an existing extension', () => {
      expect(files['override.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        const { foo } = require("./dummy.cjs");
        foo;
        "
      `);
    });

    it('resolves external imports with paths', async () => {
      expect(files['external.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        const { compare } = require("semver");
        const { compareLoose } = require("semver/preload.js");
        compare;
        compareLoose;
        "
      `);
    });

    it('does not add an extension if the module fails to resolve', async () => {
      expect(files['unresolved.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        require("./unresolved-module");
        "
      `);
    });

    it('does not add an extension if the module specifier is invalid', async () => {
      expect(files['invalid.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        // @ts-expect-error - Invalid module specifier.
        require(bar);
        "
      `);
    });
  });
});

describe('getExportExtensionTransformer', () => {
  describe('when targeting `module`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('export-resolver'));
      files = compiler(
        'module',
        getExportExtensionTransformer('.mjs', {
          typeChecker: compiler.typeChecker,
          system: sys,
        }),
      );
    });

    it('adds the `.mjs` extension to the export statement', async () => {
      expect(files['add.js']).toMatchInlineSnapshot(`
        "export { foo } from "./dummy.mjs";
        "
      `);
    });

    it('rewrites the export to `index.mjs` when exporting from a directory', async () => {
      expect(files['export-folder.js']).toMatchInlineSnapshot(`
        "export { foo } from "./folder/index.mjs";
        "
      `);
    });

    it('overrides an existing extension', async () => {
      expect(files['override.js']).toMatchInlineSnapshot(`
        "export { foo } from "./dummy.mjs";
        "
      `);
    });

    it('resolves external exports with paths', async () => {
      expect(files['external.js']).toMatchInlineSnapshot(`
        "export { compare } from "semver";
        export { compareLoose } from "semver/preload.js";
        "
      `);
    });

    it('does not add an extension if the module fails to resolve', async () => {
      expect(files['unresolved.js']).toMatchInlineSnapshot(`
        "// @ts-expect-error - Unresolved module.
        export { foo } from "./unresolved-module";
        "
      `);
    });

    it('does not add an extension if the module specifier is invalid', async () => {
      expect(files['invalid.js']).toMatchInlineSnapshot(`
        "// @ts-expect-error - Invalid module specifier.
        export { foo } from bar;
        "
      `);
    });
  });

  describe('when targeting `commonjs`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('export-resolver'));
      files = compiler(
        'commonjs',
        getExportExtensionTransformer('.cjs', {
          typeChecker: compiler.typeChecker,
          system: sys,
        }),
      );
    });

    it('adds the `.cjs` extension to the import statement', async () => {
      expect(files['add.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        exports.foo = void 0;
        var dummy_1 = require("./dummy.cjs");
        Object.defineProperty(exports, "foo", { enumerable: true, get: function () { return dummy_1.foo; } });
        "
      `);
    });

    it('rewrites the export to `index.cjs` when exporting from a directory', async () => {
      expect(files['export-folder.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        exports.foo = void 0;
        var folder_1 = require("./folder/index.cjs");
        Object.defineProperty(exports, "foo", { enumerable: true, get: function () { return folder_1.foo; } });
        "
      `);
    });

    it('overrides an existing extension', async () => {
      expect(files['override.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        exports.foo = void 0;
        var dummy_js_1 = require("./dummy.cjs");
        Object.defineProperty(exports, "foo", { enumerable: true, get: function () { return dummy_js_1.foo; } });
        "
      `);
    });

    it('resolves external exports with paths', async () => {
      expect(files['external.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        exports.compareLoose = exports.compare = void 0;
        var semver_1 = require("semver");
        Object.defineProperty(exports, "compare", { enumerable: true, get: function () { return semver_1.compare; } });
        var preload_1 = require("semver/preload.js");
        Object.defineProperty(exports, "compareLoose", { enumerable: true, get: function () { return preload_1.compareLoose; } });
        "
      `);
    });

    it('does not add an extension if the module fails to resolve', async () => {
      expect(files['unresolved.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        exports.foo = void 0;
        // @ts-expect-error - Unresolved module.
        var unresolved_module_1 = require("./unresolved-module");
        Object.defineProperty(exports, "foo", { enumerable: true, get: function () { return unresolved_module_1.foo; } });
        "
      `);
    });

    it('does not add an extension if the module specifier is invalid', async () => {
      expect(files['invalid.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        exports.foo = void 0;
        // @ts-expect-error - Invalid module specifier.
        var module_1 = require();
        Object.defineProperty(exports, "foo", { enumerable: true, get: function () { return module_1.foo; } });
        "
      `);
    });
  });
});

describe('getGlobalsTransformer', () => {
  describe('when targeting `module`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('globals'));
      files = compiler(
        'module',
        getGlobalsTransformer({
          typeChecker: compiler.typeChecker,
          system: sys,
        }),
      );
    });

    it('adds a shim when using `__filename`', async () => {
      expect(files['filename.js']).toMatchInlineSnapshot(`
        "function $getDirname(path) {
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
        function $fileUrlToPath(fileUrl) {
            const url = new URL(fileUrl);
            return url.pathname.replace(/^\\/([a-zA-Z]:)/u, "$1");
        }
        function $__dirname(url) {
            return $getDirname($fileUrlToPath(url));
        }
        console.log($fileUrlToPath(import.meta.url));
        export {};
        "
      `);
    });

    it('adds a shim when using `__dirname`', async () => {
      expect(files['dirname.js']).toMatchInlineSnapshot(`
        "function $getDirname(path) {
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
        function $fileUrlToPath(fileUrl) {
            const url = new URL(fileUrl);
            return url.pathname.replace(/^\\/([a-zA-Z]:)/u, "$1");
        }
        function $__dirname(url) {
            return $getDirname($fileUrlToPath(url));
        }
        console.log($__dirname(import.meta.url));
        export {};
        "
      `);
    });

    it('adds a shim when using both `__filename` and `__dirname`', async () => {
      expect(files['multiple.js']).toMatchInlineSnapshot(`
        "function $getDirname(path) {
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
        function $fileUrlToPath(fileUrl) {
            const url = new URL(fileUrl);
            return url.pathname.replace(/^\\/([a-zA-Z]:)/u, "$1");
        }
        function $__dirname(url) {
            return $getDirname($fileUrlToPath(url));
        }
        console.log($__dirname(import.meta.url), $fileUrlToPath(import.meta.url));
        export {};
        "
      `);
    });

    it('renames the shim when the name is already used in the scope', async () => {
      expect(files['rename.js']).toMatchInlineSnapshot(`
        "function $getDirname(path) {
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
        function $fileUrlToPath(fileUrl) {
            const url = new URL(fileUrl);
            return url.pathname.replace(/^\\/([a-zA-Z]:)/u, "$1");
        }
        function $__dirname(url) {
            return $getDirname($fileUrlToPath(url));
        }
        const $dirname = 'foo';
        console.log($dirname, $fileUrlToPath(import.meta.url));
        export {};
        "
      `);
    });

    it('does not add a shim when `__filename` refers to a variable in scope', async () => {
      expect(files['in-scope.js']).toMatchInlineSnapshot(`
        "const __filename = 'foo';
        console.log(__filename);
        export {};
        "
      `);
    });
  });
});

describe('getRequireTransformer', () => {
  describe('when targeting `module`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('globals'));
      files = compiler(
        'module',
        getRequireTransformer({
          typeChecker: compiler.typeChecker,
          system: sys,
        }),
      );
    });

    it('adds a shim when using `require`', async () => {
      expect(files['require.js']).toMatchInlineSnapshot(`
        "import { createRequire as $createRequire } from "module";
        function require(identifier, url) {
            const fn = $createRequire(url);
            return fn(identifier);
        }
        const { builtinModules } = require('module', import.meta.url);
        console.log(builtinModules);
        "
      `);
    });

    it('does not add a shim when `require` refers to a variable in scope', async () => {
      expect(files['require-in-scope.js']).toMatchInlineSnapshot(`
        "// @ts-expect-error - \`require\` is an existing global.
        const require = (_module) => undefined;
        require('module');
        export {};
        "
      `);
    });
  });
});

describe('getImportMetaTransformer', () => {
  describe('when targeting `commonjs`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('globals'));
      files = compiler(
        'commonjs',
        getImportMetaTransformer({
          typeChecker: compiler.typeChecker,
          system: sys,
        }),
      );
    });

    it('adds a shim when using `import.meta.url`', async () => {
      expect(files['import-meta.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        function $getImportMetaUrl(fileName) {
            return typeof document === "undefined" ? new URL(\`file:\${fileName}\`).href : document.currentScript?.src ?? new URL("main.js", document.baseURI).href;
        }
        // @ts-expect-error - \`import.meta.url\` isn't allowed here.
        console.log($getImportMetaUrl(__filename));
        "
      `);
    });
  });
});

describe('getNamedImportTransformer', () => {
  describe('when targeting `module`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('named-imports'));
      files = compiler(
        'module',
        getNamedImportTransformer({
          typeChecker: compiler.typeChecker,
          system: sys,
        }),
      );
    });

    it('rewrites a named import for an undetected CommonJS module import', async () => {
      expect(files['undetected.js']).toMatchInlineSnapshot(`
        "import $commonjsmodule from 'commonjs-module';
        const { bar } = $commonjsmodule;
        console.log(bar);
        "
      `);
    });

    it('renames the import when the name is already used in the scope', () => {
      expect(files['rename.js']).toMatchInlineSnapshot(`
        "import $_commonjsmodule from 'commonjs-module';
        const { bar } = $_commonjsmodule;
        const $commonjsmodule = 'foo';
        console.log($commonjsmodule, bar);
        "
      `);
    });

    it('only rewrites undetected imports if there are multiple imports', async () => {
      expect(files['both.js']).toMatchInlineSnapshot(`
        "import { foo } from 'commonjs-module';
        import $commonjsmodule from 'commonjs-module';
        const { bar } = $commonjsmodule;
        console.log(foo, bar);
        "
      `);
    });

    it('supports imports with property names', async () => {
      expect(files['property-names.js']).toMatchInlineSnapshot(`
        "import { foo as fooImport } from 'commonjs-module';
        import $commonjsmodule from 'commonjs-module';
        const { bar: barImport } = $commonjsmodule;
        console.log(fooImport, barImport);
        "
      `);
    });

    it('does not rewrite a named import for a detected CommonJS module import', async () => {
      expect(files['detected.js']).toMatchInlineSnapshot(`
        "import { foo } from 'commonjs-module';
        console.log(foo);
        "
      `);
    });

    it('does not rewrite the import when using a default import', () => {
      expect(files['default-import.js']).toMatchInlineSnapshot(`
        "import foo from 'commonjs-module';
        console.log(foo);
        "
      `);
    });

    it('does not rewrite the import when using a namespace import', () => {
      expect(files['namespace-import.js']).toMatchInlineSnapshot(`
        "import * as foo from 'commonjs-module';
        console.log(foo);
        "
      `);
    });

    it('does not rewrite type imports', () => {
      expect(files['type-import.js']).toMatchInlineSnapshot(`
        "export {};
        "
      `);
    });
  });
});

describe('getTypeImportExportTransformer', () => {
  describe('when targeting `module`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('type-imports'));
      files = compiler(
        'module',
        getTypeImportExportTransformer({
          typeChecker: compiler.typeChecker,
          system: sys,
        }),
      );
    });

    it('removes type imports and exports', async () => {
      expect(files['type-imports.js']).toMatchInlineSnapshot(`
        "export {};
        "
      `);
    });

    it('only removes type imports and exports when mixed with regular imports', async () => {
      expect(files['mixed-type-imports.js']).toMatchInlineSnapshot(`
        "import { bar } from './dummy';
        export { bar } from './dummy';
        console.log(bar);
        "
      `);
    });
  });
});

describe('getImportAttributeTransformer', () => {
  describe('when targeting `module`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('import-attributes'));
      files = compiler(
        'module',
        getImportAttributeTransformer(
          {
            moduleType: 'json',
            type: 'json',
          },
          {
            typeChecker: compiler.typeChecker,
            system: sys,
          },
        ),
      );
    });

    it('adds an import attribute to JSON imports', async () => {
      // This is written this way since the file contains either `with` or
      // `assert` depending on the TypeScript version.
      expect(files['json.js']).toMatch(
        /import '\.\/data\.json' (?:with|assert) \{ type: "json" \};/u,
      );
    });

    it('overrides existing import attributes', async () => {
      // This is written this way since the file contains either `with` or
      // `assert` depending on the TypeScript version.
      expect(files['override.js']).toMatch(
        /import '\.\/data\.json' (?:with|assert) \{ type: "json" \};/u,
      );
    });
  });
});

describe('getRemoveImportAttributeTransformer', () => {
  describe('when targeting `commonjs`', () => {
    let files: Record<string, string>;

    beforeAll(() => {
      const compiler = createCompiler(getFixture('import-attributes'));
      files = compiler(
        'commonjs',
        getRemoveImportAttributeTransformer({
          typeChecker: compiler.typeChecker,
          system: sys,
        }),
      );
    });

    it('removes import attributes', async () => {
      expect(files['preset.js']).toMatchInlineSnapshot(`
        ""use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        require("./data.json");
        "
      `);
    });
  });
});
