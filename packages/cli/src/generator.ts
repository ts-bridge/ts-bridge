import type {
  TypeChecker,
  Node,
  SourceFile,
  ImportDeclaration,
  Statement,
  System,
  ExportDeclaration,
  NodeArray,
  ImportSpecifier,
} from 'typescript';
import typescript from 'typescript';

import { getCommonJsExports, isCommonJs } from './module-resolver.js';
import { getDefinedArray, getIdentifierName } from './utils.js';

const {
  factory,
  isNamedExports,
  isNamedImports,
  isNamespaceImport,
  isStringLiteral,
  NodeFlags,
  SymbolFlags,
  SyntaxKind,
} = typescript;

/**
 * Check if a symbol name is unique in the scope of the given node.
 *
 * @param typeChecker - The type checker to use.
 * @param node - The node to check.
 * @param symbolName - The name of the symbol to check.
 * @returns `true` if the symbol name is unique, or `false` otherwise.
 */
export function isUnique(
  typeChecker: TypeChecker,
  node: Node,
  symbolName: string,
) {
  const symbols = typeChecker.getSymbolsInScope(node, SymbolFlags.All);
  return (
    symbols.find(
      (symbol) =>
        symbol.escapedName === symbolName ||
        symbol.escapedName === `_${symbolName}`,
    ) === undefined
  );
}

/**
 * Check if a symbol is global.
 *
 * @param typeChecker - The type checker to use.
 * @param node - The node to check.
 * @param symbolName - The name of the symbol to check.
 * @returns `true` if the symbol is global, or `false` otherwise.
 */
export function isGlobal(
  typeChecker: TypeChecker,
  node: Node,
  symbolName: string,
) {
  const symbols = typeChecker.getSymbolsInScope(node, SymbolFlags.All);
  const foundSymbol = symbols.find(
    (symbol) =>
      symbol.escapedName === symbolName ||
      symbol.escapedName === `_${symbolName}`,
  );

  const declarations = getDefinedArray(foundSymbol?.getDeclarations());
  for (const declaration of declarations) {
    if (declaration.getSourceFile().isDeclarationFile) {
      return true;
    }
  }

  return false;
}

/**
 * Get a unique identifier given a source file and (expected) name. This will
 * try to get a name as close to the expected name as possible, and prepend an
 * underscore if necessary.
 *
 * @param typeChecker - The type checker to use.
 * @param sourceFile - The source file to get the unique identifier for.
 * @param name - The (expected) name to use.
 * @returns The unique identifier.
 */
export function getUniqueIdentifier(
  typeChecker: TypeChecker,
  sourceFile: SourceFile,
  name: string,
) {
  const escapedName = `$${name}`;
  if (isUnique(typeChecker, sourceFile, escapedName)) {
    return escapedName;
  }

  return getUniqueIdentifier(typeChecker, sourceFile, `_${name}`);
}

/**
 * An import declaration, containing the name of the import and an optional
 * property name.
 */
export type Import = {
  /**
   * The name of the import. This is the name that is available the scope of the
   * file containing the import. If the `propertyName` is not set, this is the
   * name that is exported by the module as well.
   */
  name: string;

  /**
   * The property name of the import. If this is set, this is the name that is
   * exported by the module.
   */
  propertyName?: string;
};

/**
 * An object with the detected and undetected imports.
 */
export type Imports = {
  /**
   * The detected imports, i.e., the named imports that are detected by
   * `cjs-module-lexer` and can be used as named imports in ES modules.
   */
  detected: Import[];

  /**
   * The other imports, i.e., the named imports that are not detected by
   * `cjs-module-lexer` and need to be imported as a default import and
   * destructured.
   */
  undetected: Import[];
};

/**
 * Get the detected and undetected imports for the given package specifier.
 * This function uses `cjs-module-lexer` to parse the CommonJS module and
 * extract the exports, and then compares the named imports to the exports to
 * determine which imports are detected and which are not.
 *
 * @param packageSpecifier - The specifier for the package.
 * @param system - The TypeScript system.
 * @param parentUrl - The URL of the parent module.
 * @param imports - The named imports from the import declaration.
 * @returns The "exported" imports and other imports.
 */
