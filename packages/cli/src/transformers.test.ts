import {
  getMockNodeModule,
  getVirtualEnvironment,
} from '@ts-bridge/test-utils';
import type {
  CustomTransformerFactory,
  SourceFile,
  TransformerFactory,
} from 'typescript';
import { describe, expect, it } from 'vitest';

import type { BuildType } from './build-type.js';
import { getBuildTypeOptions } from './build-type.js';
import {
  getExportExtensionTransformer,
  getGlobalsTransformer,
  getImportExtensionTransformer,
  getImportMetaTransformer,
  getNamedImportTransformer,
  getRequireExtensionTransformer,
  getRequireTransformer,
  getTargetTransformer,
  getTypeImportExportTransformer,
} from './transformers.js';

type CompileOptions = {
  format: BuildType;
  code?: string;
  transformer: TransformerFactory<SourceFile> | CustomTransformerFactory;
  extraFiles?: Record<string, string>;
  tsconfig?: Record<string, any>;
  environment?: ReturnType<typeof getVirtualEnvironment>;
};

/**
 * Compile a string of (TypeScript) code to JavaScript, and return the compiled
 * code.
 *
 * @param options - Options bag.
 * @param options.format - The format to compile the code to.
 * @param options.transformer - The transformer to use.
 * @param options.code - The code to compile.
 * @param options.extraFiles - Extra files to include in the virtual
 * environment.
 * @param options.tsconfig - The TypeScript configuration to use.
 * @param options.environment - The virtual environment to use.
 * @returns The compiled code.
 */
async function compile({
  format,
  transformer,
  code,
  extraFiles = {},
  tsconfig,
  environment = getVirtualEnvironment({
    files: {
      '/index.ts': code ?? '',
      ...extraFiles,
    },
    tsconfig,
  }),
}: CompileOptions) {
  const { program, system } = environment;
  const { target } = getBuildTypeOptions(format);

  program.emit(undefined, undefined, undefined, undefined, {
    before: [transformer, getTargetTransformer(target)],
  });

  return system.readFile('/index.js');
}

describe('getImportExtensionTransformer', () => {
  it('adds the `.mjs` extension to the import statement', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import { foo } from './foo';
          foo;
        `,
        '/foo.ts': 'export const foo = "bar";',
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getImportExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "import { foo } from "./foo.mjs";
      foo;
      "
    `);
  });

  it('adds the `.cjs` extension to the import statement', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import { foo } from './foo';
          foo;
        `,
        '/foo.ts': 'export const foo = "bar";',
      },
    });

    expect(
      await compile({
        format: 'commonjs',
        environment,
        transformer: getImportExtensionTransformer('.cjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      const foo_1 = require("./foo.cjs");
      foo_1.foo;
      "
    `);
  });

  it('overrides an existing extension', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import { foo } from './foo.js';
          foo;
        `,
        '/foo.ts': 'export const foo = "bar";',
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getImportExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "import { foo } from "./foo.mjs";
      foo;
      "
    `);
  });

  it('does not add an extension to external imports', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import { createRequire } from 'module';
          createRequire;
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getImportExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "import { createRequire } from "module";
      createRequire;
      "
    `);
  });

  it('does not add an extension if the module fails to resolve', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          // @ts-expect-error - Cannot find module.
          import { foo } from './bar';
          foo;
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getImportExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "// @ts-expect-error - Cannot find module.
      import { foo } from "./bar";
      foo;
      "
    `);
  });

  it('does not add an extension if the module specifier is invalid', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          // @ts-expect-error - Invalid module specifier.
          import { foo } from bar;
          foo;
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getImportExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "// @ts-expect-error - Invalid module specifier.
      import { foo } from bar;
      foo;
      "
    `);
  });

  it('returns the original code when not using `import`', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const foo = 'bar';
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getImportExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      const foo = 'bar';
      "
    `);
  });
});

describe('getRequireExtensionTransformer', () => {
  it('adds the `.mjs` extension to the require statement', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const { foo } = require('./foo');
          foo;
        `,
        '/foo.ts': 'export const foo = "bar";',
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getRequireExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      const { foo } = require("./foo.mjs");
      foo;
      "
    `);
  });

  it('adds the `.cjs` extension to the require statement', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const { foo } = require('./foo');
          foo;
        `,
        '/foo.ts': 'export const foo = "bar";',
      },
    });

    expect(
      await compile({
        format: 'commonjs',
        environment,
        transformer: getRequireExtensionTransformer('.cjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      const { foo } = require("./foo.cjs");
      foo;
      "
    `);
  });

  it('overrides an existing extension', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const { foo } = require('./foo.js');
          foo;
        `,
        '/foo.ts': 'export const foo = "bar";',
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getRequireExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      const { foo } = require("./foo.mjs");
      foo;
      "
    `);
  });

  it('does not add an extension to external requires', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const { foo } = require('module');
          foo;
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getRequireExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      const { foo } = require("module");
      foo;
      "
    `);
  });

  it('does not add an extension if the module fails to resolve', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const { foo } = require('./bar');
          foo;
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getRequireExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      const { foo } = require("./bar");
      foo;
      "
    `);
  });

  it('does not add an extension if the module specifier is invalid', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          // @ts-expect-error - Invalid module specifier.
          const { foo } = require(bar);
          foo;
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getRequireExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      // @ts-expect-error - Invalid module specifier.
      const { foo } = require(bar);
      foo;
      "
    `);
  });

  it('returns the original code when not using `require`', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const foo = 'bar';
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getRequireExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      const foo = 'bar';
      "
    `);
  });
});

