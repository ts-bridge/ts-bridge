import { sys } from 'typescript';
import { describe, expect, it } from 'vitest';

import { getTransformers } from './build-utils.js';

describe('getTransformers', () => {
  it('returns the correct transformers for the `module` format', () => {
    const transformers = getTransformers(
      'module',
      {
        system: sys,
        // @ts-expect-error - The `typeChecker` parameter is invalid.
        typeChecker: {},
      },
      true,
    );

    expect(transformers).toHaveLength(6);
  });

  it('returns the correct transformers for the `commonjs` format', () => {
    const transformers = getTransformers(
      'commonjs',
      {
        system: sys,
        // @ts-expect-error - The `typeChecker` parameter is invalid.
        typeChecker: {},
      },
      true,
    );

    expect(transformers).toHaveLength(3);
  });

  it('returns the correct transformers for the `module` format without shims', () => {
    const transformers = getTransformers(
      'module',
      {
        system: sys,
        // @ts-expect-error - The `typeChecker` parameter is invalid.
        typeChecker: {},
      },
      false,
    );

    expect(transformers).toHaveLength(4);
  });

  it('returns the correct transformers for the `commonjs` format without shims', () => {
    const transformers = getTransformers(
      'commonjs',
      {
        system: sys,
        // @ts-expect-error - The `typeChecker` parameter is invalid.
        typeChecker: {},
      },
      false,
    );

    expect(transformers).toHaveLength(2);
  });
});
