import { resolve as resolvePath } from 'path';
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