describe('getExportExtensionTransformer', () => {
  it('adds the `.mjs` extension to the export statement', async () => {
    const code = `
      export { foo } from './foo';
    `;

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
        '/foo.ts': 'export const foo = "bar";',
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getExportExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "export { foo } from "./foo.mjs";
      "
    `);
  });

  it('adds the `.cjs` extension to the export statement', async () => {
    const code = `
      export { foo } from './foo';
    `;

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
        '/foo.ts': 'export const foo = "bar";',
      },
    });

    expect(
      await compile({
        format: 'commonjs',
        environment,
        transformer: getExportExtensionTransformer('.cjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.foo = void 0;
      var foo_1 = require("./foo.cjs");
      Object.defineProperty(exports, "foo", { enumerable: true, get: function () { return foo_1.foo; } });
      "
    `);
  });

  it('overrides an existing extension', async () => {
    const code = `
      export { foo } from './foo.js';
    `;

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
        '/foo.ts': 'export const foo = "bar";',
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getExportExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "export { foo } from "./foo.mjs";
      "
    `);
  });

  it('does not add an extension to external exports', async () => {
    const code = `
      export { createRequire } from 'module';
    `;

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getExportExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "export { createRequire } from "module";
      "
    `);
  });

  it('does not add an extension if the module fails to resolve', async () => {
    const code = `
      // @ts-expect-error - Cannot find module.
      export { foo } from './bar';
    `;

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getExportExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "// @ts-expect-error - Cannot find module.
      export { foo } from "./bar";
      "
    `);
  });

  it('does not add an extension if the module specifier is invalid', async () => {
    const code = `
      // @ts-expect-error - Invalid module specifier.
      export { foo } from bar;
    `;

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getExportExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "// @ts-expect-error - Invalid module specifier.
      export { foo } from bar;
      "
    `);
  });

  it('returns the original code when not using `export`', async () => {
    const code = `
      const foo = 'bar';
    `;

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getExportExtensionTransformer('.mjs', {
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      const foo = 'bar';
      "
    `);
  });
});

describe('getGlobalsTransformer', () => {
  it('adds a shim when using `__filename`', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          console.log(__filename);
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getGlobalsTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      import * as $shims from "@ts-bridge/shims/esm";
      console.log($shims.__filename(import.meta.url));
      "
    `);
  });

  it('adds a shim when using `__dirname`', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          console.log(__dirname);
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getGlobalsTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      import * as $shims from "@ts-bridge/shims/esm";
      console.log($shims.__dirname(import.meta.url));
      "
    `);
  });

  it('adds a shim when using both `__filename` and `__dirname`', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          console.log(__filename);
          console.log(__dirname);
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getGlobalsTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      import * as $shims from "@ts-bridge/shims/esm";
      console.log($shims.__filename(import.meta.url));
      console.log($shims.__dirname(import.meta.url));
      "
    `);
  });

  it('renames the shim when the name is already used in the scope', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const shims = 'foo';
          console.log(__filename);
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getGlobalsTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      import * as $shims from "@ts-bridge/shims/esm";
      const shims = 'foo';
      console.log($shims.__filename(import.meta.url));
      "
    `);
  });

  it('does not add a shim when `__filename` refers to a variable in scope', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          // @ts-expect-error - Cannot redeclare block-scoped variable.
          const __filename = 'foo';
          console.log(__filename);
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getGlobalsTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      // @ts-expect-error - Cannot redeclare block-scoped variable.
      const __filename = 'foo';
      console.log(__filename);
      "
    `);
  });

  it('returns the original code when not using `__filename` or `__dirname`', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const foo = 'bar';
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getGlobalsTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      const foo = 'bar';
      "
    `);
  });
});

describe('getRequireTransformer', () => {
  it('adds a shim when using `require`', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const foo = require('module');
          console.log(foo);
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getRequireTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      import * as $nodeShims from "@ts-bridge/shims/esm/require";
      const foo = $nodeShims.require('module', import.meta.url);
      console.log(foo);
      "
    `);
  });

  it('does not add a shim when `require` refers to a variable in scope', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          // @ts-expect-error - Cannot redeclare block-scoped variable.
          const require = 'foo';
          console.log(require);
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getRequireTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      // @ts-expect-error - Cannot redeclare block-scoped variable.
      const require = 'foo';
      console.log(require);
      "
    `);
  });

  it('returns the original code when not using `require`', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const foo = 'bar';
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getRequireTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      const foo = 'bar';
      "
    `);
  });
});

