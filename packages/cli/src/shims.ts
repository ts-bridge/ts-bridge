import { createRequire } from 'module';

export const CJS_SHIMS_PACKAGE = '@ts-bridge/shims';
export const ESM_SHIMS_PACKAGE = '@ts-bridge/shims/esm';
export const ESM_REQUIRE_SHIMS_PACKAGE = '@ts-bridge/shims/esm/require';

/**
 * Check if the `@ts-bridge/shims` package is installed.
 *
 * @param basePath - The path to start resolving from. This should be a `file:`
 * path and include the filename, e.g., `import.meta.url`.
 * @returns `true` if the package is installed, `false` otherwise.
 */
export function isShimsPackageInstalled(basePath: string) {
  const require = createRequire(basePath);
  try {
    require.resolve(CJS_SHIMS_PACKAGE);
    return true;
  } catch {
    return false;
  }
}
