import { resolve } from '@ts-bridge/resolver';
import { getFixture, getVirtualEnvironment } from '@ts-bridge/test-utils';
import type {
  ExportDeclaration,
  ImportDeclaration,
  SourceFile,
  Statement,
} from 'typescript';
import typescript from 'typescript';
import { describe, expect, it, vi } from 'vitest';

import {
  getImportAttribute,
  getImportMetaUrl,
  getImports,
  getNamedImportNodes,
  getNamespaceImport,
  getNonTypeExports,
  getNonTypeImports,
  getUniqueIdentifier,
  hasImportAttributes,
} from './generator.js';

const { factory, isAssertClause, isImportAttributes, sys } = typescript;

// TODO: Change these tests to use the real file system, to avoid the need for
// mocking the resolver.
vi.mock('@ts-bridge/resolver', () => ({
  resolve: vi.fn().mockImplementation(() => ({
    format: 'commonjs',
    path: '/fake.js',
  })),
}));

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

describe('getImports', () => {
  it('returns the imports from an import declaration', () => {
    const resolveMock = vi.mocked(resolve);
    resolveMock.mockReturnValueOnce({
      format: 'commonjs',
      path: getFixture(
        'named-imports',
        'packages',
        'commonjs-module',
        'index.js',
      ),
    });

    const imports = getImports(
      'commonjs-module',
      sys,
      getFixture('named-imports', 'src', 'index.ts'),
      factory.createNodeArray([
        factory.createImportSpecifier(
          false,
          factory.createIdentifier('foo'),
          factory.createIdentifier('bar'),
        ),
        factory.createImportSpecifier(
          false,
          undefined,
          factory.createIdentifier('baz'),
        ),
      ]),
    );

    expect(imports.detected).toStrictEqual([
      {
        name: 'bar',
        propertyName: 'foo',
      },
    ]);

    expect(imports.undetected).toStrictEqual([
      {
        name: 'baz',
        propertyName: undefined,
      },
    ]);
  });
});

describe('getNamedImportNodes', () => {
  const { program, typeChecker, system } = getVirtualEnvironment({
    files: {
      '/index.ts': '// no-op',
      '/foo.ts': 'export const $foo: number = 1;',
      '/fake.js': 'module.exports.foo = 1;',
      '/invalid.js': `
        import typeof Bar from './Bar';
        module.exports = {
          get foo(): Bar {
            return 'foo';
          },
        };
      `,
    },
  });

  it('transforms undetected named bindings into a default import', () => {
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
            factory.createIdentifier('undetected'),
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
      system,
    );

    expect(result).not.toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import { foo } from "foo";
      import $foo from "foo";
      const { undetected } = $foo;
      "
    `);
  });

  it('removes type imports', () => {
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
      system,
    );

    expect(result).not.toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import { foo } from "foo";
      import $foo from "foo";
      const { bar } = $foo;
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
      system,
    );

    expect(result).not.toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import { foo } from "foo";
      import $_foo from "foo";
      const { bar } = $_foo;
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
      system,
    );

    expect(result).toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import {} from "foo";
      "
    `);
  });

  it('returns the same node if the file cannot be parsed', () => {
    const resolveMock = vi.mocked(resolve);
    resolveMock
      .mockReturnValueOnce({
        format: 'commonjs',
        path: '/invalid.js',
      })
      .mockReturnValueOnce({
        format: 'commonjs',
        path: '/invalid.js',
      });

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
            factory.createIdentifier('undetected'),
          ),
        ]),
      ),
      factory.createStringLiteral('invalid'),
      undefined,
    );

    const result = getNamedImportNodes(
      typeChecker,
      sourceFile,
      importDeclaration,
      system,
    );

    expect(result).toBe(importDeclaration);
    expect(compile(result)).toMatchInlineSnapshot(`
      ""use strict";
      import { foo, undetected } from "invalid";
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

describe('getImportAttribute', () => {
  // For compatibility with TypeScript <5.3, we have to check if the factory
  // function exists before running the test.
  it.runIf(hasImportAttributes())('returns an import attribute', () => {
    expect(isImportAttributes(getImportAttribute('type', 'json'))).toBe(true);
    expect(isImportAttributes(getImportAttribute('type', 'json', true))).toBe(
      true,
    );
  });

  it('returns an assert clause if the factory function does not exist', () => {
    const node = getImportAttribute('type', 'json', false);
    expect(isAssertClause(node)).toBe(true);
  });
});