describe('getImportMetaTransformer', () => {
  it('adds a shim when using `import.meta.url`', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          // @ts-expect-error - 'import.meta' is not allowed.
          console.log(import.meta.url);
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getImportMetaTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "import * as $shims from "@ts-bridge/shims";
      // @ts-expect-error - 'import.meta' is not allowed.
      console.log($shims.getImportMetaUrl(__filename));
      "
    `);
  });

  it('returns the original code when not using `import.meta.url`', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const foo = 'bar';
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getImportMetaTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      const foo = 'bar';
      "
    `);
  });
});

describe('getNamedImportTransformer', () => {
  it('rewrites the import when using a named import for a CommonJS module', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import { foo } from 'commonjs-module';
          console.log(foo);
        `,
        ...getMockNodeModule({
          name: 'commonjs-module',
          files: {
            'index.js': 'exports.foo = "bar";',
            'index.d.ts': 'export const foo: string;',
          },
        }),
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getNamedImportTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "import $commonjsmodule from 'commonjs-module';
      const { foo } = $commonjsmodule;
      console.log(foo);
      "
    `);
  });

  it('rewrites the import when using a named import for a scoped CommonJS module', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import { foo } from '@commonjs/module';
          console.log(foo);
        `,
        ...getMockNodeModule({
          name: '@commonjs/module',
          files: {
            'index.js': 'exports.foo = "bar";',
            'index.d.ts': 'export const foo: string;',
          },
        }),
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getNamedImportTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "import $commonjsmodule from '@commonjs/module';
      const { foo } = $commonjsmodule;
      console.log(foo);
      "
    `);
  });

  it('renames the import when the name is already used in the scope', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const commonjsmodule = 'foo';
          import { foo } from 'commonjs-module';
          console.log(foo);
        `,
        ...getMockNodeModule({
          name: 'commonjs-module',
          files: {
            'index.js': 'exports.foo = "bar";',
            'index.d.ts': 'export const foo: string;',
          },
        }),
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getNamedImportTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "const commonjsmodule = 'foo';
      import $commonjsmodule from 'commonjs-module';
      const { foo } = $commonjsmodule;
      console.log(foo);
      "
    `);
  });

  it('does not rewrite the import when using a default import', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import module from 'commonjs-module';
          console.log(module);
        `,
        ...getMockNodeModule({
          name: 'commonjs-module',
          files: {
            'index.js': 'module.exports = "bar";',
            'index.d.ts': 'declare const module: string; export {};',
          },
        }),
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getNamedImportTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "import module from 'commonjs-module';
      console.log(module);
      "
    `);
  });

  it('does not rewrite the import when using a namespace import', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import * as module from 'commonjs-module';
          console.log(module);
        `,
        ...getMockNodeModule({
          name: 'commonjs-module',
          files: {
            'index.js': 'module.exports = "bar";',
            'index.d.ts': 'declare const module: string; export {};',
          },
        }),
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getNamedImportTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "import * as module from 'commonjs-module';
      console.log(module);
      "
    `);
  });

  it('does not rewrite type imports', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import type { foo } from 'commonjs-module';
          import { type foo as _foo, bar } from 'commonjs-module';
          import { type foo as __foo } from 'commonjs-module';

          type Foo = typeof foo;
          type Bar = typeof bar;
          type Baz = typeof __foo;

          console.log(bar);
        `,
        ...getMockNodeModule({
          name: 'commonjs-module',
          files: {
            'index.js': 'exports.foo = "bar";',
            'index.d.ts': 'export const foo: string; export const bar: string;',
          },
        }),
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getNamedImportTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "import $commonjsmodule from 'commonjs-module';
      const { bar } = $commonjsmodule;
      console.log(bar);
      "
    `);
  });

  it('returns the original code when not using `import`', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          const foo = 'bar';
        `,
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getNamedImportTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      ""use strict";
      const foo = 'bar';
      "
    `);
  });
});

describe('getTypeImportExportTransformer', () => {
  it('removes type imports and exports', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import type { foo } from './foo';
          export type { foo } from './foo';
        `,
        '/foo.ts': 'export type foo = "bar";',
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getTypeImportExportTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "export {};
      "
    `);
  });

  it('removes named type imports and exports', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import { type foo } from './foo';
          import type { bar } from './foo';
          export { type foo, bar } from './foo';
        `,
        '/foo.ts': 'export type foo = "bar"; export const bar = "baz";',
      },
    });

    expect(
      await compile({
        format: 'module',
        environment,
        transformer: getTypeImportExportTransformer({
          typeChecker: environment.typeChecker,
          system: environment.system,
          baseDirectory: '/',
        }),
      }),
    ).toMatchInlineSnapshot(`
      "export { bar } from './foo';
      "
    `);
  });
});
