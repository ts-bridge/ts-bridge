import { statSync, readFileSync, openSync, readSync, closeSync } from 'fs';

/**
 * Interface for file system operations.
 *
 * This interface is used to abstract file system operations in order to make
 * the module resolver platform-agnostic.
 */
export type FileSystemInterface = {
  /**
   * Check if the given path is a directory.
   *
   * @param path - The path to check.
   * @returns `true` if the path is a directory, `false` otherwise.
   */
  isDirectory(path: string): boolean;

  /**
   * Check if the given path is a file.
   *
   * @param path - The path to check.
   * @returns `true` if the path is a file, `false` otherwise.
   */
  isFile(path: string): boolean;

  /**
   * Read the contents of a file.
   *
   * @param path - The path to the file.
   * @returns The contents of the file.
   */
  readFile(path: string): string;

  /**
   * Read a specific number of bytes from a file.
   *
   * @param path - The path to the file.
   * @param length - The number of bytes to read.
   * @returns The bytes read from the file.
   */
  readBytes(path: string, length: number): Uint8Array;
};

/**
 * Default file system implementation using Node.js file system APIs.
 */
export const DEFAULT_FILE_SYSTEM: FileSystemInterface = {
  isDirectory(path: string): boolean {
    try {
      const stat = statSync(path);
      return stat.isDirectory();
    } catch {
      return false;
    }
  },

  isFile(path: string): boolean {
    try {
      const stat = statSync(path);
      return stat.isFile();
    } catch {
      return false;
    }
  },

  readFile(path: string): string {
    return readFileSync(path, 'utf-8');
  },

  readBytes(path: string, length: number): Uint8Array {
    const buffer = new Uint8Array(length);
    const descriptor = openSync(path, 'r');

    readSync(descriptor, buffer, 0, length, 0);
    closeSync(descriptor);

    return buffer;
  },
};
