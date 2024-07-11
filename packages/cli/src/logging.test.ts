import { noOp } from '@ts-bridge/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { getErrorMessage, getLoggingTransformer } from './logging.js';

describe('getErrorMessage', () => {
  it('returns the error message when the error is an instance of Error', () => {
    const error = new Error('message');
    expect(getErrorMessage(error)).toBe(error.message);
  });

  it('returns the error stack when verbose is enabled', () => {
    const error = new Error('message');
    expect(getErrorMessage(error, true)).toBe(error.stack);
  });

  it('returns the string representation of the error when it is not an instance of Error', () => {
    expect(getErrorMessage('error')).toBe('error');
  });
});

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
