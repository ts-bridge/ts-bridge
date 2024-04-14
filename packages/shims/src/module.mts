/* eslint-disable @typescript-eslint/naming-convention */

import { dirname, fileURLToPath } from './utils.mjs';

/**
 * Get the filename of the current module, i.e., `__filename`, but for ESM.
 *
 * @param url - The URL of the module, i.e., `import.meta.url`. This is required
 * because `__filename` is a function of the current module, and the current
 * module's URL is not available in the function scope.
 * @returns The filename of the current module.
 */
export function __filename(url: string): string {
  return fileURLToPath(url);
}

/**
 * Get the directory name of the current module, i.e., `__dirname`, but for ESM.
 *
 * @param url - The URL of the module, i.e., `import.meta.url`. This is required
 * because `__dirname` is a function of the current module, and the current
 * module's URL is not available in the function scope.
 * @returns The directory name of the current module.
 */
export function __dirname(url: string): string {
  return dirname(__filename(url));
}
