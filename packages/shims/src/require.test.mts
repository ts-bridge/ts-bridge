import { describe, expect, it } from 'vitest';

import { require } from './require.mjs';
import * as requireModule from './require.mjs';

describe('requireModule', () => {
  it('has the expected exports', () => {
    expect(Object.keys(requireModule)).toMatchInlineSnapshot(`
      [
        "require",
      ]
    `);
  });
});

describe('require', () => {
  it('requires a module from a URL', () => {
    const { resolve } = require('path/posix', import.meta.url);

    expect(resolve).toBeInstanceOf(Function);
    expect(resolve('/foo', 'bar')).toBe('/foo/bar');
  });
});
