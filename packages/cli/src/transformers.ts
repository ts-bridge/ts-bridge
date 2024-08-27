import type { FileFormat } from '@ts-bridge/resolver';
import type {
  Bundle,
  CustomTransformer,
  Node,
  ResolutionMode,
  SourceFile,
  System,
  TransformationContext,
  Transformer,
  TypeChecker,
} from 'typescript';
import typescript from 'typescript';

import {
  getImportAttribute,
  getImportMetaUrl,
  getNamedImportNodes,
  getNonTypeExports,
  getNonTypeImports,
  getUniqueIdentifier,
  isGlobal,
} from './generator.js';
import { getImportDefaultHelper } from './helpers.js';
import { getModulePath, getModuleType, isCommonJs } from './module-resolver.js';
import {
  getDirnameGlobalFunction,
  getDirnameHelperFunction,
  getFileUrlToPathHelperFunction,
  getImportMetaUrlFunction,
  getRequireHelperFunction,
} from './shims.js';

const {
  factory,
  isBindingElement,
  isCallExpression,
  isExportDeclaration,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isMetaProperty,
  isPropertyAccessExpression,
  isStringLiteral,
  isVariableDeclaration,
  NodeFlags,
  visitEachChild,
  visitNode,
  SyntaxKind,
} = typescript;

/**
 * The options for the transformer functions.
 *
 * @property typeChecker - The type checker to use.
 * @property system - The compiler system to use.
 * @property baseDirectory - The base directory to start resolving from.
 */
export type TransformerOptions = {
  typeChecker: TypeChecker;
  system: System;
  verbose?: boolean;
};

/**
 * Get a transformer that updates the import extensions to append the given
 * extension.
 *
 * For example, the following import declaration:
 * ```js
 * import { foo } from './foo.js';
 * ```
 *
 * will be transformed to (assuming the extension is `.mjs`):
 * ```js
 * import { foo } from './foo.mjs';
 * ```
 *
 * @param extension - The extension to append to import paths.
 * @param options - The transformer options.
 * @param options.system - The compiler system to use.
 * @param options.verbose - Whether to enable verbose logging.
 * @returns The transformer function.
 */
export function getImportExtensionTransformer(
  extension: string,
  { system, verbose }: TransformerOptions,
) {
  return (context: TransformationContext): CustomTransformer => {
    // This returns a custom transformer instead of a transformer factory, as
    // this transformer is used for declaration files, which requires support
    // for bundle transformations (even though we don't use it here).
    return {
      transformSourceFile(sourceFile: SourceFile): SourceFile {
        const visitor = (node: Node): Node => {
          if (
            node.parent &&
            isStringLiteral(node) &&
            isImportDeclaration(node.parent)
          ) {
            const importPath = getModulePath({
              packageSpecifier: node.text,
              parentUrl: sourceFile.fileName,
              extension,
              system,
              verbose,
            });

            return factory.createStringLiteral(importPath);
          }

          return visitEachChild(node, visitor, context);
        };

        return visitNode(sourceFile, visitor) as SourceFile;
      },

      /* istanbul ignore next 3 */
      transformBundle(bundle: Bundle): Bundle {
        return bundle;
      },
    };
  };
}

/**
 * Get a transformer that updates the `require` calls to use the given
 * extension.
 *
 * For example, the following `require` call:
 * ```js
 * const foo = require('./foo.js');
 * ```
 *
 * will be transformed to (assuming the extension is `.mjs`):
 * ```js
 * const foo = require('./foo.mjs');
 * ```
 *
 * @param extension - The new extension for the `require` calls.
 * @param options - The transformer options.
 * @param options.typeChecker - The type checker to use.
 * @param options.system - The compiler system to use.
 * @param options.verbose - Whether to enable verbose logging.
 * @returns The transformer function.
 */
export function getRequireExtensionTransformer(
  extension: string,
  { typeChecker, system, verbose }: TransformerOptions,
) {
  return (context: TransformationContext): Transformer<SourceFile> => {
    return (sourceFile: SourceFile) => {
      const visitor = (node: Node): Node => {
        if (
          node.parent &&
          isStringLiteral(node) &&
          isCallExpression(node.parent) &&
          isIdentifier(node.parent.expression) &&
          node.parent.expression.text === 'require' &&
          isGlobal(typeChecker, node, 'require')
        ) {
          const importPath = getModulePath({
            packageSpecifier: node.text,
            parentUrl: sourceFile.fileName,
            extension,
            system,
            verbose,
          });

          return factory.createStringLiteral(importPath);
        }

        return visitEachChild(node, visitor, context);
      };

      return visitNode(sourceFile, visitor) as SourceFile;
    };
  };
}

