import assert from 'assert';
import { isBuiltin } from 'module';
import { resolve as resolvePath, basename, extname } from 'path';
import { join as joinPosix } from 'path/posix';
import { fileURLToPath } from 'url';

import { DEFAULT_CONDITIONS } from './constants.js';
import {
  InvalidModuleSpecifierError,
  InvalidPackageConfigurationError,
  InvalidPackageTargetError,
  ModuleNotFoundError,
  PackageImportNotDefinedError,
  PackagePathNotExportedError,
  UnsupportedDirectoryImportError,
} from './errors.js';
import type { FileSystemInterface } from './file-system.js';
import { DEFAULT_FILE_SYSTEM } from './file-system.js';
import type {
  FileFormat,
  PackageExports,
  PackageExportsObject,
  PackageJson,
  Resolution,
} from './types.js';
import {
  getCharacterCount,
  getDataUrlType,
  getProtocol,
  isDefined,
  isFlagEnabled,
  isObject,
  isPath,
  isRelativeExports,
  isURL,
  parseJson,
} from './utils.js';
import {
  isValidPath,
  validateExportsObject,
  validatePatternKey,
} from './validation.js';

/**
 * Resolve a package specifier to a file path. This is an implementation of the
 * Node.js module resolution algorithm as defined
 * [here](https://nodejs.org/api/esm.html#resolution-algorithm-specification).
 *
 * In addition to the resolved file path, this function also returns the format
 * of the module, i.e., whether it is a module, CommonJS, JSON, or WebAssembly
 * module.
 *
 * @param packageSpecifier - The specifier to resolve.
 * @param parentURL - The URL of the parent module.
 * @param fileSystem - The file system to use for resolution.
 * @param enableCache - Whether to enable caching of resolved URLs. Defaults to
 * `true`. When caching is enabled, the function will cache resolved URLs to
 * improve performance.
 * @returns The resolved file path and format.
 * @throws {InvalidModuleSpecifierError} When the module specifier contains
 * invalid characters.
 * @throws {UnsupportedDirectoryImportError} When the module specifier is a
 * directory.
 */
export const resolve = getResolver();

/**
 * Get the resolver function. This is a wrapper of the actual resolution
 * function, using a cache to store resolved URLs.
 *
 * Do not use this function directly. Instead, use the {@link resolve} function.
 *
 * @returns The resolver function.
 */
function getResolver() {
  const cache = new Map<string, Resolution>();

  return (
    packageSpecifier: string,
    parentUrl: string | URL,
    fileSystem: FileSystemInterface = DEFAULT_FILE_SYSTEM,
    enableCache = true,
  ): Resolution => {
    const cacheKey = `${packageSpecifier}#${parentUrl.toString()}`;
    if (enableCache && cache.has(cacheKey)) {
      return cache.get(cacheKey) as Resolution;
    }

    /**
     * Resolve the package specifier.
     *
     * @returns The resolved package specifier.
     */
    function doResolve(): Resolution {
      const resolvedSpecifier = getResolvedUrl(
        packageSpecifier,
        parentUrl,
        fileSystem,
      );

      if (
        // The resolved specifier must not contain encoded slash characters ("/"
        // or "\").
        resolvedSpecifier.toLowerCase().includes('%2f') ||
        resolvedSpecifier.toLowerCase().includes('%5c')
      ) {
        throw new InvalidModuleSpecifierError(resolvedSpecifier);
      }

      const protocol = getProtocol(resolvedSpecifier);
      switch (protocol) {
        // https://nodejs.org/api/esm.html#file-urls
        case 'file:': {
          const path = fileURLToPath(resolvedSpecifier);
          if (fileSystem.isDirectory(path)) {
            throw new UnsupportedDirectoryImportError(resolvedSpecifier);
          }

          if (!fileSystem.isFile(path)) {
            throw new ModuleNotFoundError(resolvedSpecifier);
          }

          const format = getPackageFormat(resolvedSpecifier, fileSystem);
          return {
            path,
            format,
          };
        }

        // https://nodejs.org/api/esm.html#node-imports
        case 'node:': {
          return {
            path: resolvedSpecifier,
            format: 'builtin',
          };
        }

        // https://nodejs.org/api/esm.html#data-imports
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
        case 'data:': {
          return {
            path: resolvedSpecifier,
            format: getDataUrlType(resolvedSpecifier),
          };
        }

        default: {
          return {
            path: resolvedSpecifier,
            format: null,
          };
        }
      }
    }

    const result = doResolve();

    if (enableCache) {
      cache.set(cacheKey, result);
    }

    return result;
  };
}

