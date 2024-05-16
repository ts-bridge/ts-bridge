import { describe, expect, it } from 'vitest';

import { importDefault } from './module.mjs';
import * as module from './module.mjs';

describe('module', () => {
  it('has the expected exports', () => {
    expect(Object.keys(module)).toMatchInlineSnapshot(`
      [
        "importDefault",
      ]
    `);
  });
});

describe('importDefault', () => {
  it('imports the default export from a module', () => {
    const mockModule = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      __esModule: true as const,
      default: 'default export',
      foo: 'bar',
    };

    expect(importDefault(mockModule)).toBe('default export');
  });

  it('returns the module itself if it does not have a default export', () => {
    const mockModule = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      __esModule: false as const,
      foo: 'bar',
    };

    expect(importDefault(mockModule)).toBe(mockModule);
  });
});
