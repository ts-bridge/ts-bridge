import chalk from 'chalk';
import { isBuiltin } from 'module';
import { dirname, relative, resolve } from 'path';
import type {
  CompilerOptions,
  TypeChecker,
  Node,
  Symbol,
  SourceFile,
  ImportDeclaration,
  System,
  ExportDeclaration,
} from 'typescript';
import typescript from 'typescript';

import { warn } from './logging.js';
import {
  getPackageJson,
  getPackageName,
  getPackagePath,
  isESModule,
} from './module-resolver.js';

const {
  factory,
  isNamedExports,
  isNamedImports,
  resolveModuleName,
  SymbolFlags,
  SyntaxKind,
} = typescript;

/**
 * The options for the `getImportPath` function.
 *
 * @property fileName - The file name of the source file.
 * @property importPath - The path to the file or module that is being imported.
 * @property compilerOptions - The compiler options for the TypeScript program.
 * @property extension - The new extension for source files.
 */
export type GetImportPathOptions = {
  fileName: string;
  importPath: string;
  compilerOptions: CompilerOptions;
  extension: string;
  baseDirectory: string;
  verbose?: boolean;
};

/**
 * Get the new import path for the given file and import path. This function
 * determines the new import path based on whether the module is an ECMAScript
 * module, whether the package has an `exports` field, or whether the given file
 * exists.
 *
 * @param options - The options for the function. See
 * {@link GetImportPathOptions}.
 * @param system - The compiler system to use.
 * @returns The new import path.
 */
export function getImportPath(options: GetImportPathOptions, system: System) {
  const {
    fileName,
    importPath,
    compilerOptions,
    extension,
    baseDirectory,
    verbose,
  } = options;

  if (isBuiltin(importPath)) {
    return importPath;
  }

  if (relative(importPath, '.') === '') {
    return `./index${extension}`;
  }

  const { resolvedModule } = resolveModuleName(
    importPath,
    fileName,
    compilerOptions,
    system,
  );

  // If the module is not resolved, return the import path as is.
  if (!resolvedModule) {
    verbose &&
      warn(
        `Could not resolve module: ${chalk.bold(
          `"${importPath}"`,
        )}. This means that TS Bridge will not update the import path, and the module may not be resolved correctly in some cases.`,
      );
    return importPath;
  }

  // If the import path is an external module, check if it is an ES module.
  if (resolvedModule.isExternalLibraryImport) {
    if (isESModule(importPath, system, baseDirectory)) {
      return importPath;
    }

    // If the `package.json` file has exports, we assume the import path can be
    // resolved as is.
    const packageName = getPackageName(importPath);
    const packageJson = getPackageJson(packageName, system, baseDirectory);
    if (packageJson?.exports) {
      return importPath;
    }

    const filePath = getPackagePath(importPath, system, baseDirectory);
    if (filePath) {
      return filePath;
    }

    return importPath;
  }

  // ES modules don't allow directory imports, so we append `index.{extension}`
  // if the import path is a directory.
  if (
    relative(dirname(fileName), dirname(resolvedModule.resolvedFileName)) !==
      '' &&
    system.directoryExists(resolve(dirname(fileName), importPath))
  ) {
    return `${importPath}/index${extension}`;
  }

  const importName = importPath.replace(/\.(?:js|ts|mjs|cjs)$/u, '');
  return `${importName}${extension}`;
}

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
