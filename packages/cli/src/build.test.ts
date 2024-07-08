import {
  evaluate,
  getMockNodeModule,
  getMockPackageJson,
  getMockTsConfig,
  getVirtualEnvironment,
  noOp,
} from '@ts-bridge/test-utils';
import typescript from 'typescript';
import { describe, expect, it, vi } from 'vitest';

import type { BuildType } from './build-type.js';
import { getBuildTypeOptions } from './build-type.js';
import { build, buildHandler, getFiles, getTransformers } from './build.js';
import { removeDirectory } from './file-system.js';

const { sys } = typescript;

vi.mock('./shims', async (importOriginal) => ({
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  ...(await importOriginal<typeof import('./shims.js')>()),
  isShimsPackageInstalled: vi.fn(() => true),
}));

type CompileOptions = {
  format: BuildType;
  code?: string;
  extraFiles?: Record<string, string>;
  tsconfig?: Record<string, any>;
  clean?: boolean;
  environment?: ReturnType<typeof getVirtualEnvironment>;
  outputPath?: string;
  files?: string[];
};

vi.mock('./file-system.js', async (importOriginal) => ({
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  ...(await importOriginal<typeof import('./file-system.js')>()),
  removeDirectory: vi.fn(),
}));

/**
 * Compile code using the virtual environment, and return the compiled code.
 *
 * @param options - The options to use.
 * @param options.format - The format to compile the code to.
 * @param options.code - The code to compile.
 * @param options.extraFiles - Extra files to include in the virtual
 * environment.
 * @param options.tsconfig - The `tsconfig.json` options to use.
 * @param options.clean - Whether to clean the output directory before building.
 * @param options.environment - The virtual environment to use.
 * @param options.outputPath - The output path to read the compiled code from.
 * @param options.files - The files to include in the project.
 * @returns The compiled code.
 */
function compile({
  format,
  code,
  extraFiles = {},
  tsconfig,
  clean = false,
  environment = getVirtualEnvironment({
    files: {
      '/index.ts': code ?? '',
      ...extraFiles,
    },
    tsconfig,
  }),
  outputPath = '/index',
  files = [
    '/index.ts',
    '/lib.d.ts',
    '/lib.es2022.d.ts',
    '/node_modules/@types/node/index.d.ts',
  ],
}: CompileOptions) {
  const { host, system } = environment;

  buildHandler({
    project: '/tsconfig.json',
    files,
    format: [format],
    clean,
    host,
    system,
  });

  const { extension } = getBuildTypeOptions(format);
  const output = system.readFile(`${outputPath}${extension}`);

  if (output === undefined) {
    throw new Error('The output is undefined.');
  }

  return output;
}