/**
 * Get the resolved URL for a package specifier.
 *
 * @param packageSpecifier - The package specifier to resolve.
 * @param parentUrl - The URL of the parent module.
 * @param fileSystem - The file system to use for resolution.
 * @returns The resolved URL.
 */
function getResolvedUrl(
  packageSpecifier: string,
  parentUrl: string | URL,
  fileSystem: FileSystemInterface,
): string {
  if (isURL(packageSpecifier)) {
    return new URL(packageSpecifier).href;
  }

  if (isPath(packageSpecifier)) {
    return new URL(packageSpecifier, parentUrl).href;
  }

  if (packageSpecifier.startsWith('#')) {
    const path = resolvePackageImports(packageSpecifier, parentUrl, fileSystem);
    return new URL(path, parentUrl).href;
  }

  const path = resolvePackage(packageSpecifier, parentUrl, fileSystem);
  return new URL(path, parentUrl).href;
}

/**
 * Get the name of a package from a package specifier.
 *
 * @param packageSpecifier - The package specifier to get the name from.
 * @returns The name of the package.
 */
// This is part of the `PACKAGE_RESOLVE` function as defined by the Node.js
// specification.
function getPackageName(packageSpecifier: string): string {
  // 5. Otherwise,
  if (packageSpecifier.startsWith('@')) {
    const [scope, name] = packageSpecifier.split('/');

    // 1. If packageSpecifier does not contain a "/" separator, then
    if (!scope || !name) {
      // 1. Throw an Invalid Module Specifier error.
      throw new InvalidModuleSpecifierError(packageSpecifier);
    }

    // 2. Set packageName to the substring of packageSpecifier until the second
    // "/" separator or the end of the string.
    return `${scope}/${name}`;
  }

  // 4. If packageSpecifier does not start with "@", then
  const [name] = packageSpecifier.split('/');
  assert(name);

  // 1. Set packageName to the substring of packageSpecifier until the first "/"
  //    separator or the end of the string.
  return name;
}

/**
 * Resolve a string package target. This is a helper function used by the
 * {@link resolvePackageTarget} function.
 *
 * @param packageUrl - The URL of the package.
 * @param target - The target to resolve.
 * @param patternMatch - The pattern match to use.
 * @param isImports - Whether the target is an import.
 * @param fileSystem - The file system to use for resolution.
 * @returns The resolved target.
 */
function resolveStringPackageTarget(
  packageUrl: string,
  target: string,
  patternMatch: string | null,
  isImports: boolean,
  fileSystem: FileSystemInterface,
) {
  // 1. If target does not start with "./", then
  if (!target.startsWith('./')) {
    // 1. If isImports is false, or if target starts with "../" or "/", or if
    // target is a valid URL, then
    if (
      !isImports ||
      target.startsWith('../') ||
      target.startsWith('/') ||
      isURL(target)
    ) {
      // 1. Throw an Invalid Package Target error.
      throw new InvalidPackageTargetError(target);
    }

    // 2. If patternMatch is a String, then
    if (typeof patternMatch === 'string') {
      // 1. Return PACKAGE_RESOLVE(target with every instance of "*" replaced
      // by patternMatch, packageURL + "/").
      return resolvePackage(
        target.replaceAll('*', patternMatch),
        `${packageUrl}/`,
        fileSystem,
      );
    }

    // 3. Return PACKAGE_RESOLVE(target, packageURL + "/").
    return resolvePackage(target, `${packageUrl}/`, fileSystem);
  }

  // 2.If target split on "/" or "\" contains any "", ".", "..", or
  // "node_modules" segments after the first "." segment, case insensitive and
  // including percent encoded variants, throw an Invalid Package Target
  // error.
  if (!isValidPath(target.slice(2))) {
    throw new InvalidPackageTargetError(target);
  }

  // 3. Let resolvedTarget be the URL resolution of the concatenation of
  // packageURL and target.
  const resolvedTarget = resolvePath(packageUrl, target);

  // 4. Assert: packageURL is contained in resolvedTarget.
  assert(resolvedTarget.includes(packageUrl));

  // 5.If patternMatch is null, then
  if (patternMatch === null) {
    // 1. Return resolvedTarget.
    return resolvedTarget;
  }

  // 6. If patternMatch split on "/" or "\" contains any "", ".", "..", or
  // "node_modules" segments, case insensitive and including percent encoded
  // variants, throw an Invalid Module Specifier error.
  if (!isValidPath(patternMatch)) {
    throw new InvalidModuleSpecifierError(patternMatch);
  }

  // 7. Return resolvedTarget with every instance of "*" replaced with
  // patternMatch.
  return resolvedTarget.replaceAll('*', patternMatch);
}

