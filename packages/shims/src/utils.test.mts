import { describe, expect, it } from 'vitest';

import { dirname, fileURLToPath } from './utils.mjs';

describe('fileURLToPath', () => {
  it('returns the absolute path of a file URL', () => {
    expect(fileURLToPath('file:///path/to/file.js')).toBe('/path/to/file.js');
  });

  it('returns the absolute path of a file URL with a Windows drive letter', () => {
    expect(fileURLToPath('file:///C:/path/to/file.js')).toBe(
      'C:/path/to/file.js',
    );
  });
});

describe('dirname', () => {
  it('returns the directory name of a path', () => {
    expect(dirname('/path/to/file.js')).toBe('/path/to');
  });

  it('returns the directory name of a path without a file name', () => {
    expect(dirname('/path/to/')).toBe('/path');
  });

  it('returns the directory name of a path without a file name', () => {
    expect(dirname('/')).toBe('/');
  });

  it('returns the directory name of a path with a Windows drive letter', () => {
    expect(dirname('C:/path/to/file.js')).toBe('C:/path/to');
  });

  it('returns the directory name of a path with a Windows drive letter and without a file name', () => {
    expect(dirname('C:/path/to/')).toBe('C:/path');
  });

  it('returns the directory name of a path with a Windows drive letter and without a file name', () => {
    expect(dirname('C:/')).toBe('C:/');
  });
});