export function getImports(
  packageSpecifier: string,
  system: System,
  parentUrl: string,
  imports: NodeArray<ImportSpecifier>,
): Imports {
  const exports = getCommonJsExports(packageSpecifier, system, parentUrl);

  return imports.reduce<Imports>(
    (accumulator, element) => {
      if (element.isTypeOnly) {
        return accumulator;
      }

      const name = element.name.text;
      const propertyName = element.propertyName?.text;
      const exportName = propertyName ?? name;

      if (exports.includes(exportName)) {
        return {
          ...accumulator,
          detected: [...accumulator.detected, { name, propertyName }],
        };
      }

      return {
        ...accumulator,
        undetected: [...accumulator.undetected, { name, propertyName }],
      };
    },
    { detected: [], undetected: [] },
  );
}

/**
 * Get the named import node(s) for the given import declaration. This function
 * transforms named imports for CommonJS modules to a default import and a
 * variable declaration, so that the named imports can be used in ES modules.
 *
 * For example, the following import from a CommonJS module:
 * ```js
 * import { namedImport1, namedImport2 } from 'some-module';
 * ```
 *
 * will be transformed to:
 * ```js
 * import somemodule from 'some-module';
 * const { namedImport1, namedImport2 } = somemodule;
 * ```
 *
 * @param typeChecker - The type checker to use.
 * @param sourceFile - The source file to use.
 * @param node - The import declaration node.
 * @param system - The compiler system to use.
 * @returns The new node(s) for the named import.
 */
export function getNamedImportNodes(
  typeChecker: TypeChecker,
  sourceFile: SourceFile,
  node: ImportDeclaration,
  system: System,
): Statement | Statement[] {
  // If the import declaration does not have named bindings, return the node
  // as is.
  if (!node.importClause?.namedBindings) {
    return node;
  }

  const { namedBindings } = node.importClause;
  // If the named bindings are a namespace import, return the node as is.
  if (isNamespaceImport(namedBindings)) {
    return node;
  }

  // If the module specifier is not a string literal, return the node as is.
  if (!isStringLiteral(node.moduleSpecifier)) {
    return node;
  }

  // If the module specifier is not a CommonJS module, return the node as is.
  if (!isCommonJs(node.moduleSpecifier.text, system, sourceFile.fileName)) {
    return node;
  }

  const importNames = getImports(
    node.moduleSpecifier.text,
    system,
    sourceFile.fileName,
    namedBindings.elements,
  );

  // If there are no named imports, return the node as is.
  if (
    importNames.detected.length === 0 &&
    importNames.undetected.length === 0
  ) {
    return node;
  }

  // If there are no undetected imports, return the node as is.
  if (importNames.undetected.length === 0) {
    return node;
  }

  const moduleSpecifier = getIdentifierName(node.moduleSpecifier.text);
  const importIdentifier =
    // If the import declaration has a name (default import), use that name, to
    // avoid breaking the default import transformer.
    node.importClause.name?.text ??
    getUniqueIdentifier(typeChecker, sourceFile, moduleSpecifier);

  const statements: Statement[] = [];

  if (importNames.detected.length > 0) {
    // Create a new named import node for the detected imports.
    const namedImport = factory.createImportDeclaration(
      node.modifiers,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports(
          importNames.detected.map(({ propertyName, name }) =>
            factory.createImportSpecifier(
              false,
              propertyName ? factory.createIdentifier(propertyName) : undefined,
              factory.createIdentifier(name),
            ),
          ),
        ),
      ),
      node.moduleSpecifier,
    );

    statements.push(namedImport);
  }

  // Create a new default import node.
  const defaultImport = factory.createImportDeclaration(
    node.modifiers,
    factory.createImportClause(
      false,
      factory.createIdentifier(importIdentifier),
      undefined,
    ),
    node.moduleSpecifier,
  );

  // Create a variable declaration for the undetected import names.
  const variableStatement = factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createObjectBindingPattern([
            ...importNames.undetected.map(({ propertyName, name }) =>
              factory.createBindingElement(undefined, propertyName, name),
            ),
          ]),
          undefined,
          undefined,
          factory.createIdentifier(importIdentifier),
        ),
      ],
      // eslint-disable-next-line no-bitwise
      NodeFlags.Const,
    ),
  );

  statements.push(defaultImport, variableStatement);

  return statements;
}

