import { InvalidModuleSpecifierError } from './errors.js';
import type {
  FileFormat,
  PackageExports,
  PackageExportsObject,
} from './types.js';

/**
 * Check if the given string is a valid URL.
 *
 * @param url - The string to check.
 * @returns `true` if the string is a valid URL, `false` otherwise.
 */
export function isURL(url: string): boolean {
  return URL.canParse(url);
}

/**
 * Get the protocol for a URL string.
 *
 * @param url - The URL string. This function assumes that this URL is valid.
 * @returns The protocol for the URL string.
 */
export function getProtocol(url: string): string {
  return new URL(url).protocol;
}

/**
 * Check if the given string is a path, starting with `/`, `./`, or `../`.
 *
 * @param url - The string to check.
 * @returns `true` if the string is a path, `false` otherwise.
 */
export function isPath(url: string): boolean {
  return url.startsWith('/') || url.startsWith('./') || url.startsWith('../');
}

/**
 * Try to parse a string value as JSON.
 *
 * @param value - The value to try to parse.
 * @returns The parsed JSON value, or `null` if the value is not valid JSON.
 */
export function parseJson<Type>(value: string): Type | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Check if a value is an object (and not an array or `null`).
 *
 * @param value - The value to check.
 * @returns `true` if the value is an object, `false` otherwise.
 */
export function isObject(
  value: unknown,
): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if the given exports object is a relative exports object, i.e., it
 * contains keys that start with a dot.
 *
 * @param exports - The exports object to check.
 * @returns `true` if the exports object is a relative exports object, `false`
 * otherwise.
 */
export function isRelativeExports(
  exports: PackageExports,
): exports is PackageExportsObject {
  return (
    isObject(exports) &&
    Object.keys(exports).every((key) => key.startsWith('.'))
  );
}

/**
 * Check if the given value is defined (not `null` or `undefined`).
 *
 * @param value - The value to check.
 * @returns `true` if the value is defined, `false` otherwise.
 */
export function isDefined<Type>(value: Type | null | undefined): value is Type {
  return value !== null && value !== undefined;
}

/**
 * Get the number of occurrences of a character in a string.
 *
 * @param value - The string to search.
 * @param character - The character to search for.
 * @returns The number of occurrences of the character in the string.
 */
export function getCharacterCount(value: string, character: string): number {
  return value.split(character).length - 1;
}

/**
 * Check if the given flag is enabled in the current process.
 *
 * @param flag - The flag to check.
 * @param execArgv - The `process.execArgv` array to check. This is useful for
 * testing.
 * @returns `true` if the flag is enabled, `false` otherwise.
 */
export function isFlagEnabled(
  flag: '--experimental-detect-module' | '--experimental-wasm-modules',
  execArgv = process.execArgv,
): boolean {
  return execArgv.includes(flag);
}

/**
 * Get the MIME type of a data URL. Node.js supports several types of `data:`
 * URLs, such as:
 *
 * - `data:text/javascript,console.log('Hello, world!');` for ES modules.
 * - `data:application/json,{"hello":"world"}` for JSON modules.
 * - `data:application/wasm;base64,...` for WebAssembly modules.
 *
 * This function returns the MIME type of the data URL, such as
 * `text/javascript`, `application/json`, or `application/wasm`.
 *
 * @param url - The data URL.
 * @returns The MIME type of the data URL.
 * @throws {InvalidModuleSpecifierError} If the data URL is not valid or
 * unsupported.
 */
export function getDataUrlMimeType(url: string): string {
  const mimeType = url.split(':')[1]?.split(',')[0];
  if (!mimeType) {
    throw new InvalidModuleSpecifierError(url);
  }

  return mimeType;
}

/**
 * Get the file format of a data URL. Node.js supports several types of `data:`
 * URLs, such as:
 *
 * - `data:text/javascript,console.log('Hello, world!');` for ES modules.
 * - `data:application/json,{"hello":"world"}` for JSON modules.
 * - `data:application/wasm;base64,...` for WebAssembly modules.
 *
 * This function returns the file format of the data URL, such as `module`,
 * `json`, or `wasm`.
 *
 * @param url - The data URL.
 * @returns The file format of the data URL.
 * @throws {InvalidModuleSpecifierError} If the data URL is not valid or
 * unsupported.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
 */
export function getDataUrlType(url: string): FileFormat {
  const mimeType = getDataUrlMimeType(url);
  switch (mimeType) {
    case 'text/javascript':
      return 'module';
    case 'application/json':
      return 'json';
    case 'application/wasm':
      return 'wasm';
    default:
      throw new InvalidModuleSpecifierError(url);
  }
}