/**
 * Resolve an object package target.
 *
 * @param packageUrl - The URL of the package.
 * @param target - The target to resolve.
 * @param patternMatch - The pattern match to use.
 * @param isImports - Whether the target is an import.
 * @param conditions - The conditions to use. When the target is an object, the
 * conditions are the keys of the object, which are used to resolve the target.
 * @param fileSystem - The file system to use for resolution.
 * @returns The resolved target.
 */
function resolveObjectPackageTarget(
  packageUrl: string,
  target: PackageExportsObject,
  patternMatch: string | null,
  isImports: boolean,
  conditions: string[],
  fileSystem: FileSystemInterface,
) {
  // 1. If target contains any index property keys, as defined in ECMA-262 6.1.7
  // Array Index, throw an Invalid Package Configuration error.
  validateExportsObject(packageUrl, target);

  // 2. For each property p of target, in object insertion order as,
  for (const key of Object.keys(target)) {
    // 1. If p equals "default" or conditions contains an entry for p, then
    if (key === 'default' || conditions.includes(key)) {
      // 1. Let targetValue be the value of the p property in target.
      const targetValue = target[key] as PackageExports;

      // 2. Let resolved be the result of
      // PACKAGE_TARGET_RESOLVE(packageURL, targetValue, patternMatch, isImports, conditions).
      const resolved = resolvePackageTarget(
        packageUrl,
        targetValue,
        patternMatch,
        isImports,
        conditions,
        fileSystem,
      );

      // 3. If resolved is equal to undefined, continue the loop.
      if (isDefined(resolved)) {
        // 4. Return resolved.
        return resolved;
      }
    }
  }

  // 3. Return undefined.
  return null;
}

/**
 * Resolve an array package target.
 *
 * @param packageUrl - The URL of the package.
 * @param target - The target to resolve.
 * @param patternMatch - The pattern match to use.
 * @param isImports - Whether the target is an import.
 * @param conditions - The conditions to use. When the target is an object, the
 * conditions are the keys of the object, which are used to resolve the target.
 * @param fileSystem - The file system to use for resolution.
 * @returns The resolved target.
 */
