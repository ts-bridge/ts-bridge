import { readdir, rm } from 'fs/promises';
import { join, relative, resolve as resolvePath } from 'path';
import { fileURLToPath } from 'url';

type FileEntry = {
  type: 'file';
  content: string | Uint8Array;
};

type DirectoryEntry = {
  type: 'directory';
};

export type Entry = FileEntry | DirectoryEntry;

/**
 * The options for the virtual file system. The key is the path to the file or
 * directory, and the value is the content of the file, or object representing
 * the directory.
 */
export type FileSystemOptions = Record<string, string | Uint8Array | Entry>;

/**
 * Get a basic virtual read-only file system for testing purposes. It does not
 * support writing to the file system.
 *
 * @param options - The options for the virtual file system.
 * @returns The virtual file system.
 */
export function getFileSystem(options: FileSystemOptions = {}) {
  const entries: [string, Entry][] = Object.entries(options).map(
    ([path, value]) => {
      if (typeof value === 'string') {
        return [path, { type: 'file', content: value }];
      }

      if (value instanceof Uint8Array) {
        return [path, { type: 'file', content: value }];
      }

      return [path, value];
    },
  );

  const fileSystem = new Map<string, Entry>(entries);
  const fileSystemInterface = {
    readRawFile: (path: string) => {
      const entry = fileSystem.get(path);
      if (!entry) {
        throw new Error(`File not found: ${path}`);
      }

      if (entry.type === 'directory') {
        throw new Error(`Cannot read directory: ${path}`);
      }

      return entry.content;
    },

    isDirectory: (path: string) => {
      const entry = fileSystem.get(path);
      return entry?.type === 'directory';
    },

    isFile: (path: string) => {
      const entry = fileSystem.get(path);
      return entry?.type === 'file';
    },

    readFile: (path: string) => {
      const entry = fileSystemInterface.readRawFile(path);
      if (typeof entry === 'string') {
        return entry;
      }

      return new TextDecoder().decode(entry);
    },

    readBytes: (path: string, length: number) => {
      const content = fileSystemInterface.readRawFile(path);
      if (typeof content === 'string') {
        return new TextEncoder().encode(content).slice(0, length);
      }

      return content.slice(0, length);
    },
  };

  return fileSystemInterface;
}

const ROOT_PATH = resolvePath(fileURLToPath(import.meta.url), '../../../..');

/**
 * Get an absolute path from the root of the project.
 *
 * @param path - The path relative to the root of the project.
 * @returns The absolute path.
 */
export function getPathFromRoot(path: string): string {
  return resolvePath(ROOT_PATH, path);
}

/**
 * Remove a directory and all its contents.
 *
 * @param path - The path to the directory to remove.
 * @throws If the directory cannot be removed.
 */
export async function removeDirectory(path: string) {
  try {
    await rm(path, { recursive: true });
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }
  }
}

/**
 * Read all entries in the given directories, non-recursively.
 *
 * @param baseDirectory - The base directory of the directories.
 * @param directories - The directories to read.
 * @returns The entries in the directories.
 */
export async function readDirectories(
  baseDirectory: string,
  directories: string[],
) {
  const entries: string[] = [];
  for (const directory of directories) {
    const entriesInDirectory = await readdir(directory);

    entriesInDirectory
      .map((entry) => relative(baseDirectory, join(directory, entry)))
      .forEach((entry) => entries.push(entry));
  }

  return entries;
}
