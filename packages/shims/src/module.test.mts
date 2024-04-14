import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

import { __dirname, __filename } from './module.mjs';
import * as module from './module.mjs';

describe('module', () => {
  it('has the expected exports', () => {
    expect(Object.keys(module)).toMatchInlineSnapshot(`
      [
        "__filename",
        "__dirname",
      ]
    `);
  });
});

describe('__filename', () => {
  it('returns the URL of the current file', () => {
    expect(__filename(import.meta.url)).toBe(fileURLToPath(import.meta.url));
  });
});

describe('__dirname', () => {
  it('returns the directory name of the current file', () => {
    expect(__dirname(import.meta.url)).toBe(
      dirname(fileURLToPath(import.meta.url)),
    );

    expect(__dirname('file:///index.mjs')).toBe('/');
  });
});
