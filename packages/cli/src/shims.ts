import type { Statement } from 'typescript';
import typescript from 'typescript';

const { factory, SyntaxKind, NodeFlags } = typescript;

export const ESM_HELPERS_PACKAGE = '@ts-bridge/helpers/esm';

/**
 * Get the AST for the `fileURLToPath` function, i.e.:
 *
 * ```ts
 * function fileURLToPath(fileUrl: string) {
 *   const url = new URL(fileUrl);
 *   return url.pathname.replace(/^\/([a-zA-Z]:)/u, '$1');
 * }
 * ```
 *
 * This function is a simplified version of the `fileURLToPath` function in
 * Node.js and does not handle edge cases like file URLs that contain invalid
 * characters. It is assumed that the input is always a valid file URL.
 *
 * This is used to avoid the need for polyfills in browser environment.
 *
 * @param functionName - The name of the function to create.
 * @returns The AST for the `fileURLToPath` function.
 */
export function getFileUrlToPathHelperFunction(functionName: string) {
  return factory.createFunctionDeclaration(
    undefined,
    undefined,
    factory.createIdentifier(functionName),
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier('fileUrl'),
        undefined,
        factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
        undefined,
      ),
    ],
    undefined,
    factory.createBlock(
      [
        factory.createVariableStatement(
          undefined,
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                factory.createIdentifier('url'),
                undefined,
                undefined,
                factory.createNewExpression(
                  factory.createIdentifier('URL'),
                  undefined,
                  [factory.createIdentifier('fileUrl')],
                ),
              ),
            ],
            NodeFlags.Const,
          ),
        ),
        factory.createReturnStatement(
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier('url'),
                factory.createIdentifier('pathname'),
              ),
              factory.createIdentifier('replace'),
            ),
            undefined,
            [
              factory.createRegularExpressionLiteral('/^\\/([a-zA-Z]:)/u'),
              factory.createStringLiteral('$1'),
            ],
          ),
        ),
      ],
      true,
    ),
  );
}

/**
 * Get the AST for the `dirname` function, i.e.:
 *
 * ```ts
 * function dirname(path: string) {
 *   const sanitisedPath = path
 *     .toString()
 *     .replace(/\\/gu, '/')
 *     .replace(/\/$/u, '');
 *
 *   const index = sanitisedPath.lastIndexOf('/');
 *   if (index === -1) {
 *     return path;
 *   }
 *
 *   if (index === 0) {
 *     return '/';
 *   }
 *
 *   return sanitisedPath.slice(0, index);
 * }
 * ```
 *
 * This function is a simplified version of the `dirname` function in Node.js.
 * It does not handle edge cases like paths that end with multiple slashes or
 * paths that contain invalid characters. It is assumed that the input is always
 * a valid path.
 *
 * This is used to avoid the need for polyfills in browser environment.
 *
 * @param functionName - The name of the function to create.
 * @returns The AST for the `dirname` function.
 */
