import {
  getMockNodeModule,
  getMockPackageJson,
  getVirtualEnvironment,
  noOp,
} from '@ts-bridge/test-utils';
import type {
  ExportDeclaration,
  ImportDeclaration,
  SourceFile,
  Statement,
} from 'typescript';
import typescript from 'typescript';
import { describe, expect, it, vi } from 'vitest';

import {
  getImportMetaUrl,
  getImportPath,
  getNamedImportNodes,
  getNamespaceImport,
  getNonTypeExports,
  getNonTypeImports,
  getUniqueIdentifier,
} from './generator.js';

const { factory } = typescript;

/**
 * Compile a statement. This is used to test the output of the generator
 * functions.
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

describe('getImportPath', () => {
  const { program, system } = getVirtualEnvironment({
    files: {
      '/index.ts': '// no-op',
      '/foo.ts': '// no-op',
      '/bar/index.ts': '// no-op',
      ...getMockNodeModule({
        name: 'globals',
        files: {
          'index.js': '// no-op',
        },
      }),
    },
  });

  it('returns the import path for a built-in module as is', () => {
    expect(
      getImportPath(
        {
          fileName: '/index.ts',
          importPath: 'module',
          compilerOptions: program.getCompilerOptions(),
          extension: '.js',
          baseDirectory: '/',
        },
        system,
      ),
    ).toBe('module');
  });

  it('returns the import path for a non-JS file as is', () => {
    expect(
      getImportPath(
        {
          fileName: '/index.ts',
          importPath: './file.json',
          compilerOptions: program.getCompilerOptions(),
          extension: '.js',
          baseDirectory: '/',
        },
        system,
      ),
    ).toBe('./file.json');
  });

  it('returns the import path for an unresolved module as is', () => {
    expect(
      getImportPath(
        {
          fileName: '/index.ts',
          importPath: 'foo-module',
          compilerOptions: program.getCompilerOptions(),
          extension: '.js',
          baseDirectory: '/',
        },
        system,
      ),
    ).toBe('foo-module');
  });

  it('returns the import path for an external module as is', () => {
    expect(
      getImportPath(
        {
          fileName: '/index.ts',
          // `@types/semver` is included by `getVirtualEnvironment`.
          importPath: 'semver',
          compilerOptions: program.getCompilerOptions(),
          extension: '.js',
          baseDirectory: '/',
        },
        system,
      ),
    ).toBe('semver');
  });

  it('returns the import path for an external module with a file specifier', () => {
    expect(
      getImportPath(
        {
          fileName: '/index.ts',
          importPath: 'globals/index',
          compilerOptions: program.getCompilerOptions(),
          extension: '.js',
          baseDirectory: '/',
        },
        system,
      ),
    ).toBe('globals/index.js');
  });

  it('returns the import path for an external module with a file specifier, and the `package.json` has exports', () => {
    const environment = getVirtualEnvironment({
      files: {
        '/index.ts': '// no-op',
        '/foo.ts': '// no-op',
        ...getMockNodeModule({
          name: 'globals',
          packageJson: getMockPackageJson({
            name: 'globals',
            exports: {
              './index': {
                types: './index.d.ts',
                default: './index.js',
              },
            },
          }),
          files: {
            'index.js': '// no-op',
            'index.d.ts': '// no-op',
          },
        }),
      },
    });

    expect(
      getImportPath(
        {
          fileName: '/index.ts',
          importPath: 'globals/index',
          compilerOptions: environment.program.getCompilerOptions(),
          extension: '.js',
          baseDirectory: '/',
        },
        environment.system,
      ),
    ).toBe('globals/index');
  });

  it('returns the import path for a local file with the new extension', () => {
    expect(
      getImportPath(
        {
          fileName: '/index.ts',
          importPath: './foo.js',
          compilerOptions: program.getCompilerOptions(),
          extension: '.mjs',
          baseDirectory: '/',
        },
        system,
      ),
    ).toBe('./foo.mjs');
  });

  it('returns the import path for a local directory and appends the index file', () => {
    expect(
      getImportPath(
        {
          fileName: '/index.ts',
          importPath: './bar',
          compilerOptions: program.getCompilerOptions(),
          extension: '.mjs',
          baseDirectory: '/',
        },
        system,
      ),
    ).toBe('./bar/index.mjs');
  });

  it('returns the import path for a local directory one level down and appends the index file', () => {
    expect(
      getImportPath(
        {
          fileName: '/foo/index.ts',
          importPath: '../bar',
          compilerOptions: program.getCompilerOptions(),
          extension: '.mjs',
          baseDirectory: '/',
        },
        system,
      ),
    ).toBe('../bar/index.mjs');
  });

  it('returns the import path for a local file and adds an extension', () => {
    expect(
      getImportPath(
        {
          fileName: '/index.ts',
          importPath: './foo',
          compilerOptions: program.getCompilerOptions(),
          extension: '.mjs',
          baseDirectory: '/',
        },
        system,
      ),
    ).toBe('./foo.mjs');
  });

  it('returns the import path for the local index file and adds an extension', () => {
    expect(
      getImportPath(
        {
          fileName: '/index.ts',
          importPath: '.',
          compilerOptions: program.getCompilerOptions(),
          extension: '.mjs',
          baseDirectory: '/',
        },
        system,
      ),
    ).toBe('./index.mjs');
  });

  it('returns the import path for the local index file with a slash and adds an extension', () => {
    expect(
      getImportPath(
        {
          fileName: '/index.ts',
          importPath: './',
          compilerOptions: program.getCompilerOptions(),
          extension: '.mjs',
          baseDirectory: '/',
        },
        system,
      ),
    ).toBe('./index.mjs');
  });

  it('logs a warning if the import path fails to resolve, and `verbose` is enabled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(noOp);

    expect(
      getImportPath(
        {
          fileName: '/index.ts',
          importPath: 'foo-module',
          compilerOptions: program.getCompilerOptions(),
          extension: '.js',
          baseDirectory: '/',
          verbose: true,
        },
        system,
      ),
    ).toBe('foo-module');

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not resolve module'),
    );
  });
});

describe('getUniqueIdentifier', () => {
  const { program, typeChecker } = getVirtualEnvironment({
    files: {
      '/index.ts': '// no-op',
      '/one.ts': 'export const $name: number = 1;',
      '/two.ts': `
        export const $name = 1;
        export const $_name = 2;
      `,
    },
  });

  it('returns a safe name when the identifier is unique', () => {
    const sourceFile = program.getSourceFile('/index.ts') as SourceFile;
    expect(getUniqueIdentifier(typeChecker, sourceFile, 'name')).toBe('$name');
  });

  it('adds an underscore if the new name is not unique', () => {
    const sourceFile = program.getSourceFile('/one.ts') as SourceFile;
    expect(getUniqueIdentifier(typeChecker, sourceFile, 'name')).toBe('$_name');
  });

  it('recursively adds underscores if the name is not unique', () => {
    const sourceFile = program.getSourceFile('/two.ts') as SourceFile;
    expect(getUniqueIdentifier(typeChecker, sourceFile, 'name')).toBe(
      '$__name',
    );
  });
});

describe('getNamedImportNodes', () => {
  const { program, typeChecker, system } = getVirtualEnvironment({
    files: {
      '/index.ts': '// no-op',
      '/foo.ts': 'export const $foo: number = 1;',
    },
  });

  it('transforms named bindings into a default import', () => {
    const sourceFile = program.getSourceFile('/index.ts') as SourceFile;
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports([
          factory.createImportSpecifier(
            false,
            undefined,
            factory.createIdentifier('foo'),
          ),
          factory.createImportSpecifier(
            false,
            undefined,
            factory.createIdentifier('bar'),
          ),
        ]),
      ),
      factory.createStringLiteral('foo'),
      undefined,
    );

    const result = getNamedImportNodes(
      typeChecker,
      sourceFile,
      importDeclaration,
      '/',
      system,
    );

    expect(result).not.toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import $foo from "foo";
      const { foo, bar } = $foo;
      "
    `);
  });

  it('transforms named bindings into a default import and removes type imports', () => {
    const sourceFile = program.getSourceFile('/index.ts') as SourceFile;
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports([
          factory.createImportSpecifier(
            false,
            undefined,
            factory.createIdentifier('foo'),
          ),
          factory.createImportSpecifier(
            false,
            undefined,
            factory.createIdentifier('bar'),
          ),
          factory.createImportSpecifier(
            true,
            undefined,
            factory.createIdentifier('baz'),
          ),
        ]),
      ),
      factory.createStringLiteral('foo'),
      undefined,
    );

    const result = getNamedImportNodes(
      typeChecker,
      sourceFile,
      importDeclaration,
      '/',
      system,
    );

    expect(result).not.toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import $foo from "foo";
      const { foo, bar } = $foo;
      "
    `);
  });

  it('keeps the import name the same', () => {
    const sourceFile = program.getSourceFile('/index.ts') as SourceFile;
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports([
          factory.createImportSpecifier(
            false,
            factory.createIdentifier('a'),
            factory.createIdentifier('foo'),
          ),
          factory.createImportSpecifier(
            false,
            factory.createIdentifier('b'),
            factory.createIdentifier('bar'),
          ),
        ]),
      ),
      factory.createStringLiteral('foo'),
      undefined,
    );

    const result = getNamedImportNodes(
      typeChecker,
      sourceFile,
      importDeclaration,
      '/',
      system,
    );

    expect(result).not.toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import $foo from "foo";
      const { a: foo, b: bar } = $foo;
      "
    `);
  });

  it('renames the import identifier if it already exists', () => {
    const sourceFile = program.getSourceFile('/foo.ts') as SourceFile;
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports([
          factory.createImportSpecifier(
            false,
            undefined,
            factory.createIdentifier('foo'),
          ),
          factory.createImportSpecifier(
            false,
            undefined,
            factory.createIdentifier('bar'),
          ),
        ]),
      ),
      factory.createStringLiteral('foo'),
      undefined,
    );

    const result = getNamedImportNodes(
      typeChecker,
      sourceFile,
      importDeclaration,
      '/',
      system,
    );

    expect(result).not.toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import $_foo from "foo";
      const { foo, bar } = $_foo;
      "
    `);
  });

  it('returns the same node if the import specifier is not a string literal', () => {
    const sourceFile = program.getSourceFile('/index.ts') as SourceFile;
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports([
          factory.createImportSpecifier(
            false,
            undefined,
            factory.createIdentifier('foo'),
          ),
        ]),
      ),
      factory.createIdentifier('bar'),
      undefined,
    );

    const result = getNamedImportNodes(
      typeChecker,
      sourceFile,
      importDeclaration,
      '/',
      system,
    );

    expect(result).toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import { foo } from bar;
      "
    `);
  });

  it('returns the same node if the node is a namespace import', () => {
    const sourceFile = program.getSourceFile('/index.ts') as SourceFile;
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamespaceImport(factory.createIdentifier('foo')),
      ),
      factory.createStringLiteral('bar'),
      undefined,
    );

    const result = getNamedImportNodes(
      typeChecker,
      sourceFile,
      importDeclaration,
      '/',
      system,
    );

    expect(result).toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import * as foo from "bar";
      "
    `);
  });

  it('returns the same node if the node does not have an import clause', () => {
    const sourceFile = program.getSourceFile('/index.ts') as SourceFile;
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      undefined,
      factory.createStringLiteral('bar'),
      undefined,
    );

    const result = getNamedImportNodes(
      typeChecker,
      sourceFile,
      importDeclaration,
      '/',
      system,
    );

    expect(result).toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import "bar";
      "
    `);
  });

  it('returns the same node if the imported module is an ES module', () => {
    const sourceFile = program.getSourceFile('/index.ts') as SourceFile;
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        factory.createIdentifier('bar'),
        undefined,
      ),
      // Built-ins are always considered ES modules.
      factory.createStringLiteral('module'),
      undefined,
    );

    const result = getNamedImportNodes(
      typeChecker,
      sourceFile,
      importDeclaration,
      '/',
      system,
    );

    expect(result).toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import bar from "module";
      "
    `);
  });

  it('returns the same node if the named bindings are empty', () => {
    const sourceFile = program.getSourceFile('/index.ts') as SourceFile;
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports([]),
      ),
      factory.createStringLiteral('foo'),
      undefined,
    );

    const result = getNamedImportNodes(
      typeChecker,
      sourceFile,
      importDeclaration,
      '/',
      system,
    );

    expect(result).toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import {} from "foo";
      "
    `);
  });
});

describe('getNonTypeImports', () => {
  it('removes type imports from an import declaration', () => {
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports([
          factory.createImportSpecifier(
            true,
            undefined,
            factory.createIdentifier('foo'),
          ),
          factory.createImportSpecifier(
            false,
            undefined,
            factory.createIdentifier('bar'),
          ),
        ]),
      ),
      factory.createStringLiteral('foo'),
      undefined,
    );

    const result = getNonTypeImports(importDeclaration);

    expect(result).not.toBeUndefined();
    expect(result).not.toStrictEqual(importDeclaration);
    expect(compile(result as ImportDeclaration)).toMatchInlineSnapshot(`
      ""use strict";
      import { bar } from "foo";
      "
    `);
  });

  it('returns the same node if the import declaration is not a named import', () => {
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamespaceImport(factory.createIdentifier('foo')),
      ),
      factory.createStringLiteral('bar'),
      undefined,
    );

    const result = getNonTypeImports(importDeclaration);
    expect(result).toBe(importDeclaration);
  });

  it('returns the same node if there is no import clause', () => {
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      undefined,
      factory.createStringLiteral('foo'),
      undefined,
    );

    const result = getNonTypeImports(importDeclaration);
    expect(result).toBe(importDeclaration);
  });

  it('returns `undefined` if there are no non-type named imports', () => {
    const importDeclaration = factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports([
          factory.createImportSpecifier(
            true,
            undefined,
            factory.createIdentifier('foo'),
          ),
          factory.createImportSpecifier(
            true,
            undefined,
            factory.createIdentifier('bar'),
          ),
        ]),
      ),
      factory.createStringLiteral('bar'),
      undefined,
    );

    const result = getNonTypeImports(importDeclaration);
    expect(result).toBeUndefined();
  });
});

describe('getNonTypeExports', () => {
  it('removes type exports from an export declaration', () => {
    const exportDeclaration = factory.createExportDeclaration(
      undefined,
      false,
      factory.createNamedExports([
        factory.createExportSpecifier(
          true,
          undefined,
          factory.createIdentifier('foo'),
        ),
        factory.createExportSpecifier(
          false,
          undefined,
          factory.createIdentifier('bar'),
        ),
      ]),
    );

    const result = getNonTypeExports(exportDeclaration);

    expect(result).not.toBeUndefined();
    expect(result).not.toStrictEqual(exportDeclaration);
    expect(compile(result as ExportDeclaration)).toMatchInlineSnapshot(`
      ""use strict";
      export { bar };
      "
    `);
  });

  it('returns the same node if the export declaration is not a named export', () => {
    const exportDeclaration = factory.createExportDeclaration(
      undefined,
      false,
      factory.createNamespaceExport(factory.createIdentifier('foo')),
    );

    const result = getNonTypeExports(exportDeclaration);
    expect(result).toBe(exportDeclaration);
  });

  it('returns the same node if there is no export clause', () => {
    const exportDeclaration = factory.createExportDeclaration(
      undefined,
      false,
      undefined,
    );

    const result = getNonTypeExports(exportDeclaration);
    expect(result).toBe(exportDeclaration);
  });

  it('returns `undefined` if there are no non-type named exports', () => {
    const exportDeclaration = factory.createExportDeclaration(
      undefined,
      false,
      factory.createNamedExports([
        factory.createExportSpecifier(
          true,
          undefined,
          factory.createIdentifier('foo'),
        ),
        factory.createExportSpecifier(
          true,
          undefined,
          factory.createIdentifier('bar'),
        ),
      ]),
    );

    const result = getNonTypeExports(exportDeclaration);
    expect(result).toBeUndefined();
  });
});

describe('getNamespaceImport', () => {
  it('returns a namespace import', () => {
    const node = getNamespaceImport('name', 'module');
    const code = compile(node);

    expect(code).toMatchInlineSnapshot(`
      ""use strict";
      import * as name from "module";
      "
    `);
  });
});

describe('getImportMetaUrl', () => {
  it('returns an import.meta.url expression', () => {
    const node = getImportMetaUrl();
    const statement = factory.createExpressionStatement(node);

    const code = compile(statement);

    expect(code).toMatchInlineSnapshot(`
      ""use strict";
      import.meta.url;
      "
    `);
  });
});
