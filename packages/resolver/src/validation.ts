import assert from 'assert';

import { InvalidPackageConfigurationError } from './errors.js';
import type { PackageExportsObject } from './types.js';
import { getCharacterCount } from './utils.js';

/**
 * Check if a set of path segments is valid, i.e. it does not contain empty
 * segments, dot segments, parent segments, or `node_modules` segments.
 *
 * @param pathSegments - The path segments to validate.
 * @returns `true` if the path segments are valid, `false` otherwise.
 */
export function isValidPathSegments(pathSegments: string[]): boolean {
  return (
    !pathSegments.includes('') &&
    !pathSegments.includes('.') &&
    !pathSegments.includes('..') &&
    !pathSegments.includes('node_modules')
  );
}

/**
 * Check if a path is valid, i.e. it does not contain empty segments, dot
 * segments, parent segments, or `node_modules` segments.
 *
 * @param path - The path to validate.
 * @returns `true` if the path is valid, `false` otherwise.
 */
export function isValidPath(path: string): boolean {
  const lowerCasePath = path.toLowerCase();

  return (
    isValidPathSegments(lowerCasePath.split('/')) &&
    isValidPathSegments(lowerCasePath.split('\\'))
  );
}

/**
 * Validate the exports object of a package, ensuring that it does not contain
 * a mix of keys that start with a dot and keys that do not start with a dot.
 *
 * @param packageUrl - The URL of the package being validated.
 * @param exports - The exports object to validate.
 * @throws {InvalidPackageConfigurationError} If the exports object contains a
 * mix of keys that start with a dot and keys that do not start with a dot.
 */
export function validateExportsObject(
  packageUrl: string,
  exports: PackageExportsObject,
) {
  const keys = Object.keys(exports);

  let startsWithDot = false;
  let startsWithoutDot = false;

  for (const key of keys) {
    if (key.startsWith('.')) {
      startsWithDot = true;
    } else {
      startsWithoutDot = true;
    }

    if (startsWithDot && startsWithoutDot) {
      throw new InvalidPackageConfigurationError(packageUrl);
    }

    // If target contains any index property keys, as defined in ECMA-262 6.1.7
    // Array Index, throw an Invalid Package Configuration error.
    // This step is done later in the spec, but we do it here to avoid
    // unnecessary iteration.
    if (!Number.isNaN(parseInt(key, 10))) {
      throw new InvalidPackageConfigurationError(packageUrl);
    }
  }
}

/**
 * Validate a pattern key, ensuring that it ends with a slash or contains a
 * single asterisk character.
 *
 * @param key - The pattern key to validate.
 * @throws {AssertionError} If the pattern key is invalid.
 */
export function validatePatternKey(key: string) {
  assert(key.endsWith('/') || getCharacterCount(key, '*') === 1);
}
