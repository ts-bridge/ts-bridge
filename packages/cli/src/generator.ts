import type {
  TypeChecker,
  Node,
  Symbol,
  SourceFile,
  ImportDeclaration,
  Statement,
  System,
  ExportDeclaration,
} from 'typescript';
import typescript from 'typescript';

import { isCommonJs } from './module-resolver.js';
import { getIdentifierName } from './utils.js';

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
    // eslint-disable-next-line @typescript-eslint/ban-types
  ) as unknown as { parent?: Symbol };

  return foundSymbol?.parent?.escapedName === '__global';
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

  // If the named bindings are a named import, get the import names.
  const importNames = namedBindings.elements
    .filter((element) => !element.isTypeOnly)
    .map((element) => ({
      name: element.name.text,
      propertyName: element.propertyName?.text,
    }));

  if (importNames.length === 0) {
    return node;
  }

  const moduleSpecifier = getIdentifierName(node.moduleSpecifier.text);
  const importIdentifier = getUniqueIdentifier(
    typeChecker,
    sourceFile,
    moduleSpecifier,
  );

  // Create a new default import node.
  const wildcardImport = factory.createImportDeclaration(
    node.modifiers,
    factory.createImportClause(
      false,
      factory.createIdentifier(importIdentifier),
      undefined,
    ),
    node.moduleSpecifier,
  );

  // Create a variable declaration for the import names.
  const variableStatement = factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createObjectBindingPattern([
            ...importNames.map(({ propertyName, name }) =>
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

  return [wildcardImport, variableStatement];
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
 * @returns The import attributes.
 */
export function getImportAttribute(name: string, value: string) {
  /* istanbul ignore next if -- @preserve */
  if (hasImportAttributes()) {
    return factory.createImportAttributes(
      factory.createNodeArray([
        factory.createImportAttribute(
          factory.createIdentifier(name),
          factory.createStringLiteral(value),
        ),
      ]),
    );
  }

  /* istanbul ignore next -- @preserve */
  return factory.createAssertClause(
    factory.createNodeArray([
      factory.createAssertEntry(
        factory.createIdentifier(name),
        factory.createStringLiteral(value),
      ),
    ]),
  );
}