/**
 * Get a transformer that updates the export extensions to append the given
 * extension.
 *
 * For example, the following export declaration:
 * ```js
 * export * from './foo.js';
 * ```
 *
 * will be transformed to (assuming the extension is `.mjs`):
 * ```js
 * export * from './foo.mjs';
 * ```
 *
 * @param extension - The extension to append to export paths.
 * @param options - The transformer options.
 * @param options.system - The compiler system to use.
 * @param options.verbose - Whether to enable verbose logging.
 * @returns The transformer function.
 */
export function getExportExtensionTransformer(
  extension: string,
  { system, verbose }: TransformerOptions,
) {
  return (context: TransformationContext): CustomTransformer => {
    // This returns a custom transformer instead of a transformer factory, as
    // this transformer is used for declaration files, which requires support
    // for bundle transformations (even though we don't use it here).
    return {
      transformSourceFile(sourceFile: SourceFile): SourceFile {
        const visitor = (node: Node): Node => {
          if (
            node.parent &&
            isStringLiteral(node) &&
            isExportDeclaration(node.parent)
          ) {
            const importPath = getModulePath({
              packageSpecifier: node.text,
              parentUrl: sourceFile.fileName,
              extension,
              system,
              verbose,
            });

            return factory.createStringLiteral(importPath);
          }

          return visitEachChild(node, visitor, context);
        };

        return visitNode(sourceFile, visitor) as SourceFile;
      },

      /* istanbul ignore next 3 */
      transformBundle(bundle: Bundle): Bundle {
        return bundle;
      },
    };
  };
}

/**
 * Get a transformer that updates `__filename`, `__dirname` to an ES-compatible
 * version using `import.meta.url`.
 *
 * For example, the following statement:
 * ```ts
 * const foo = __filename;
 * ```
 *
 * will be transformed to:
 * ```ts
 * function $__filename(url) {
 *   // ...;
 * }
 *
 * const foo = $__filename(import.meta.url);
 * ```
 *
 * This should only be used for the ES module target.
 *
 * @param options - The transformer options.
 * @param options.typeChecker - The type checker to use.
 * @returns The transformer function.
 */
export function getGlobalsTransformer({ typeChecker }: TransformerOptions) {
  return (context: TransformationContext): Transformer<SourceFile> => {
    return (sourceFile: SourceFile) => {
      let insertFilenameShim = false;
      let insertDirnameShim = false;

      const dirnameHelperFunctionName = getUniqueIdentifier(
        typeChecker,
        sourceFile,
        'getDirname',
      );

      const fileUrlToPathFunctionName = getUniqueIdentifier(
        typeChecker,
        sourceFile,
        '__filename',
      );

      const dirnameFunctionName = getUniqueIdentifier(
        typeChecker,
        sourceFile,
        '__dirname',
      );

      const visitor = (node: Node): Node => {
        if (
          isIdentifier(node) &&
          node.text === '__filename' &&
          !isVariableDeclaration(node.parent) &&
          !isBindingElement(node.parent) &&
          !isFunctionDeclaration(node.parent) &&
          isGlobal(typeChecker, node, '__filename')
        ) {
          insertFilenameShim = true;
          return factory.createCallExpression(
            factory.createIdentifier(fileUrlToPathFunctionName),
            undefined,
            [getImportMetaUrl()],
          );
        }

        if (
          isIdentifier(node) &&
          node.text === '__dirname' &&
          !isVariableDeclaration(node.parent) &&
          !isBindingElement(node.parent) &&
          !isFunctionDeclaration(node.parent) &&
          isGlobal(typeChecker, node.parent, '__dirname')
        ) {
          insertDirnameShim = true;
          return factory.createCallExpression(
            factory.createIdentifier(dirnameFunctionName),
            undefined,
            [getImportMetaUrl()],
          );
        }

        return visitEachChild(node, visitor, context);
      };

      const modifiedSourceFile = visitNode(sourceFile, visitor) as SourceFile;

      const statements = [];
      if (insertDirnameShim) {
        statements.push(getDirnameHelperFunction(dirnameHelperFunctionName));
        statements.push(
          getDirnameGlobalFunction(
            dirnameFunctionName,
            fileUrlToPathFunctionName,
            dirnameHelperFunctionName,
          ),
        );
      }

      if (insertFilenameShim || insertDirnameShim) {
        statements.unshift(
          getFileUrlToPathHelperFunction(fileUrlToPathFunctionName),
        );

        return factory.updateSourceFile(modifiedSourceFile, [
          ...statements,
          ...modifiedSourceFile.statements,
        ]);
      }

      return modifiedSourceFile;
    };
  };
}

