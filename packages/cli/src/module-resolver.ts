import { isBuiltin, createRequire } from 'module';
import { dirname, join, sep } from 'path';
import {
  exports as resolveExports,
  legacy as resolveLegacy,
} from 'resolve.exports';
import type { System } from 'typescript';

import { readJsonFile } from './file-system.js';

/**
 * Get the name of a package, i.e., the first part of a package specifier. For
 * example, the package name of `@scope/name/foo` is `@scope/name`.
 *
 * @param packageSpecifier - The package specifier.
 * @returns The name of the package.
 */
export function getPackageName(packageSpecifier: string): string {
  const parts = packageSpecifier.split('/');
  if (!parts[0]) {
    throw new Error(`Invalid package specifier: "${packageSpecifier}".`);
  }

  if (packageSpecifier.startsWith('@')) {
    return parts.slice(0, 2).join('/');
  }

  return parts[0];
}

/**
 * Get the paths where a package can be found.
 *
 * @param packageName - The name of the package.
 * @param baseDirectory - The directory to start resolving from.
 * @returns The paths where the package can be found, or `null` if the package
 * is a built-in module.
 */
function getPackagePaths(packageName: string, baseDirectory: string) {
  const require = createRequire(join(baseDirectory, 'noop.js'));
  return require.resolve.paths(packageName);
}

/**
 * Get the paths of the parent directories of a package, which can contain a
 * `package.json` file.
 *
 * @param packageName - The name of the package.
 * @param baseDirectory - The directory to start resolving from.
 * @param paths - The paths of the parent directories. This is used for
 * recursion.
 * @param basePackageName - The base package name. This is used for recursion.
 * @returns The paths of the parent directories of the package.
 */
export function getPackageParentPaths(
  packageName: string,
  baseDirectory: string,
  paths: string[] = [],
  basePackageName = getPackageName(packageName),
) {
  const parentPath = packageName.split(sep).slice(0, -1).join(sep);
  if (parentPath.length <= basePackageName.length) {
    return paths;
  }

  const path = join(baseDirectory, parentPath);
  return getPackageParentPaths(
    parentPath,
    baseDirectory,
    // Note: The order of paths here is important, since we want to check the
    // "deepest" directory first.
    [...paths, path],
    basePackageName,
  );
}

/**
 * Get the `package.json` file for a module.
 *
 * @param packageName - The name of the module.
 * @param system - The file system to use.
 * @param baseDirectory - The directory to start resolving from.
 * @returns The content of the `package.json` file or `null` if it could not be
 * found.
 */
export function getPackageJson(
  packageName: string,
  system: System,
  baseDirectory = system.getCurrentDirectory(),
) {
  const paths = getPackagePaths(packageName, baseDirectory);

  // `require.resolve.paths` returns `null` for built-in modules.
  if (!paths) {
    return null;
  }

  const pathsWithPackage = paths.flatMap((path) => [
    ...getPackageParentPaths(packageName, path),
    join(path, packageName),
  ]);

  for (const path of pathsWithPackage) {
    const packagePath = join(path, 'package.json');
    if (system.fileExists(packagePath)) {
      return readJsonFile(packagePath, system);
    }
  }

  return null;
}

/**
 * Get the entry point for a package that's not using the `exports` field.
 *
 * @param packageJson - The `package.json` file for the package.
 * @returns The entry point for the package.
 */
function getLegacyPackageEntryPoint(packageJson: Record<string, unknown>) {
  return (
    resolveLegacy(packageJson, {
      browser: false,
    }) ?? null
  );
}

/**
 * Get the entry point for a package.
 *
 * @param packageJson - The `package.json` file for the package.
 * @param packageSpecifier - The specifier for the package.
 * @returns The entry point for the package.
 */
export function getPackageEntryPoint(
  packageJson: Record<string, unknown>,
  packageSpecifier: string,
) {
  try {
    const resolvedExports = resolveExports(packageJson, packageSpecifier);
    if (!resolvedExports?.[0]) {
      return getLegacyPackageEntryPoint(packageJson);
    }

    return resolvedExports[0];
  } catch {
    return getLegacyPackageEntryPoint(packageJson);
  }
}

/**
 * Check if a package is an ECMAScript module.
 *
 * This function checks if a package is an ECMAScript module by looking at the
 * extension of the entry point file, the `type` field in the `package.json`
 * file, and the `type` field in the `package.json` file of the directory
 * containing the entry point file (if any).
 *
 * This is intended to match the behavior of Node.js when resolving packages,
 * though it may not be 100% accurate.
 *
 * @param packageSpecifier - The specifier for the package.
 * @param system - The file system to use.
 * @param baseDirectory - The directory to start resolving from.
 * @returns Whether the package is an ECMAScript module.
 */
export function isESModule(
  packageSpecifier: string,
  system: System,
  baseDirectory: string,
) {
  if (isBuiltin(packageSpecifier)) {
    return true;
  }

  if (packageSpecifier.endsWith('.mjs')) {
    return true;
  }

  const packageName = getPackageName(packageSpecifier);
  const packageJson = getPackageJson(packageName, system, baseDirectory);
  if (!packageJson) {
    return false;
  }

  const entryPoint = getPackageEntryPoint(packageJson, packageSpecifier);

  // If the entry point is a `.mjs` file, the package is an ECMAScript module.
  if (entryPoint?.endsWith('.mjs')) {
    return true;
  }

  if (!entryPoint?.endsWith('.js')) {
    return false;
  }

  // Packages may have a `package.json` closer to the entry point that specifies
  // that the package is an ECMAScript module.
  const entryPointPackageJson = getPackageJson(
    join(packageName, dirname(entryPoint)),
    system,
    baseDirectory,
  );

  if (entryPointPackageJson) {
    return entryPointPackageJson.type === 'module';
  }

  // Otherwise, check the `type` field in the `package.json` file. Note that we
  // check if the entry point ends with `.js` because it could technically be
  // `.cjs` or another extension.
  return packageJson.type === 'module';
}

/**
 * Get the path to a file in a package. This assumes that the package is not an
 * ECMAScript module, and does not use the `exports` field. This function will
 * try to find the file for the given package specifier in the package's
 * directory.
 *
 * @param packageSpecifier - The specifier for the package.
 * @param system - The file system to use.
 * @param baseDirectory - The directory to start resolving from.
 * @returns The path to the package, or `null` if the package could not be
 * found.
 */
export function getPackagePath(
  packageSpecifier: string,
  system: System,
  baseDirectory: string,
) {
  if (packageSpecifier.endsWith('.js') || packageSpecifier.endsWith('.cjs')) {
    return packageSpecifier;
  }

  const packageName = getPackageName(packageSpecifier);
  const paths = getPackagePaths(packageName, baseDirectory);

  // `require.resolve.paths` returns `null` for built-in modules.
  if (!paths) {
    return null;
  }

  for (const path of paths) {
    for (const extension of ['.js', '.cjs']) {
      const packagePath = join(path, `${packageSpecifier}${extension}`);
      if (system.fileExists(packagePath)) {
        return `${packageSpecifier}${extension}`;
      }
    }
  }

  return null;
}
