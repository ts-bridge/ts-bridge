/* eslint-disable @typescript-eslint/naming-convention */

type Module<Type> =
  | {
      default: Type;
      __esModule?: true;
    }
  | {
      default?: never;
      __esModule?: false;
    };

/**
 * Import the default export from a (CommonJS) module. This checks if the module
 * has a `__esModule` property, and if so, returns `module.default`. Otherwise,
 * it returns the module itself.
 *
 * This is based on the `__importDefault` function that TypeScript generates
 * when compiling ES modules to CommonJS.
 *
 * @param module - The module to import the default export from.
 * @returns The default export of the module.
 */
export function importDefault<Type>(module?: Module<Type>): Type {
  if (module?.__esModule) {
    return module.default;
  }

  return module as Type;
}