/**
 * Get the import declaration without type-only imports.
 *
 * @param node - The import declaration node.
 * @returns The import declaration without type-only imports. If there are no
 * type-only imports, the node is returned as is.
 */
export function getNonTypeImports(node: ImportDeclaration) {
  if (
    !node.importClause?.namedBindings ||
    !isNamedImports(node.importClause.namedBindings)
  ) {
    return node;
  }

  const elements = node.importClause.namedBindings.elements.filter(
    (element) => !element.isTypeOnly,
  );

  if (elements.length === 0) {
    return undefined;
  }

  return factory.updateImportDeclaration(
    node,
    node.modifiers,
    factory.updateImportClause(
      node.importClause,
      false,
      node.importClause.name,
      factory.updateNamedImports(node.importClause.namedBindings, elements),
    ),
    node.moduleSpecifier,
    node.attributes,
  );
}

/**
 * Get the export declaration without type-only exports.
 *
 * @param node - The export declaration node.
 * @returns The export declaration without type-only exports. If there are no
 * type-only exports, the node is returned as is.
 */
export function getNonTypeExports(node: ExportDeclaration) {
  if (!node.exportClause || !isNamedExports(node.exportClause)) {
    return node;
  }

  const elements = node.exportClause.elements.filter(
    (element) => !element.isTypeOnly,
  );

  if (elements.length === 0) {
    return undefined;
  }

  return factory.updateExportDeclaration(
    node,
    node.modifiers,
    false,
    factory.updateNamedExports(node.exportClause, elements),
    node.moduleSpecifier,
    node.attributes,
  );
}

/**
 * Create a namespace import, e.g.:
 *
 * ```
 * import * as name from 'module';
 * ```
 *
 * @param name - The name of the namespace import.
 * @param module - The module to import.
 * @returns The namespace import.
 */
export function getNamespaceImport(name: string, module: string) {
  return factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      false,
      undefined,
      factory.createNamespaceImport(factory.createIdentifier(name)),
    ),
    factory.createStringLiteral(module),
    undefined,
  );
}

/**
 * Get `import.meta.url`. This is extracted into a function to reduce code
 * duplication.
 *
 * @returns The `import.meta.url` expression.
 */
export function getImportMetaUrl() {
  return factory.createPropertyAccessExpression(
    factory.createMetaProperty(
      SyntaxKind.ImportKeyword,
      factory.createIdentifier('meta'),
    ),
    factory.createIdentifier('url'),
  );
}

/**
 * Check if the TypeScript version supports import attributes.
 *
 * @returns `true` if the TypeScript version supports import attributes, or
 * `false` otherwise.
 */
export function hasImportAttributes() {
  return 'createImportAttributes' in factory;
}

/**
 * Get the import attributes for the given name and value.
 *
 * This function supports older versions of TypeScript by using import
 * assertions rather than import attributes, if necessary. Import assertions are
 * deprecated though, so it is recommended to use a recent version of TypeScript
 * that supports import attributes.
 *
 * @param name - The name of the attribute.
 * @param value - The value of the attribute.
 * @param useAttributes - Whether to use import attributes. By default, this is
 * determined by the {@link hasImportAttributes} function.
 * @returns The import attributes.
 */
export function getImportAttribute(
  name: string,
  value: string,
  useAttributes: boolean = hasImportAttributes(),
) {
  if (useAttributes) {
    return factory.createImportAttributes(
      factory.createNodeArray([
        factory.createImportAttribute(
          factory.createIdentifier(name),
          factory.createStringLiteral(value),
        ),
      ]),
    );
  }

  return factory.createAssertClause(
    factory.createNodeArray([
      factory.createAssertEntry(
        factory.createIdentifier(name),
        factory.createStringLiteral(value),
      ),
    ]),
  );
}
