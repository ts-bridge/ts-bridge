import { describe, expect, it } from 'vitest';

import { getBuildTypeOptions } from './build-type.js';

describe('getBuildTypeOptions', () => {
  it('returns the options for the module build type', () => {
    expect(getBuildTypeOptions('module')).toMatchInlineSnapshot(`
      {
        "declarationExtension": ".d.mts",
        "extension": ".mjs",
        "getShimsTransformers": [Function],
        "getTransformers": [Function],
        "name": "ES module",
        "target": 99,
      }
    `);
  });

  it('returns the options for the commonjs build type', () => {
    expect(getBuildTypeOptions('commonjs')).toMatchInlineSnapshot(`
      {
        "declarationExtension": ".d.cts",
        "extension": ".cjs",
        "getShimsTransformers": [Function],
        "getTransformers": [Function],
        "name": "CommonJS module",
        "target": 1,
      }
    `);
  });

  it('throws an error for an unknown build type', () => {
    expect(() =>
      // @ts-expect-error - Testing invalid input.
      getBuildTypeOptions('unknown'),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Unknown build type: "unknown".]`,
    );
  });
});
