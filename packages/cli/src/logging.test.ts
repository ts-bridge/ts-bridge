import { noOp } from '@ts-bridge/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { getLoggingTransformer } from './logging.js';

describe('getLoggingTransformer', () => {
  it('logs the current file when verbose is enabled', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(noOp);

    const transformer = getLoggingTransformer(true)();
    const sourceFile = { fileName: 'file.ts' };

    // @ts-expect-error - Partial source file.
    expect(transformer(sourceFile)).toBe(sourceFile);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Transforming source file'),
    );
  });

  it('does not log the current file when verbose is disabled', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(noOp);

    const transformer = getLoggingTransformer(false)();
    const sourceFile = { fileName: 'file.ts' };

    // @ts-expect-error - Partial source file.
    expect(transformer(sourceFile)).toBe(sourceFile);
    expect(log).not.toHaveBeenCalled();
  });
});
