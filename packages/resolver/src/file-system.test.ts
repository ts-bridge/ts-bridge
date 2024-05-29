import { getPathFromRoot } from '@ts-bridge/test-utils';
import { describe, expect, it } from 'vitest';

import { DEFAULT_FILE_SYSTEM } from './file-system.js';

// eslint-disable-next-line @typescript-eslint/unbound-method
const { isDirectory, isFile, readFile, readBytes } = DEFAULT_FILE_SYSTEM;

describe('DEFAULT_FILE_SYSTEM', () => {
  describe('isDirectory', () => {
    it('returns true for directories', () => {
      expect(isDirectory(getPathFromRoot(''))).toBe(true);
    });

    it('returns false for files', () => {
      expect(isDirectory(getPathFromRoot('package.json'))).toBe(false);
    });

    it('returns false for non-existent paths', () => {
      expect(isDirectory(getPathFromRoot('non-existent'))).toBe(false);
    });
  });

  describe('isFile', () => {
    it('returns true for files', () => {
      expect(isFile(getPathFromRoot('package.json'))).toBe(true);
    });

    it('returns false for directories', () => {
      expect(isFile(getPathFromRoot(''))).toBe(false);
    });

    it('returns false for non-existent paths', () => {
      expect(isFile(getPathFromRoot('non-existent'))).toBe(false);
    });
  });

  describe('readFile', () => {
    it('reads the contents of a file', () => {
      expect(readFile(getPathFromRoot('package.json'))).toContain(
        '"name": "@ts-bridge/root"',
      );
    });

    it('throws an error for directories', () => {
      expect(() => readFile(getPathFromRoot(''))).toThrow(
        'EISDIR: illegal operation on a directory, read',
      );
    });

    it('throws an error for non-existent paths', () => {
      expect(() => readFile(getPathFromRoot('non-existent'))).toThrow(
        'ENOENT: no such file or directory, open',
      );
    });
  });

  describe('readBytes', () => {
    it('reads a specific number of bytes from a file', () => {
      expect(readBytes(getPathFromRoot('package.json'), 10)).toEqual(
        new Uint8Array([123, 10, 32, 32, 34, 110, 97, 109, 101, 34]),
      );
    });

    it('throws an error for directories', () => {
      expect(() => readBytes(getPathFromRoot(''), 10)).toThrow(
        'EISDIR: illegal operation on a directory, read',
      );
    });

    it('throws an error for non-existent paths', () => {
      expect(() => readBytes(getPathFromRoot('non-existent'), 10)).toThrow(
        'ENOENT: no such file or directory, open',
      );
    });
  });
});
