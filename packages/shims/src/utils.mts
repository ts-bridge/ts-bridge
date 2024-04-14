/**
 * Convert a file URL (starting with `file:`) to an absolute path.
 *
 * This function does not do any validation of the input, since it's assumed
 * that the input is always a valid file URL.
 *
 * This function is a simplified version of the `fileURLToPath` function in
 * Node.js and does not handle edge cases like file URLs that contain invalid
 * characters.
 *
 * This is used to avoid the need for polyfills in browser environments.
 *
 * @param fileUrl - The file URL to convert.
 * @returns The absolute path.
 */
export function fileURLToPath(fileUrl: string) {
  const url = new URL(fileUrl);
  return url.pathname.replace(/^\/([a-zA-Z]:)/u, '$1');
}

/**
 * Get the directory name of a path, similar to the `dirname` function of
 * `node:path`.
 *
 * This function is a simplified version of the `dirname` function in Node.js.
 * It does not handle edge cases like paths that end with multiple slashes or
 * paths that contain invalid characters. It is assumed that the input is always
 * a valid path.
 *
 * This is used to avoid the need for polyfills in browser environments.
 *
 * @param path - The path to get the directory name of.
 * @returns The directory name.
 */
export function dirname(path: string) {
  const sanitisedPath = path
    .toString()
    .replace(/\\/gu, '/')
    .replace(/\/$/u, '');

  const index = sanitisedPath.lastIndexOf('/');
  if (index === -1) {
    return path;
  }

  if (index === 0) {
    return '/';
  }

  return sanitisedPath.slice(0, index);
}