/**
 * Get a transformer that updates `require` to an ES-compatible version using
 * `createRequire` and `import.meta.url`.
 *
 * For example, the following statement:
 * ```ts
 * const foo = require('bar');
 * ```
 *
 * will be transformed to:
 * ```ts
 * function require(path, url) {
 *   // ...;
 * }
 *
 * const foo = require('bar', import.meta.url);
 * ```
 *
 * This should only be used for the ES module target.
 *
 * @param options - The transformer options.
 * @param options.typeChecker - The type checker to use.
 * @returns The transformer function.
 */
export const getRequireTransformer = ({ typeChecker }: TransformerOptions) => {
  return (context: TransformationContext): Transformer<SourceFile> => {
    return (sourceFile: SourceFile) => {
      let insertShim = false;

      const createRequireFunctionName = getUniqueIdentifier(
        typeChecker,
        sourceFile,
        'createRequire',
      );

      const visitor = (node: Node): Node => {
        if (
          isCallExpression(node) &&
          isIdentifier(node.expression) &&
          node.expression.text === 'require' &&
          isGlobal(typeChecker, node, 'require') &&
          node.arguments[0]
        ) {
          insertShim = true;
          return factory.createCallExpression(
            factory.createIdentifier('require'),
            undefined,
            [node.arguments[0], getImportMetaUrl()],
          );
        }

        return visitEachChild(node, visitor, context);
      };

      const modifiedSourceFile = visitNode(sourceFile, visitor) as SourceFile;

      if (insertShim) {
        return factory.updateSourceFile(modifiedSourceFile, [
          ...getRequireHelperFunction(createRequireFunctionName),
          ...modifiedSourceFile.statements,
        ]);
      }

      return modifiedSourceFile;
    };
  };
};

/**
 * Get a transformer that updates `import.meta.url` to a CommonJS-compatible
 * version using `__filename`.
 *
 * For example, the following statement:
 * ```ts
 * const foo = import.meta.url;
 * ```
 *
 * will be transformed to:
 * ```ts
 * function getImportMetaUrl(filename) {
 *   // ...;
 * }
 *
 * const foo = getImportMetaUrl(__filename);
 * ```
 *
 * This should only be used for the CommonJS target.
 *
 * @param options - The transformer options.
 * @param options.typeChecker - The type checker to use.
 * @returns The transformer function.
 */
export function getImportMetaTransformer({ typeChecker }: TransformerOptions) {
  return (context: TransformationContext): Transformer<SourceFile> => {
    return (sourceFile: SourceFile) => {
      let insertShim = false;
      const functionName = getUniqueIdentifier(
        typeChecker,
        sourceFile,
        'getImportMetaUrl',
      );

      const visitor = (node: Node): Node => {
        if (
          isPropertyAccessExpression(node) &&
          isMetaProperty(node.expression) &&
          node.expression.keywordToken === SyntaxKind.ImportKeyword &&
          node.name.text === 'url'
        ) {
          insertShim = true;
          return factory.createCallExpression(
            factory.createIdentifier(functionName),
            undefined,
            [factory.createIdentifier('__filename')],
          );
        }

        return visitEachChild(node, visitor, context);
      };

      const modifiedSourceFile = visitNode(sourceFile, visitor) as SourceFile;
      if (insertShim) {
        return factory.updateSourceFile(modifiedSourceFile, [
          getImportMetaUrlFunction(functionName),
          ...modifiedSourceFile.statements,
        ]);
      }

      return modifiedSourceFile;
    };
  };
}

/**
 * Get a transformer that updates the default imports to use the `importDefault`
 * helper function for CommonJS modules.
 *
 * For example, the following default import:
 *
 * ```ts
 * import foo from 'module';
 * ```
 *
 * will be transformed to:
 *
 * ```ts
 * function $importDefault(module) {
 *   // ...;
 * }
 *
 * import $foo from 'module';
 * const foo = $importDefault($foo);
 * ```
 *
 * @param options - The transformer options.
 * @param options.typeChecker - The type checker to use.
 * @param options.system - The compiler system to use.
 * @returns The transformer function.
 */
