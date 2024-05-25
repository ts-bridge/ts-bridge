import { describe, expect, it } from 'vitest';

import { resolve } from './resolver.js';

describe('resolve', () => {
  it('resolves a package', () => {
    expect(resolve('vite/runtime', import.meta.url)).toStrictEqual({
      path: expect.stringContaining(
        'ts-bridge/node_modules/vite/dist/node/runtime.js',
      ),
      format: 'module',
    });

    expect(resolve('typescript', import.meta.url)).toStrictEqual({
      path: expect.stringContaining(
        'ts-bridge/node_modules/typescript/lib/typescript.js',
      ),
      format: 'commonjs',
    });
  });
});
