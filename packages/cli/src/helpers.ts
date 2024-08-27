import typescript from 'typescript';

const { factory, SyntaxKind } = typescript;

/**
 * Get the AST for the `importDefault` helper function, i.e.:
 *
 * ```ts
 * function importDefault(module?: any): any {
 *   if (module?.__esModule) {
 *     return module.default;
 *   }
 *
 *   return module;
 * }
 * ```
 *
 * This is based on the `__importDefault` function that TypeScript generates
 * when compiling ES modules to CommonJS. It is used to import the default
 * export from a (CommonJS) module. This checks if the module has a `__esModule`
 * property, and if so, returns `module.default`. Otherwise, it returns the
 * module itself.
 *
 * @param functionName - The name of the function.
 * @returns The AST for the `importDefault` helper function.
 */
export function getImportDefaultHelper(functionName: string) {
  return factory.createFunctionDeclaration(
    undefined,
    undefined,
    factory.createIdentifier(functionName),
    undefined,
    [
      factory.createParameterDeclaration(
        undefined,
        undefined,
        factory.createIdentifier('module'),
        factory.createToken(SyntaxKind.QuestionToken),
        factory.createKeywordTypeNode(SyntaxKind.AnyKeyword),
        undefined,
      ),
    ],
    factory.createKeywordTypeNode(SyntaxKind.AnyKeyword),
    factory.createBlock(
      [
        factory.createIfStatement(
          factory.createPropertyAccessChain(
            factory.createIdentifier('module'),
            factory.createToken(SyntaxKind.QuestionDotToken),
            factory.createIdentifier('__esModule'),
          ),
          factory.createBlock(
            [
              factory.createReturnStatement(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier('module'),
                  factory.createIdentifier('default'),
                ),
              ),
            ],
            true,
          ),
          undefined,
        ),
        factory.createReturnStatement(factory.createIdentifier('module')),
      ],
      true,
    ),
  );
}
