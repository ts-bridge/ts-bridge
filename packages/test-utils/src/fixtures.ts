import { relative, resolve } from 'path';

/**
 * Get the path to a fixture project in the `test/fixtures` directory.
 *
 * @param name - The name of the fixture project.
 * @param path - Additional path segments to join.
 * @returns The absolute path to the fixture project.
 */
export function getFixture(name: string, ...path: string[]): string {
  return resolve(import.meta.dirname, '..', 'test', 'fixtures', name, ...path);
}

/**
 * Get the relative path to a file in a fixture project.
 *
 * @param name - The name of the fixture project.
 * @param path - The path to the file.
 * @returns The relative path to the file in the fixture project.
 */
export function getRelativePath(name: string, path: string) {
  return relative(getFixture(name), path);
}