export function getDefaultImportTransformer({
  typeChecker,
  system,
}: TransformerOptions) {
  return (context: TransformationContext): Transformer<SourceFile> => {
    return (sourceFile: SourceFile) => {
      let insertShim = false;
      const importDefaultFunctionName = getUniqueIdentifier(
        typeChecker,
        sourceFile,
        'importDefault',
      );

      const visitor = (node: Node): Node | Node[] | undefined => {
        if (isImportDeclaration(node) && node.importClause?.name) {
          // If the module specifier is not a string literal, return the node as is.
          if (!isStringLiteral(node.moduleSpecifier)) {
            return node;
          }

          // If the module specifier is not a CommonJS module, return the node as is.
          if (
            !isCommonJs(node.moduleSpecifier.text, system, sourceFile.fileName)
          ) {
            return node;
          }

          insertShim = true;
          const name = getUniqueIdentifier(
            typeChecker,
            sourceFile,
            node.importClause.name.text,
          );

          const importDeclaration = factory.updateImportDeclaration(
            node,
            node.modifiers,
            factory.updateImportClause(
              node.importClause,
              node.importClause.isTypeOnly,
              factory.createIdentifier(name),
              node.importClause.namedBindings,
            ),
            node.moduleSpecifier,
            node.attributes,
          );

          const variableDeclaration = factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  factory.createIdentifier(node.importClause.name.text),
                  undefined,
                  undefined,
                  factory.createCallExpression(
                    factory.createIdentifier(importDefaultFunctionName),
                    undefined,
                    [factory.createIdentifier(name)],
                  ),
                ),
              ],
              // eslint-disable-next-line no-bitwise
              NodeFlags.Const,
            ),
          );

          return [importDeclaration, variableDeclaration];
        }

        return visitEachChild(node, visitor, context);
      };

      const modifiedSourceFile = visitNode(sourceFile, visitor) as SourceFile;
      if (insertShim) {
        return factory.updateSourceFile(modifiedSourceFile, [
          getImportDefaultHelper(importDefaultFunctionName),
          ...modifiedSourceFile.statements,
        ]);
      }

      return modifiedSourceFile;
    };
  };
}

/**
 * Get a transformer that updates the named imports. This updates the imports to
 * use a default import, and destructures the imports from the default import.
 *
 * For example, the following import (assuming the module is a CommonJS module):
 * ```ts
 * import { foo, bar } from 'module';
 * ```
 *
 * will be transformed to:
 * ```ts
 * import module from 'module';
 * const { foo, bar } = module;
 * ```
 *
 * @param options - The transformer options.
 * @param options.typeChecker - The type checker to use.
 * @param options.system - The compiler system to use.
 * @returns The transformer function.
 */
export function getNamedImportTransformer({
  typeChecker,
  system,
}: TransformerOptions) {
  return (context: TransformationContext): Transformer<SourceFile> => {
    return (sourceFile: SourceFile) => {
      const visitor = (node: Node): Node | Node[] | undefined => {
        if (isImportDeclaration(node)) {
          if (node.importClause?.isTypeOnly) {
            // If the import is type-only, we need to return `undefined` to
            // avoid TypeScript 4.x from including the import in the output.
            return undefined;
          }

          return getNamedImportNodes(typeChecker, sourceFile, node, system);
        }

        return visitEachChild(node, visitor, context);
      };

      return visitNode(sourceFile, visitor) as SourceFile;
    };
  };
}

/**
 * Get a transformer that removes type-only imports and exports. This is the
 * standard behaviour for TypeScript 5.x, but this transformer is needed for
 * TypeScript 4.x. This may be a bug in TypeScript 4.x's compiler API.
 *
 * For example, the following type-only imports and exports:
 * ```ts
 * import type { Foo } from 'module';
 * export type { Foo };
 * ```
 *
 * will be removed.
 *
 * @param _context - The transformer options. This is not used.
 * @returns The transformer function.
 */
export function getTypeImportExportTransformer(_context: TransformerOptions) {
  return (context: TransformationContext): Transformer<SourceFile> => {
    return (sourceFile: SourceFile) => {
      const visitor = (node: Node): Node | Node[] | undefined => {
        if (isImportDeclaration(node)) {
          if (node.importClause?.isTypeOnly) {
            return undefined;
          }

          return getNonTypeImports(node);
        }

        if (isExportDeclaration(node)) {
          if (node.isTypeOnly) {
            return undefined;
          }

          return getNonTypeExports(node);
        }

        return visitEachChild(node, visitor, context);
      };

      return visitNode(sourceFile, visitor) as SourceFile;
    };
  };
}

/**
 * The options for the {@link getImportAttributeTransformer} function.
 */
export type ImportAssertionTransformerOptions = {
  /**
   * The type of the module, i.e., CommonJS or ES module, to apply the
   * transformation to.
   */
  moduleType: FileFormat;

  /**
   * The import assertion type to apply.
   */
  type: string;
};