function resolveArrayPackageTarget(
  packageUrl: string,
  target: PackageExports[],
  patternMatch: string | null,
  isImports: boolean,
  conditions: string[],
  fileSystem: FileSystemInterface,
) {
  // If the target is an empty array, return null.
  if (target.length === 0) {
    return null;
  }

  /**
   * Resolve a package target safely, i.e., without throwing an error.
   *
   * @param targetValue - The target value to resolve.
   * @returns The resolved target.
   */
  function safeResolvePackageTarget(
    targetValue: PackageExports,
  ): [error: unknown | null, result: string | null] {
    try {
      const result = resolvePackageTarget(
        packageUrl,
        targetValue,
        patternMatch,
        isImports,
        conditions,
        fileSystem,
      );

      return [null, result];
    } catch (error) {
      return [error, null];
    }
  }

  // Each target in the array is resolved in order, and the first
  // successfully resolved target is returned.
  for (let index = 0; index < target.length; index++) {
    const targetValue = target[index] as PackageExports;
    const [error, resolved] = safeResolvePackageTarget(targetValue);
    const isLast = index === target.length - 1;

    if (error) {
      // If the target is not the last target, and the error is an
      // `InvalidPackageTargetError`, continue to the next target. Otherwise,
      // throw the error.
      if (!isLast && error instanceof InvalidPackageTargetError) {
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw error;
    }

    // If the target is successfully resolved, return the resolved target.
    if (isDefined(resolved)) {
      return resolved;
    }
  }

  return null;
}

/**
 * Resolve a package target, i.e., the target of a package's exports or imports,
 * based on the given conditions.
 *
 * @param packageUrl - The URL of the package.
 * @param target - The target to resolve.
 * @param patternMatch - The pattern match to use.
 * @param isImports - Whether the target is an import.
 * @param conditions - The conditions to use. When the target is an object, the
 * conditions are the keys of the object, which are used to resolve the target.
 * @param fileSystem - The file system to use for resolution.
 * @returns The resolved target.
 */
function resolvePackageTarget(
  packageUrl: string,
  target: PackageExports | null,
  patternMatch: string | null,
  isImports: boolean,
  conditions: string[],
  fileSystem: FileSystemInterface,
): string | null {
  if (typeof target === 'string') {
    return resolveStringPackageTarget(
      packageUrl,
      target,
      patternMatch,
      isImports,
      fileSystem,
    );
  }

  if (isObject(target)) {
    return resolveObjectPackageTarget(
      packageUrl,
      target,
      patternMatch,
      isImports,
      conditions,
      fileSystem,
    );
  }

  if (Array.isArray(target)) {
    return resolveArrayPackageTarget(
      packageUrl,
      target,
      patternMatch,
      isImports,
      conditions,
      fileSystem,
    );
  }

  // 4. Otherwise, if target is null, return null.
  if (target === null) {
    // 1. Return null.
    return null;
  }

  throw new InvalidPackageTargetError(packageUrl);
}

/**
 * Compare two pattern keys and return the comparison result. This can be used
 * with the `sort` method to sort pattern keys in descending order of
 * specificity.
 *
 * This function is implemented as defined in the Node.js specification, but
 * seems to contain legacy code that is not used in the current implementation,
 * like support for keys ending with `/`, which is not supported by the current
 * Node.js version.
 *
 * @param a - The first pattern key.
 * @param b - The second pattern key.
 * @returns The comparison result, i.e., -1 if `a` is less than `b`, 1 if `a` is
 * greater than `b`, and 0 if `a` is equal to `b`.
 */
export function comparePatternKeys(a: string, b: string): number {
  // 1. Assert: keyA ends with "/" or contains only a single "*".
  validatePatternKey(a);

  // 2. Assert: keyB ends with "/" or contains only a single "*".
  validatePatternKey(b);

  // 3. Let baseLengthA be the index of "*" in keyA plus one, if keyA contains
  // "*", or the length of keyA otherwise.
  const baseLengthA = a.includes('*') ? a.indexOf('*') + 1 : a.length;

  // 4. Let baseLengthB be the index of "*" in keyB plus one, if keyB contains
  // "*", or the length of keyB otherwise.
  const baseLengthB = b.includes('*') ? b.indexOf('*') + 1 : b.length;

  // 5. If baseLengthA is greater than baseLengthB, return -1.
  if (baseLengthA > baseLengthB) {
    return -1;
  }

  // 6. If baseLengthB is greater than baseLengthA, return 1.
  if (baseLengthB > baseLengthA) {
    return 1;
  }

  // 7. If keyA does not contain "*", return 1.
  if (!a.includes('*')) {
    return 1;
  }

  // 8. If keyB does not contain "*", return -1.
  if (!b.includes('*')) {
    return -1;
  }

  // 9. If the length of keyA is greater than the length of keyB, return -1.
  if (a.length > b.length) {
    return -1;
  }

  // 10. If the length of keyB is greater than the length of keyA, return 1.
  if (b.length > a.length) {
    return 1;
  }

  // 11. Return 0.
  return 0;
}

/**
 * Resolve a package's imports or exports.
 *
 * @param matchKey - The key to match.
 * @param matchObject - The object to match against.
 * @param packageUrl - The URL of the package.
 * @param isImports - Whether the target is an import.
 * @param conditions - The conditions to use.
 * @param fileSystem - The file system to use for resolution.
 * @returns The resolved target.
 */
function resolvePackageImportsExports(
  matchKey: string,
  matchObject: PackageExportsObject,
  packageUrl: string,
  isImports: boolean,
  conditions: string[],
  fileSystem: FileSystemInterface,
): string | null {
  // 1. If matchKey is a key of matchObj and does not contain "*", then
  if (matchKey in matchObject && !matchKey.includes('*')) {
    // 1. Let target be the value of matchObj[matchKey].
    const target = matchObject[matchKey] as PackageExports;

    // 2. Return the result of PACKAGE_TARGET_RESOLVE(packageURL, target, null, isImports, conditions).
    return resolvePackageTarget(
      packageUrl,
      target,
      null,
      isImports,
      conditions,
      fileSystem,
    );
  }

  // 2. Let expansionKeys be the list of keys of matchObj containing only a single
  // "*", sorted by the sorting function PATTERN_KEY_COMPARE which orders in
  // descending order of specificity.
  const expansionKeys = Object.keys(matchObject)
    .filter((key) => getCharacterCount(key, '*') === 1)
    .sort(comparePatternKeys);

  // 3. For each key expansionKey in expansionKeys, do
  for (const expansionKey of expansionKeys) {
    // 1. Let patternBase be the substring of expansionKey up to but excluding
    // the first "*" character.
    const patternBase = expansionKey.split('*')[0] as string;

    // 2. If matchKey starts with but is not equal to patternBase, then
    if (matchKey.startsWith(patternBase) && matchKey !== patternBase) {
      // 1. Let patternTrailer be the substring of expansionKey from the index
      // after the first "*" character.
      const patternTrailer = expansionKey.split('*')[1] as string;

      // 2. If patternTrailer has zero length, or if matchKey ends with
      // patternTrailer and the length of matchKey is greater than or equal to
      // the length of expansionKey, then
      if (
        patternTrailer.length === 0 ||
        (matchKey.endsWith(patternTrailer) &&
          matchKey.length >= expansionKey.length)
      ) {
        // 1. Let target be the value of matchObj[expansionKey].
        const target = matchObject[expansionKey] as PackageExports;

        // 2. Let patternMatch be the substring of matchKey starting at the
        // index of the length of patternBase up to the length of matchKey minus
        // the length of patternTrailer.
        const patternMatch = matchKey.slice(
          patternBase.length,
          matchKey.length - patternTrailer.length,
        );

        // 3. Return the result of
        // PACKAGE_TARGET_RESOLVE(packageURL, target, patternMatch, isImports, conditions).
        return resolvePackageTarget(
          packageUrl,
          target,
          patternMatch,
          isImports,
          conditions,
          fileSystem,
        );
      }
    }
  }

  // 4. Return null.
  return null;
}

/**
 * Resolve a package's exports. This checks the `exports` field of a package's
 * `package.json` file, and resolves the target of the package.
 *
 * @param packageUrl - The URL of the package.
 * @param packageSubpath - The subpath of the package to resolve.
 * @param exports - The exports object to resolve.
 * @param conditions - The conditions to use.
 * @param fileSystem - The file system to use for resolution.
 * @returns The resolved target.
 */
function resolvePackageExports(
  packageUrl: string,
  packageSubpath: string,
  exports: PackageExports,
  conditions: string[],
  fileSystem: FileSystemInterface,
) {
  // If exports is an Object with both a key starting with "." and a key not
  // starting with ".", throw an Invalid Package Configuration error.
  if (isObject(exports)) {
    validateExportsObject(packageUrl, exports);
  }

  if (packageSubpath === '.') {
    let mainExport;
    if (
      typeof exports === 'string' ||
      Array.isArray(exports) ||
      !isRelativeExports(exports)
    ) {
      mainExport = exports;
    }

    if (isRelativeExports(exports)) {
      mainExport = exports['.'];
    }

    if (mainExport) {
      const resolved = resolvePackageTarget(
        packageUrl,
        mainExport,
        null,
        false,
        conditions,
        fileSystem,
      );

      if (isDefined(resolved)) {
        return resolved;
      }
    }
  } else if (isRelativeExports(exports)) {
    assert(packageSubpath.startsWith('./'));
    const resolved = resolvePackageImportsExports(
      packageSubpath,
      exports,
      packageUrl,
      false,
      conditions,
      fileSystem,
    );

    if (isDefined(resolved)) {
      return resolved;
    }
  }

  throw new PackagePathNotExportedError(packageSubpath);
}

/**
 * Resolve a package from the current package.
 *
 * @param packageName - The name of the package to resolve.
 * @param packageSubpath - The subpath of the package to resolve.
 * @param parentUrl - The URL of the parent module.
 * @param fileSystem - The file system to use for resolution.
 * @returns The resolved URL.
 */
function resolveSelf(
  packageName: string,
  packageSubpath: string,
  parentUrl: string | URL,
  fileSystem: FileSystemInterface,
): string | null {
  // 1. Let packageURL be the result of LOOKUP_PACKAGE_SCOPE(parentURL).
  const packageUrl = getPackageScope(parentUrl, fileSystem);

  // 2. If packageURL is null, then
  if (packageUrl === null) {
    // 1. Return undefined.
    return null;
  }

  const packageJson = getPackageJson(packageUrl, fileSystem);

  // 4. If pjson is null or if pjson.exports is null or undefined, then
  if (packageJson === null || !packageJson.exports) {
    // 1. Return undefined
    return null;
  }

  // 5. If pjson.name is equal to packageName, then
  if (packageName === packageJson.name) {
    // 5.1. Return the result of
    //      PACKAGE_EXPORTS_RESOLVE(packageURL, packageSubpath, pjson.exports, defaultConditions).
    return resolvePackageExports(
      packageUrl,
      packageSubpath,
      packageJson.exports,
      DEFAULT_CONDITIONS,
      fileSystem,
    );
  }

  return null;
}

/**
 * Resolve a package from the `node_modules` directory.
 *
 * This checks the current directory and all parent directories for the
 * `node_modules` directory.
 *
 * @param packageSpecifier - The package specifier to resolve.
 * @param packageSubpath - The subpath of the package to resolve.
 * @param parentUrl - The URL of the parent module.
 * @param fileSystem - The file system to use for resolution.
 * @returns The resolved URL.
 */
function resolvePackageFromNodeModules(
  packageSpecifier: string,
  packageSubpath: string,
  parentUrl: string | URL,
  fileSystem: FileSystemInterface,
) {
  let parent = fileURLToPath(parentUrl);

  while (parent !== '/') {
    // 1. Let packageURL be the URL resolution of "node_modules/" concatenated
    // with packageSpecifier, relative to parentURL.
    const packageUrl = resolvePath(parent, 'node_modules', packageSpecifier);

    if (fileSystem.isDirectory(packageUrl)) {
      const packageJson = getPackageJson(packageUrl, fileSystem);
      if (packageJson) {
        // 1. If pjson is not null and pjson.exports is not null or undefined,
        // then
        if (packageJson.exports) {
          // 1. Return the result of
          // `PACKAGE_EXPORTS_RESOLVE(packageURL, packageSubpath, pjson.exports, defaultConditions).`
          return resolvePackageExports(
            packageUrl,
            packageSubpath,
            packageJson.exports,
            DEFAULT_CONDITIONS,
            fileSystem,
          );
        }

        if (packageSubpath === '.' && packageJson.main) {
          return resolvePath(packageUrl, packageJson.main);
        }

        return resolvePath(packageUrl, packageSubpath);
      }
    }

    // 2. Set parentURL to the parent folder URL of parentURL.
    parent = resolvePath(parent, '..');
  }

  throw new ModuleNotFoundError(joinPosix(packageSpecifier, packageSubpath));
}

/**
 * Resolve an external package specifier.
 *
 * @param packageSpecifier - The package specifier to resolve.
 * @param parentUrl - The URL of the parent module.
 * @param fileSystem - The file system to use for resolution.
 * @returns The resolved URL.
 */
function resolvePackage(
  packageSpecifier: string,
  parentUrl: string | URL,
  fileSystem: FileSystemInterface,
): string {
  // 2. If packageSpecifier is an empty string, then
  if (packageSpecifier === '') {
    // 1. Throw an Invalid Module Specifier error.
    throw new InvalidModuleSpecifierError(packageSpecifier);
  }

  if (isBuiltin(packageSpecifier)) {
    return `node:${packageSpecifier}`;
  }

  const packageName = getPackageName(packageSpecifier);

  // 6. If packageName starts with "." or contains "\" or "%", then
  if (
    packageName.startsWith('.') ||
    packageName.includes('\\') ||
    packageName.includes('%')
  ) {
    // 1. Throw an Invalid Module Specifier error.
    throw new InvalidModuleSpecifierError(packageSpecifier);
  }

  // 7. Let packageSubpath be "." concatenated with the substring of
  // packageSpecifier from the position at the length of packageName.
  const packageSubpath = `.${packageSpecifier.slice(packageName.length)}`;

  // 8. If packageSubpath ends in "/", then
  if (packageSubpath.endsWith('/')) {
    // 1. Throw an Invalid Module Specifier error.
    throw new InvalidModuleSpecifierError(packageSpecifier);
  }

  // 9. Let selfUrl be the result of PACKAGE_SELF_RESOLVE(packageName, packageSubpath, parentURL).
  const selfUrl = resolveSelf(
    packageName,
    packageSubpath,
    parentUrl,
    fileSystem,
  );

  // 10. If selfUrl is not undefined, return selfUrl.
  if (isDefined(selfUrl)) {
    return selfUrl;
  }

  // 11. While parentURL is not the file system root,
  return resolvePackageFromNodeModules(
    packageName,
    packageSubpath,
    parentUrl,
    fileSystem,
  );
}

/**
 * Resolve a package import, i.e., a package specifier that starts with `#`.
 *
 * @param packageSpecifier - The package specifier to resolve.
 * @param parentUrl - The URL of the parent module.
 * @param fileSystem - The file system to use for resolution.
 * @returns The resolved URL.
 */
function resolvePackageImports(
  packageSpecifier: string,
  parentUrl: string | URL,
  fileSystem: FileSystemInterface,
): string {
  // 1. Assert: specifier begins with "#".
  assert(packageSpecifier.startsWith('#'));

  // 2. If specifier is exactly equal to "#" or starts with "#/", then
  if (packageSpecifier === '#' || packageSpecifier.startsWith('#/')) {
    // 1. Throw an Invalid Module Specifier error.
    throw new InvalidModuleSpecifierError(packageSpecifier);
  }

  // 3. Let packageURL be the result of LOOKUP_PACKAGE_SCOPE(parentURL).
  const packagePath = getPackageScope(parentUrl, fileSystem);

  // 4. If packageURL is not null, then
  if (isDefined(packagePath)) {
    // 1. Let pjson be the result of READ_PACKAGE_JSON(packageURL).
    const packageJson = getPackageJson(packagePath, fileSystem);

    // 2. If pjson.imports is a non-null Object, then
    if (isObject(packageJson?.imports)) {
      // 1. Let resolved be the result of
      // PACKAGE_IMPORTS_EXPORTS_RESOLVE( specifier, pjson.imports, packageURL, true, conditions).
      const resolved = resolvePackageImportsExports(
        packageSpecifier,
        packageJson.imports,
        packagePath,
        true,
        DEFAULT_CONDITIONS,
        fileSystem,
      );

      // 2. If resolved is not null or undefined, return resolved.
      if (isDefined(resolved)) {
        return resolved;
      }
    }
  }

  // 5. Throw a Package Import Not Defined error.
  throw new PackageImportNotDefinedError(packageSpecifier);
}

/**
 * Get the scope of a package, i.e., the directory containing the `package.json`
 * file.
 *
 * @param resolvedSpecifier - The resolved URL of the package. See
 * {@link getResolvedUrl}.
 * @param fileSystem - The file system to use for resolution.
 * @returns The scope of the package.
 */
function getPackageScope(
  resolvedSpecifier: string | URL,
  fileSystem: FileSystemInterface,
): string | null {
  // 1. Let scopeURL be url.
  let scopeUrl = fileURLToPath(resolvedSpecifier);

  // 2. While scopeURL is not the file system root,
  // TODO: Check if at file system root on Windows.
  while (scopeUrl !== '/') {
    // 1. Set scopeURL to the parent URL of scopeURL.
    scopeUrl = resolvePath(scopeUrl, '..');

    // 2. If scopeURL ends in a "node_modules" path segment, return null.
    const lastSegment = basename(scopeUrl);
    if (lastSegment === 'node_modules') {
      return null;
    }

    // 3. Let pjsonURL be the resolution of "package.json" within scopeURL.
    const packageJsonUrl = resolvePath(scopeUrl, 'package.json');
    if (fileSystem.isFile(packageJsonUrl)) {
      return scopeUrl;
    }
  }

  return null;
}

/**
 * Get the `package.json` file for a given package URL.
 *
 * @param packageUrl - The URL of the package.
 * @param fileSystem - The file system to use for resolution.
 * @returns The `package.json` file.
 */
function getPackageJson(
  packageUrl: string | null,
  fileSystem: FileSystemInterface,
): PackageJson | null {
  if (!packageUrl) {
    return null;
  }

  const packageJsonUrl = resolvePath(packageUrl, 'package.json');
  if (!fileSystem.isFile(packageJsonUrl)) {
    return null;
  }

  const packageJsonValue = fileSystem.readFile(packageJsonUrl);
  const packageJson = parseJson<PackageJson>(packageJsonValue);

  if (packageJson === null) {
    throw new InvalidPackageConfigurationError(packageUrl);
  }

  return packageJson;
}

/**
 * Get the format of a package for a given URL.
 *
 * @param resolvedSpecifier - The resolved URL of the package. See
 * {@link getResolvedUrl}.
 * @param fileSystem - The file system to use for resolution.
 * @returns The format of the package.
 */
function getPackageFormat(
  resolvedSpecifier: string,
  fileSystem: FileSystemInterface,
): FileFormat | null {
  // 1. Assert: url corresponds to an existing file.
  const path = fileURLToPath(resolvedSpecifier);
  assert(fileSystem.isFile(path));

  // 2. If url ends in ".mjs", then
  //    1. Return "module".
  if (resolvedSpecifier.endsWith('.mjs')) {
    return 'module';
  }

  // 3. If url ends in ".cjs", then
  //    1. Return "commonjs".
  if (resolvedSpecifier.endsWith('.cjs')) {
    return 'commonjs';
  }

  // 4. If url ends in ".json", then
  //    1. Return "json".
  if (resolvedSpecifier.endsWith('.json')) {
    return 'json';
  }

  // 5. If `--experimental-wasm-modules` is enabled and url ends in ".wasm", then
  //    1. Return "wasm".
  if (
    isFlagEnabled('--experimental-wasm-modules') &&
    resolvedSpecifier.endsWith('.wasm')
  ) {
    return 'wasm';
  }

  // 6. Let packageURL be the result of LOOKUP_PACKAGE_SCOPE(url).
  const packageUrl = getPackageScope(resolvedSpecifier, fileSystem);

  // 7. Let pjson be the result of READ_PACKAGE_JSON(packageURL).
  const packageJson = getPackageJson(packageUrl, fileSystem);

  if (resolvedSpecifier.endsWith('.js')) {
    if (packageJson?.type) {
      return packageJson.type;
    }

    // 2. If --experimental-detect-module is enabled and the result of
    //    DETECT_MODULE_SYNTAX(source) is true, then
    // eslint-disable-next-line no-constant-condition
    // if (isFlagEnabled('--experimental-detect-module')) {
    //   TODO: Experimental module detection.
    // }

    return 'commonjs';
  }

  // 11. If url does not have any extension, then
  if (extname(resolvedSpecifier) === '') {
    // 1. If packageType is "module" and --experimental-wasm-modules is enabled
    // and the file at url contains the header for a WebAssembly module, then
    if (isFlagEnabled('--experimental-wasm-modules')) {
      const content = fileSystem.readBytes(path, 4);

      // WASM_BINARY_MAGIC = 0x0061736d
      if (
        content[0] === 0x00 &&
        content[1] === 0x61 &&
        content[2] === 0x73 &&
        content[3] === 0x6d
      ) {
        // 1. Return "wasm".
        return 'wasm';
      }
    }

    // 2. If packageType is not null, then
    if (packageJson?.type) {
      // Return packageType.
      return packageJson.type;
    }

    // 3. If --experimental-detect-module is enabled and the result of
    //    DETECT_MODULE_SYNTAX(source) is true, then
    // if (isFlagEnabled('--experimental-detect-module')) {
    //   TODO: Experimental module detection.
    // }
  }

  return null;
}