export function getDirnameHelperFunction(functionName: string) {
  return factory.createFunctionDeclaration(
    undefined,
    undefined,
    factory.createIdentifier(functionName),
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier('path'),
        undefined,
        factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
        undefined,
      ),
    ],
    undefined,
    factory.createBlock(
      [
        factory.createVariableStatement(
          undefined,
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                factory.createIdentifier('sanitisedPath'),
                undefined,
                undefined,
                factory.createCallExpression(
                  factory.createPropertyAccessExpression(
                    factory.createCallExpression(
                      factory.createPropertyAccessExpression(
                        factory.createCallExpression(
                          factory.createPropertyAccessExpression(
                            factory.createIdentifier('path'),
                            factory.createIdentifier('toString'),
                          ),
                          undefined,
                          [],
                        ),
                        factory.createIdentifier('replace'),
                      ),
                      undefined,
                      [
                        factory.createRegularExpressionLiteral('/\\\\/gu'),
                        factory.createStringLiteral('/'),
                      ],
                    ),
                    factory.createIdentifier('replace'),
                  ),
                  undefined,
                  [
                    factory.createRegularExpressionLiteral('/\\/$/u'),
                    factory.createStringLiteral(''),
                  ],
                ),
              ),
            ],
            NodeFlags.Const,
          ),
        ),
        factory.createVariableStatement(
          undefined,
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                factory.createIdentifier('index'),
                undefined,
                undefined,
                factory.createCallExpression(
                  factory.createPropertyAccessExpression(
                    factory.createIdentifier('sanitisedPath'),
                    factory.createIdentifier('lastIndexOf'),
                  ),
                  undefined,
                  [factory.createStringLiteral('/')],
                ),
              ),
            ],
            NodeFlags.Const,
          ),
        ),
        factory.createIfStatement(
          factory.createBinaryExpression(
            factory.createIdentifier('index'),
            factory.createToken(SyntaxKind.EqualsEqualsEqualsToken),
            factory.createPrefixUnaryExpression(
              SyntaxKind.MinusToken,
              factory.createNumericLiteral('1'),
            ),
          ),
          factory.createBlock(
            [factory.createReturnStatement(factory.createIdentifier('path'))],
            true,
          ),
          undefined,
        ),
        factory.createIfStatement(
          factory.createBinaryExpression(
            factory.createIdentifier('index'),
            factory.createToken(SyntaxKind.EqualsEqualsEqualsToken),
            factory.createNumericLiteral('0'),
          ),
          factory.createBlock(
            [factory.createReturnStatement(factory.createStringLiteral('/'))],
            true,
          ),
          undefined,
        ),
        factory.createReturnStatement(
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier('sanitisedPath'),
              factory.createIdentifier('slice'),
            ),
            undefined,
            [
              factory.createNumericLiteral('0'),
              factory.createIdentifier('index'),
            ],
          ),
        ),
      ],
      true,
    ),
  );
}

/**
 * Get the AST for the `__dirname` global function, i.e.:
 *
 * ```ts
 * function __dirname(url: string): string {
 *   return dirname(fileUrlToPath(url));
 * }
 * ```
 *
 * This function returns the directory name of the current module, i.e.,
 * `__dirname`, but for ESM.
 *
 * @param functionName - The name of the function to create.
 * @param fileUrlToPathFunctionName - The name of the function that converts a
 * file URL to a path.
 * @param dirnameFunctionName - The name of the function that gets the directory
 * name of a path.
 * @returns The AST for the `__dirname` global function.
 */
export function getDirnameGlobalFunction(
  functionName: string,
  fileUrlToPathFunctionName: string,
  dirnameFunctionName: string,
) {
  return factory.createFunctionDeclaration(
    undefined,
    undefined,
    factory.createIdentifier(functionName),
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier('url'),
        undefined,
        factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
        undefined,
      ),
    ],
    factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
    factory.createBlock(
      [
        factory.createReturnStatement(
          factory.createCallExpression(
            factory.createIdentifier(dirnameFunctionName),
            undefined,
            [
              factory.createCallExpression(
                factory.createIdentifier(fileUrlToPathFunctionName),
                undefined,
                [factory.createIdentifier('url')],
              ),
            ],
          ),
        ),
      ],
      true,
    ),
  );
}

/**
 * Get the AST for the `getImportMetaUrl` function, i.e.:
 *
 * ```ts
 * function getImportMetaUrl(fileName: string): string {
 *   return typeof document === 'undefined'
 *     ? new URL(`file:${fileName}`).href
 *     : document.currentScript?.src ?? new URL('main.js', document.baseURI).href;
 * }
 * ```
 *
 * If the current environment is a browser, it will return the URL of the
 * current script (if it's available). Otherwise, it will return the URL of the
 * current file.
 *
 * @param functionName - The name of the function to create.
 * @returns The AST for the `getImportMetaUrl` function.
 */