describe('build', () => {
  it('adds a `.mjs` extension to imports when using the `module` format', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import { foo } from "./foo";
          import { bar } from "./bar";

          export { foo, bar };
        `,
        '/foo.ts': 'export const foo = "foo";',
        '/bar.ts': 'export const bar = "bar";',
      },
    });

    const output = compile({
      format: 'module',
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      "import { foo } from "./foo.mjs";
      import { bar } from "./bar.mjs";
      export { foo, bar };
      "
    `);

    expect(await evaluate(output, environment.fileSystem))
      .toMatchInlineSnapshot(`
        {
          "bar": "bar",
          "foo": "foo",
        }
    `);
  });

  it('adds a `.cjs` extension to imports when using the `commonjs` format', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import { foo } from "./foo";
          import { bar } from "./bar";

          export { foo, bar };
        `,
        '/foo.ts': 'export const foo = "foo";',
        '/bar.ts': 'export const bar = "bar";',
      },
    });

    const output = compile({
      format: 'commonjs',
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.bar = exports.foo = void 0;
      const foo_1 = require("./foo.cjs");
      Object.defineProperty(exports, "foo", { enumerable: true, get: function () { return foo_1.foo; } });
      const bar_1 = require("./bar.cjs");
      Object.defineProperty(exports, "bar", { enumerable: true, get: function () { return bar_1.bar; } });
      "
    `);

    expect(await evaluate(output, environment.fileSystem))
      .toMatchInlineSnapshot(`
      {
        "bar": "bar",
        "foo": "foo",
      }
    `);
  });

  it('adds a `.mjs` extension to exports when using the `module` format', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          export * from "./foo";
          export * from "./bar";
        `,
        '/foo.ts': 'export const foo = "foo";',
        '/bar.ts': 'export const bar = "bar";',
      },
    });

    const output = compile({
      format: 'module',
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      "export * from "./foo.mjs";
      export * from "./bar.mjs";
      "
    `);

    expect(await evaluate(output, environment.fileSystem))
      .toMatchInlineSnapshot(`
      {
        "bar": "bar",
        "foo": "foo",
      }
    `);
  });

  it('adds a `.cjs` extension to exports when using the `commonjs` format', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          export * from "./foo";
          export * from "./bar";
        `,
        '/foo.ts': 'export const foo = "foo";',
        '/bar.ts': 'export const bar = "bar";',
      },
    });

    const output = compile({
      format: 'commonjs',
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
          if (k2 === undefined) k2 = k;
          var desc = Object.getOwnPropertyDescriptor(m, k);
          if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
            desc = { enumerable: true, get: function() { return m[k]; } };
          }
          Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
          if (k2 === undefined) k2 = k;
          o[k2] = m[k];
      }));
      var __exportStar = (this && this.__exportStar) || function(m, exports) {
          for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      __exportStar(require("./foo.cjs"), exports);
      __exportStar(require("./bar.cjs"), exports);
      "
    `);

    expect(await evaluate(output, environment.fileSystem))
      .toMatchInlineSnapshot(`
      {
        "bar": "bar",
        "foo": "foo",
      }
    `);
  });

  it('adds a `.mjs` extension to imports in declarations when using the `module` format', () => {
    const code = `
      import type { Foo } from "./foo";

      export function hello(): Foo {
        return 'foo';
      }
    `;

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
        '/foo.ts': `
          export type Foo = string;
        `,
      },
    });

    const output = compile({
      format: 'module',
      code,
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      "export function hello() {
          return 'foo';
      }
      "
    `);

    const declaration = environment.system.readFile('/index.d.mts');
    expect(declaration).toMatchInlineSnapshot(`
      "import type { Foo } from "./foo.mjs";
      export declare function hello(): Foo;
      //# sourceMappingURL=index.d.mts.map"
    `);
  });

  it('adds a `.cjs` extension to imports in declarations when using the `commonjs` format', () => {
    const code = `
      import type { Foo } from "./foo";

      export function hello(): Foo {
        return 'foo';
      }
    `;

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
        '/foo.ts': `
          export type Foo = string;
        `,
      },
    });

    const output = compile({
      format: 'commonjs',
      code,
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.hello = void 0;
      function hello() {
          return 'foo';
      }
      exports.hello = hello;
      "
    `);

    const declaration = environment.system.readFile('/index.d.cts');
    expect(declaration).toMatchInlineSnapshot(`
      "import type { Foo } from "./foo.cjs";
      export declare function hello(): Foo;
      //# sourceMappingURL=index.d.cts.map"
    `);
  });

  it('adds a `.mjs` extension to exports in declarations when using the `module` format', () => {
    const code = `
      export type { Foo } from "./foo";
    `;

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
        '/foo.ts': `
          export type Foo = string;
        `,
      },
    });

    const output = compile({
      format: 'module',
      code,
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      "export {};
      "
    `);

    const declaration = environment.system.readFile('/index.d.mts');
    expect(declaration).toMatchInlineSnapshot(`
      "export type { Foo } from "./foo.mjs";
      //# sourceMappingURL=index.d.mts.map"
    `);
  });

  it('adds a `.cjs` extension to exports in declarations when using the `commonjs` format', () => {
    const code = `
      export type { Foo } from "./foo";
    `;

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
        '/foo.ts': `
          export type Foo = string;
        `,
      },
    });

    const output = compile({
      format: 'commonjs',
      code,
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      "
    `);

    const declaration = environment.system.readFile('/index.d.cts');
    expect(declaration).toMatchInlineSnapshot(`
      "export type { Foo } from "./foo.cjs";
      //# sourceMappingURL=index.d.cts.map"
    `);
  });

  it('does not add an extension to `.json` imports and exports', () => {
    const code = `
      import { foo } from "./foo.json";
      export { foo } from "./foo.json";
    `;

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
        '/foo.json': `
          {
            "foo": "bar"
          }
        `,
      },
      tsconfig: getMockTsConfig({
        compilerOptions: {
          resolveJsonModule: true,
        },
      }),
    });

    const output = compile({
      format: 'commonjs',
      code,
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.foo = void 0;
      const foo_json_1 = require("./foo.json");
      var foo_json_2 = require("./foo.json");
      Object.defineProperty(exports, "foo", { enumerable: true, get: function () { return foo_json_2.foo; } });
      "
    `);

    const declaration = environment.system.readFile('/index.d.cts');
    expect(declaration).toMatchInlineSnapshot(`
      "export { foo } from "./foo.json";
      //# sourceMappingURL=index.d.cts.map"
    `);
  });

  it('adds a `__dirname` and `__filename` shim when using the `module` format', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          export default {
            dirname: __dirname,
            filename: __filename,
          };
        `,
      },
    });

    const output = compile({
      format: 'module',
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      "import * as $shims from "@ts-bridge/shims/esm";
      export default {
          dirname: $shims.__dirname(import.meta.url),
          filename: $shims.__filename(import.meta.url),
      };
      "
    `);

    expect(await evaluate(output, environment.fileSystem))
      .toMatchInlineSnapshot(`
        {
          "default": {
            "dirname": "/",
            "filename": "/index.mjs",
          },
        }
      `);
  });

  it('does not add a `__dirname` and `__filename` shim when using the `commonjs` format', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          export default {
            dirname: __dirname,
            filename: __filename,
          };
        `,
      },
    });

    const output = compile({
      format: 'commonjs',
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.default = {
          dirname: __dirname,
          filename: __filename,
      };
      "
    `);

    expect(await evaluate(output, environment.fileSystem))
      .toMatchInlineSnapshot(`
      {
        "default": {
          "dirname": "/",
          "filename": "/index.cjs",
        },
      }
    `);
  });

  it('adds a import.meta.url shim when using the `commonjs` format', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          export default {
            // @ts-expect-error - The 'import.meta' meta-property is not allowed.
            url: import.meta.url,
          };
        `,
      },
    });

    const output = compile({
      format: 'commonjs',
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
          if (k2 === undefined) k2 = k;
          var desc = Object.getOwnPropertyDescriptor(m, k);
          if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
            desc = { enumerable: true, get: function() { return m[k]; } };
          }
          Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
          if (k2 === undefined) k2 = k;
          o[k2] = m[k];
      }));
      var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
          Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
          o["default"] = v;
      });
      var __importStar = (this && this.__importStar) || function (mod) {
          if (mod && mod.__esModule) return mod;
          var result = {};
          if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
          __setModuleDefault(result, mod);
          return result;
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      const $shims = __importStar(require("@ts-bridge/shims"));
      exports.default = {
          // @ts-expect-error - The 'import.meta' meta-property is not allowed.
          url: $shims.getImportMetaUrl(__filename),
      };
      "
    `);

    expect(await evaluate(output, environment.fileSystem))
      .toMatchInlineSnapshot(`
        {
          "default": {
            "url": "file:///index.cjs",
          },
        }
      `);
  });

  it('does not add a import.meta.url shim when using the `module` format', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          export default {
            // @ts-expect-error - The 'import.meta' meta-property is not allowed.
            url: import.meta.url,
          };
        `,
      },
    });

    const output = compile({
      format: 'module',
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      "export default {
          // @ts-expect-error - The 'import.meta' meta-property is not allowed.
          url: import.meta.url,
      };
      "
    `);

    expect(await evaluate(output, environment.fileSystem))
      .toMatchInlineSnapshot(`
      {
        "default": {
          "url": "file:///index.mjs",
        },
      }
    `);
  });

  it('updates source maps with the correct file paths when using `module`', () => {
    const code = `
      export function hello() {
        return 'Hello, world!';
      }
    `;

    const tsconfig = getMockTsConfig({
      compilerOptions: {
        sourceMap: true,
      },
    });

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
      },
      tsconfig,
    });

    const output = compile({
      format: 'module',
      code,
      tsconfig,
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      "export function hello() {
          return 'Hello, world!';
      }
      //# sourceMappingURL=index.mjs.map"
    `);

    const sourceMap = environment.system.readFile('/index.mjs.map');
    expect(sourceMap).toMatchInlineSnapshot(
      `"{"version":3,"file":"index.mjs","sourceRoot":"","sources":["index.ts"],"names":[],"mappings":"AACM,MAAM,UAAU,KAAK;IACnB,OAAO,eAAe,CAAC;AACzB,CAAC"}"`,
    );
  });

  it('updates source maps with the correct file paths when using `commonjs`', () => {
    const code = `
      export function hello() {
        return 'Hello, world!';
      }
    `;

    const tsconfig = getMockTsConfig({
      compilerOptions: {
        sourceMap: true,
      },
    });

    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': code,
      },
      tsconfig,
    });

    const output = compile({
      format: 'commonjs',
      code,
      tsconfig,
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.hello = void 0;
      function hello() {
          return 'Hello, world!';
      }
      exports.hello = hello;
      //# sourceMappingURL=index.cjs.map"
    `);

    const sourceMap = environment.system.readFile('/index.cjs.map');
    expect(sourceMap).toMatchInlineSnapshot(
      `"{"version":3,"file":"index.cjs","sourceRoot":"","sources":["index.ts"],"names":[],"mappings":";;;AACM,SAAgB,KAAK;IACnB,OAAO,eAAe,CAAC;AACzB,CAAC;AAFD,sBAEC"}"`,
    );
  });

  it('rewrites named imports of CommonJS modules when using the `module` format', async () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': `
          import { foo } from 'commonjs-module';
          export default foo;
        `,
        ...getMockNodeModule({
          name: 'commonjs-module',
          packageJson: getMockPackageJson({
            name: 'commonjs-module',
            main: 'index.cjs',
          }),
          files: {
            'index.cjs': 'exports.foo = "foo";',
            'index.d.ts': 'export const foo: string;',
          },
        }),
      },
    });

    const output = compile({
      format: 'module',
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      "import $commonjsmodule from "commonjs-module";
      const { foo } = $commonjsmodule;
      export default foo;
      "
    `);
  });

  it('does not rewrite named imports of ES modules when using the `module` format', () => {
    const output = compile({
      format: 'module',
      code: `
        import { foo } from 'es-module';
        console.log(foo);
      `,
      extraFiles: {
        ...getMockNodeModule({
          name: 'es-module',
          files: {
            'index.mjs': 'exports.foo = "foo";',
            'index.d.mts': 'export const foo: string;',
          },
          packageJson: getMockPackageJson({
            name: 'es-module',
            main: 'index.mjs',
          }),
        }),
      },
    });

    expect(output).toMatchInlineSnapshot(`
      "import { foo } from "es-module";
      console.log(foo);
      "
    `);
  });

  it('does not rewrite named imports of CommonJS modules when using the `commonjs` format', () => {
    const output = compile({
      format: 'commonjs',
      code: `
        import { foo } from 'commonjs-module';
        console.log(foo);
      `,
      extraFiles: {
        ...getMockNodeModule({
          name: 'commonjs-module',
          files: {
            'index.js': 'exports.foo = "foo";',
            'index.d.ts': 'export const foo: string;',
          },
        }),
      },
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      const commonjs_module_1 = require("commonjs-module");
      console.log(commonjs_module_1.foo);
      "
    `);
  });

  it('creates a require function when using the `module` format', () => {
    const output = compile({
      format: 'module',
      code: `
        const { foo } = require('commonjs-module');
        console.log(foo);
      `,
      extraFiles: {
        ...getMockNodeModule({
          name: 'commonjs-module',
          files: {
            'index.js': 'exports.foo = "foo";',
            'index.d.ts': 'export const foo: string;',
          },
        }),
      },
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      import * as $nodeShims from "@ts-bridge/shims/esm/require";
      const { foo } = $nodeShims.require("commonjs-module", import.meta.url);
      console.log(foo);
      "
    `);
  });

  it('does not create a require function when using the `commonjs` format', () => {
    const output = compile({
      format: 'commonjs',
      code: `
        const { foo } = require('commonjs-module');
        console.log(foo);
      `,
      extraFiles: {
        ...getMockNodeModule({
          name: 'commonjs-module',
          files: {
            'index.js': 'exports.foo = "foo";',
            'index.d.ts': 'export const foo: string;',
          },
        }),
      },
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      const { foo } = require("commonjs-module");
      console.log(foo);
      "
    `);
  });

  it('builds a project using Node10 module resolution when using the `module` format', () => {
    const output = compile({
      format: 'module',
      code: `
        import { foo } from './foo';
        console.log(foo);
      `,
      extraFiles: {
        '/foo.ts': 'export const foo = "foo";',
      },
      tsconfig: getMockTsConfig({
        compilerOptions: {
          module: 'ES2022',
          moduleResolution: 'Node',
        },
      }),
    });

    expect(output).toMatchInlineSnapshot(`
      "import { foo } from "./foo.mjs";
      console.log(foo);
      "
    `);
  });

  it('builds a project using Node10 module resolution when using the `commonjs` format', () => {
    const output = compile({
      format: 'commonjs',
      code: `
        import { foo } from './foo';
        console.log(foo);
      `,
      extraFiles: {
        '/foo.ts': 'export const foo = "foo";',
      },
      tsconfig: getMockTsConfig({
        compilerOptions: {
          module: 'ES2022',
          moduleResolution: 'Node',
        },
      }),
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      const foo_1 = require("./foo.cjs");
      console.log(foo_1.foo);
      "
    `);
  });

  it('uses files from the `tsconfig.json`', () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
      tsconfig: getMockTsConfig({
        include: ['/index.ts'],
      }),
    });

    const output = compile({
      format: 'module',
      environment,
    });

    expect(output).toMatchInlineSnapshot(`
      ""use strict";
      // no-op
      "
    `);
  });

  it('removes the output directory if `clean` is enabled', () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
      },
      tsconfig: {
        compilerOptions: {
          outDir: '/non-existent',
        },
      },
    });

    compile({
      format: 'module',
      environment: {
        ...environment,
        system: {
          ...environment.system,
          createDirectory: noOp,
        },
      },
      clean: true,
      outputPath: '/non-existent/index',
    });

    expect(removeDirectory).toHaveBeenCalledWith('/non-existent', '/');
  });

  it('throws an error if the project fails to initialise', () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': 'import { foo } from "./foo";',
      },
      checkDiagnostic: false,
    });

    expect(() =>
      compile({
        format: 'module',
        environment,
      }),
    ).toThrow(
      "Cannot find module './foo' or its corresponding type declarations.",
    );
  });

  it('throws an error if the project fails to build', () => {
    const { program, system } = getVirtualEnvironment({
      files: {
        '/index.ts': 'import { foo } from "./foo";',
      },
      checkDiagnostic: false,
    });

    program.emit = () => ({
      emitSkipped: true,
      diagnostics: [
        {
          category: 1,
          code: 2307,
          messageText: "Cannot find module './foo'.",
          file: undefined,
          start: undefined,
          length: undefined,
        },
      ],
    });

    expect(() =>
      build({
        program,
        system,
        type: 'module',
        baseDirectory: '/',
      }),
    ).toThrow('Failed to build ES module files.');
  });
});

