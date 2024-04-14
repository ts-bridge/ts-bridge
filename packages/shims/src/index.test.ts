import { describe, expect, it } from 'vitest';

import * as index from './index.js';

describe('index', () => {
  it('has the expected exports', () => {
    expect(Object.keys(index)).toMatchInlineSnapshot(`
      [
        "getImportMetaUrl",
      ]
    `);
  });
});