export function getImportMetaUrlFunction(functionName: string) {
  return factory.createFunctionDeclaration(
    undefined,
    undefined,
    factory.createIdentifier(functionName),
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier('fileName'),
        undefined,
        factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
        undefined,
      ),
    ],
    factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
    factory.createBlock(
      [
        factory.createReturnStatement(
          factory.createConditionalExpression(
            factory.createBinaryExpression(
              factory.createTypeOfExpression(
                factory.createIdentifier('document'),
              ),
              factory.createToken(SyntaxKind.EqualsEqualsEqualsToken),
              factory.createStringLiteral('undefined'),
            ),
            factory.createToken(SyntaxKind.QuestionToken),
            factory.createPropertyAccessExpression(
              factory.createNewExpression(
                factory.createIdentifier('URL'),
                undefined,
                [
                  factory.createTemplateExpression(
                    factory.createTemplateHead('file:', 'file:'),
                    [
                      factory.createTemplateSpan(
                        factory.createIdentifier('fileName'),
                        factory.createTemplateTail('', ''),
                      ),
                    ],
                  ),
                ],
              ),
              factory.createIdentifier('href'),
            ),
            factory.createToken(SyntaxKind.ColonToken),
            factory.createBinaryExpression(
              factory.createPropertyAccessChain(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier('document'),
                  factory.createIdentifier('currentScript'),
                ),
                factory.createToken(SyntaxKind.QuestionDotToken),
                factory.createIdentifier('src'),
              ),
              factory.createToken(SyntaxKind.QuestionQuestionToken),
              factory.createPropertyAccessExpression(
                factory.createNewExpression(
                  factory.createIdentifier('URL'),
                  undefined,
                  [
                    factory.createStringLiteral('main.js'),
                    factory.createPropertyAccessExpression(
                      factory.createIdentifier('document'),
                      factory.createIdentifier('baseURI'),
                    ),
                  ],
                ),
                factory.createIdentifier('href'),
              ),
            ),
          ),
        ),
      ],
      true,
    ),
  );
}

/**
 * Get the AST for the `require` function, i.e.:
 *
 * ```ts
 * import { createRequire } from 'module';
 *
 * function require(identifier: string, url: string): any {
 *   const fn = createRequire(url);
 *   return fn(identifier);
 * }
 * ```
 *
 * This is a shim for Node.js's `require` function, and is intended to be used
 * in ESM modules. Note that this function cannot be used to import ESM modules,
 * only CJS modules.
 *
 * @param functionName - The name of the function to create.
 * @returns The AST for the `require` function.
 */
export function getRequireHelperFunction(
  functionName: string,
): [Statement, Statement] {
  return [
    factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports([
          factory.createImportSpecifier(
            false,
            factory.createIdentifier('createRequire'),
            factory.createIdentifier(functionName),
          ),
        ]),
      ),
      factory.createStringLiteral('module'),
      undefined,
    ),
    factory.createFunctionDeclaration(
      undefined,
      undefined,
      factory.createIdentifier('require'),
      undefined,
      [
        factory.createParameterDeclaration(
          undefined,
          undefined,
          factory.createIdentifier('identifier'),
          undefined,
          factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
          undefined,
        ),
        factory.createParameterDeclaration(
          undefined,
          undefined,
          factory.createIdentifier('url'),
          undefined,
          factory.createKeywordTypeNode(SyntaxKind.StringKeyword),
          undefined,
        ),
      ],
      factory.createKeywordTypeNode(SyntaxKind.AnyKeyword),
      factory.createBlock(
        [
          factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  factory.createIdentifier('fn'),
                  undefined,
                  undefined,
                  factory.createCallExpression(
                    factory.createIdentifier(functionName),
                    undefined,
                    [factory.createIdentifier('url')],
                  ),
                ),
              ],
              NodeFlags.Const,
            ),
          ),
          factory.createReturnStatement(
            factory.createCallExpression(
              factory.createIdentifier('fn'),
              undefined,
              [factory.createIdentifier('identifier')],
            ),
          ),
        ],
        true,
      ),
    ),
  ];
}
