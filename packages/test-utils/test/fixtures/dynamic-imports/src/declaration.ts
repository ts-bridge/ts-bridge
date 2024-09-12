import { Foo } from './dummy';

/**
 * This function results in a case where TypeScript emits the declaration file
 * with a dynamic import.
 *
 * @returns A class that extends `Foo`.
 */
export function bar() {
  return class Bar extends Foo {};
}
