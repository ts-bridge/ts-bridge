// This is done in a separate entry point because it relies on Node.js-specific
// APIs that are not available in the browser. This makes it easier to use
// `__filename` and `__dirname` in both Node.js and the browser without having
// to worry about polyfilling the Node.js-specific APIs in the browser.

import { createRequire } from 'module';

/**
 * Require a module from a URL. This is a shim for Node.js's `require` function,
 * and is intended to be used in ESM modules.
 *
 * Note that this function cannot be used to import ESM modules, only CJS
 * modules.
 *
 * @param identifier - The identifier of the module to require.
 * @param url - The base URL to require the module from, i.e.,
 * `import.meta.url`. This is required because `require` is a function of the
 * current module, and the current module's URL is not available in the function
 * scope.
 * @returns The module's exports.
 */
export function require(identifier: string, url: string): any {
  const fn = createRequire(url);
  return fn(identifier);
}