/**
 * Get a transformer that adds an import attribute to the given module type with
 * the given type attribute. This is mainly useful for JSON imports, which
 * require `with { type: 'json' }` to be added to the import statement.
 *
 * @param options - The import attribute options.
 * @param options.moduleType - The type of the module, i.e., CommonJS or ES
 * module, to apply the transformation to.
 * @param options.type - The import assertion type to apply.
 * @param context - The transformer options.
 * @param context.system - The compiler system to use.
 * @returns The transformer function.
 */
export function getImportAttributeTransformer(
  options: ImportAssertionTransformerOptions,
  { system }: TransformerOptions,
) {
  return (context: TransformationContext): Transformer<SourceFile> => {
    return (sourceFile: SourceFile) => {
      const visitor = (node: Node): Node | Node[] | undefined => {
        if (
          node &&
          isImportDeclaration(node) &&
          isStringLiteral(node.moduleSpecifier)
        ) {
          const type = getModuleType(
            node.moduleSpecifier.text,
            system,
            sourceFile.fileName,
          );

          if (type === options.moduleType) {
            return factory.updateImportDeclaration(
              node,
              node.modifiers,
              node.importClause,
              node.moduleSpecifier,
              getImportAttribute('type', options.type),
            );
          }
        }

        return visitEachChild(node, visitor, context);
      };

      return visitNode(sourceFile, visitor) as SourceFile;
    };
  };
}

/**
 * Get a transformer that removes any import attributes from the import
 * declarations.
 *
 * This is useful in CommonJS environments where import attributes are not
 * supported.
 *
 * @param _context - The transformer options. This is not used.
 * @returns The transformer function.
 */
export function getRemoveImportAttributeTransformer(
  _context: TransformerOptions,
) {
  return (context: TransformationContext): Transformer<SourceFile> => {
    return (sourceFile: SourceFile) => {
      const visitor = (node: Node): Node | Node[] | undefined => {
        if (
          node &&
          isImportDeclaration(node) &&
          (node.attributes || node.assertClause)
        ) {
          return factory.updateImportDeclaration(
            node,
            node.modifiers,
            node.importClause,
            node.moduleSpecifier,
            undefined,
          );
        }

        return visitEachChild(node, visitor, context);
      };

      return visitNode(sourceFile, visitor) as SourceFile;
    };
  };
}

/**
 * Get a custom transformer that sets the target module kind for the source
 * file.
 *
 * @param impliedNodeFormat - The target module kind, i.e., ES module or
 * CommonJS module.
 * @returns The custom transformer function.
 */
export function getTargetTransformer(impliedNodeFormat: ResolutionMode) {
  return (): Transformer<SourceFile> => {
    return (sourceFile: SourceFile): SourceFile => {
      return {
        ...sourceFile,
        impliedNodeFormat,
      };
    };
  };
}

/**
 * Update the source map path to match the new file extension of the source
 * file.
 *
 * Source maps contain a `file` property that points to the original source
 * file. When the source file extension is changed, the source map file path
 * should be updated to match the new extension.
 *
 * @param sourceMap - The source map JSON string.
 * @param extension - The new file extension.
 * @returns The updated source map JSON string.
 */
export function transformSourceMap(sourceMap: string, extension: string) {
  const sourceMapObject = JSON.parse(sourceMap);
  const updatedSourceMapObject = {
    ...sourceMapObject,
    file: sourceMapObject.file.replace(/\.(?:js|d\.ts)$/u, extension),
  };

  return JSON.stringify(updatedSourceMapObject);
}

/**
 * Transform the file content to update the source map path or the source file
 * extension.
 *
 * @param fileName - The name of the source file.
 * @param content - The content of the source file.
 * @param extension - The new file extension.
 * @param declarationExtension - The new file extension for declaration files.
 * @returns The transformed content.
 */
export function transformFile(
  fileName: string,
  content: string,
  extension: string,
  declarationExtension: string,
): string {
  if (fileName.endsWith('.d.ts.map')) {
    return transformSourceMap(content, declarationExtension);
  }

  if (fileName.endsWith('.map')) {
    return transformSourceMap(content, extension);
  }

  // This is a bit hacky, but TypeScript doesn't provide a way to transform
  // the source map comment in the source file.
  return content
    .replace(
      /^\/\/# sourceMappingURL=(.*)\.js\.map$/mu,
      `//# sourceMappingURL=$1${extension}.map`,
    )
    .replace(
      /^\/\/# sourceMappingURL=(.*)\.d\.ts\.map$/mu,
      `//# sourceMappingURL=$1${declarationExtension}.map`,
    );
}
