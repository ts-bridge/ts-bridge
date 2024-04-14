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
  getImportMetaUrl,
  getImportPath,
  getNamedImportNodes,
  getNamespaceImport,
  getUniqueIdentifier,
  isGlobal,
} from './generator.js';
import {
  CJS_SHIMS_PACKAGE,
  ESM_REQUIRE_SHIMS_PACKAGE,
  ESM_SHIMS_PACKAGE,
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
  baseDirectory: string;
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
 * @param options.baseDirectory - The base directory to start resolving from.
 * @param options.verbose - Whether to enable verbose logging.
 * @returns The transformer function.
 */
export function getImportExtensionTransformer(
  extension: string,
  { system, baseDirectory, verbose }: TransformerOptions,
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
            const importPath = getImportPath(
              {
                fileName: sourceFile.fileName,
                importPath: node.text,
                compilerOptions: context.getCompilerOptions(),
                extension,
                baseDirectory,
                verbose,
              },
              system,
            );

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
 * @param options.baseDirectory - The base directory to start resolving from.
 * @param options.verbose - Whether to enable verbose logging.
 * @returns The transformer function.
 */
export function getRequireExtensionTransformer(
  extension: string,
  { typeChecker, system, baseDirectory, verbose }: TransformerOptions,
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
          const importPath = getImportPath(
            {
              fileName: sourceFile.fileName,
              importPath: node.text,
              compilerOptions: context.getCompilerOptions(),
              extension,
              baseDirectory,
              verbose,
            },
            system,
          );

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
 * @param options.baseDirectory - The base directory to start resolving from.
 * @param options.verbose - Whether to enable verbose logging.
 * @returns The transformer function.
 */
export function getExportExtensionTransformer(
  extension: string,
  { system, baseDirectory, verbose }: TransformerOptions,
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
            const importPath = getImportPath(
              {
                fileName: sourceFile.fileName,
                importPath: node.text,
                compilerOptions: context.getCompilerOptions(),
                extension,
                baseDirectory,
                verbose,
              },
              system,
            );

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
 * ```
 * import * as shims from '@ts-bridge/shims/esm';
 *
 * const foo = shims.__filename(import.meta.url);
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
      let insertShim = false;

      const shimsIdentifier = getUniqueIdentifier(
        typeChecker,
        sourceFile,
        'shims',
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
          insertShim = true;
          return factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier(shimsIdentifier),
              factory.createIdentifier('__filename'),
            ),
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
          insertShim = true;
          return factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier(shimsIdentifier),
              factory.createIdentifier('__dirname'),
            ),
            undefined,
            [getImportMetaUrl()],
          );
        }

        return visitEachChild(node, visitor, context);
      };

      const modifiedSourceFile = visitNode(sourceFile, visitor) as SourceFile;

      if (insertShim) {
        return factory.updateSourceFile(modifiedSourceFile, [
          getNamespaceImport(shimsIdentifier, ESM_SHIMS_PACKAGE),
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
 * ```
 * import * as nodeShims from '@ts-bridge/shims/esm/require';
 *
 * const foo = nodeShims.require('bar', import.meta.url);
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

      const shimsIdentifier = getUniqueIdentifier(
        typeChecker,
        sourceFile,
        'nodeShims',
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
            factory.createPropertyAccessExpression(
              factory.createIdentifier(shimsIdentifier),
              factory.createIdentifier('require'),
            ),
            undefined,
            [node.arguments[0], getImportMetaUrl()],
          );
        }

        return visitEachChild(node, visitor, context);
      };

      const modifiedSourceFile = visitNode(sourceFile, visitor) as SourceFile;

      if (insertShim) {
        return factory.updateSourceFile(modifiedSourceFile, [
          getNamespaceImport(shimsIdentifier, ESM_REQUIRE_SHIMS_PACKAGE),
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
 * import * as shims from '@ts-bridge/shims';
 *
 * const foo = shims.getImportMetaUrl(__filename);
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
      const shimsIdentifier = getUniqueIdentifier(
        typeChecker,
        sourceFile,
        'shims',
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
            factory.createPropertyAccessExpression(
              factory.createIdentifier(shimsIdentifier),
              factory.createIdentifier('getImportMetaUrl'),
            ),
            undefined,
            [factory.createIdentifier('__filename')],
          );
        }

        return visitEachChild(node, visitor, context);
      };

      const modifiedSourceFile = visitNode(sourceFile, visitor) as SourceFile;
      if (insertShim) {
        return factory.updateSourceFile(modifiedSourceFile, [
          getNamespaceImport(shimsIdentifier, CJS_SHIMS_PACKAGE),
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
 * @param options.baseDirectory - The base directory to start resolving from.
 * @param options.system - The compiler system to use.
 * @returns The transformer function.
 */
export function getNamedImportTransformer({
  typeChecker,
  baseDirectory,
  system,
}: TransformerOptions) {
  return (context: TransformationContext): Transformer<SourceFile> => {
    return (sourceFile: SourceFile) => {
      const visitor = (node: Node): Node | Node[] => {
        if (isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
          return getNamedImportNodes(
            typeChecker,
            sourceFile,
            node,
            baseDirectory,
            system,
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
