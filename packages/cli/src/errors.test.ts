import chalk from 'chalk';
import typescript from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  getErrorCode,
  NodeError,
  TypeScriptError,
  WorkerError,
} from './errors.js';

beforeAll(() => {
  chalk.level = 0;
});

const { DiagnosticCategory } = typescript;

describe('getErrorCode', () => {
  it('gets the error code from an Error instance', () => {
    const error = new Error('ENOENT');

    // @ts-expect-error - `code` is not a property of `Error`.
    error.code = 'ENOENT';

    expect(getErrorCode(error)).toBe('ENOENT');
  });

  it('gets the error code from an object', () => {
    const error = { code: 'ENOENT' };
    expect(getErrorCode(error)).toBe('ENOENT');
  });

  it('returns null if the error is not an object', () => {
    expect(getErrorCode('ENOENT')).toBe(null);
  });
});

describe('TypeScriptError', () => {
  it('creates an error with a single diagnostic', () => {
    const diagnostic = {
      code: 1234,
      messageText: 'This is an error.',
      file: undefined,
      start: undefined,
      length: undefined,
      category: DiagnosticCategory.Error,
    };

    const error = new TypeScriptError('TypeScript error', diagnostic);
    expect(error.message).toContain('This is an error.');
  });

  it('creates an error with multiple diagnostics', () => {
    const diagnostics = [
      {
        code: 1234,
        messageText: 'This is an error.',
        file: undefined,
        start: undefined,
        length: undefined,
        category: DiagnosticCategory.Error,
      },
      {
        code: 5678,
        messageText: 'This is another error.',
        file: undefined,
        start: undefined,
        length: undefined,
        category: DiagnosticCategory.Error,
      },
    ];

    const error = new TypeScriptError('TypeScript error', diagnostics);
    expect(error.message).toContain('This is an error.');
    expect(error.message).toContain('This is another error.');
  });
});

describe('NodeError', () => {
  it('creates an error from a Node.js error', () => {
    const originalError = {
      code: 'ENOENT',
    };

    const error = new NodeError('Node.js error.', originalError);
    expect(error.message).toContain('Node.js error.');
    expect(error.message).toContain('The file does not exist.');
  });

  it('creates an error from a Node.js error with an unknown code', () => {
    const originalError = {
      code: 'UNKNOWN',
    };

    const error = new NodeError('Node.js error.', originalError);
    expect(error.message).toContain('Node.js error.');
    expect(error.message).toContain('An unknown error occurred.');
  });

  it('creates an error from a Node.js error without a code', () => {
    const originalError = {};

    const error = new NodeError('Node.js error.', originalError);
    expect(error.message).toContain('Node.js error.');
    expect(error.message).toContain('An unknown error occurred.');
  });
});

describe('WorkerError', () => {
  it('creates an error from a worker error', () => {
    const originalError = new Error('Wrapped error message.');

    const error = new WorkerError('Worker error', originalError);
    expect(error.message).toBe('Worker error: Wrapped error message.');
  });
});