describe('getFiles', () => {
  it('returns the files from the `tsconfig.json` if custom files is empty', () => {
    const files = getFiles([], ['foo', 'bar']);

    expect(files).toStrictEqual(['foo', 'bar']);
  });

  it('returns the files from the `tsconfig.json` if custom files is undefined', () => {
    const files = getFiles(undefined, ['foo', 'bar']);

    expect(files).toStrictEqual(['foo', 'bar']);
  });

  it('returns the custom files', () => {
    const files = getFiles(['baz'], ['foo', 'bar']);

    expect(files).toStrictEqual(['baz']);
  });
});

describe('getTransformers', () => {
  it('returns the correct transformers for the `module` format', () => {
    const transformers = getTransformers(
      'module',
      {
        system: sys,
        // @ts-expect-error - The `typeChecker` parameter is invalid.
        typeChecker: {},
        baseDirectory: '/',
      },
      true,
    );

    expect(transformers).toHaveLength(4);
  });

  it('returns the correct transformers for the `commonjs` format', () => {
    const transformers = getTransformers(
      'commonjs',
      {
        system: sys,
        // @ts-expect-error - The `typeChecker` parameter is invalid.
        typeChecker: {},
        baseDirectory: '/',
      },
      true,
    );

    expect(transformers).toHaveLength(2);
  });

  it('returns the correct transformers for the `module` format without shims', () => {
    const transformers = getTransformers(
      'module',
      {
        system: sys,
        // @ts-expect-error - The `typeChecker` parameter is invalid.
        typeChecker: {},
        baseDirectory: '/',
      },
      false,
    );

    expect(transformers).toHaveLength(2);
  });

  it('returns the correct transformers for the `commonjs` format without shims', () => {
    const transformers = getTransformers(
      'commonjs',
      {
        system: sys,
        // @ts-expect-error - The `typeChecker` parameter is invalid.
        typeChecker: {},
        baseDirectory: '/',
      },
      false,
    );

    expect(transformers).toHaveLength(1);
  });
});
