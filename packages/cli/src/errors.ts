import chalk from 'chalk';
import type { Diagnostic } from 'typescript';
import typescript from 'typescript';

import { getCanonicalFileName } from './file-system.js';
import { isObject } from './utils.js';

const { formatDiagnosticsWithColorAndContext, sys } = typescript;

const NODE_ERROR_CODES: Record<string, string> = {
  ENOENT: 'The file does not exist.',
  EACCES: 'Permission denied.',
  EISDIR: 'The file is a directory.',
  EEXIST: 'The file already exists.',
  ENOTDIR: 'The path is not a directory.',
  EPERM: 'Operation not permitted.',
  EROFS: 'The file is read-only.',
  ENOTEMPTY: 'The directory is not empty.',
  EBUSY: 'The file is busy.',
  EMFILE: 'The process has too many files open.',
};

/**
 * Get the error's `code` property if it has one.
 *
 * @param error - The error to get the code for.
 * @returns The error code, or `null`.
 */
export function getErrorCode(error: unknown) {
  if (isObject(error) && typeof error.code === 'string') {
    return error.code;
  }

  return null;
}

/**
 * An error thrown when a TypeScript build fails. This will format the
 * diagnostics with colors and context.
 */
export class TypeScriptError extends Error {
  /**
   * Create a new TypeScript error from the given message and diagnostic. This
   * will create a new error message with the diagnostic formatted with colors.
   *
   * @param message - The error message.
   * @param diagnostic - The TypeScript diagnostic.
   */
  constructor(message: string, diagnostic: Diagnostic);

  /**
   * Create a new TypeScript error from the given message and diagnostics. This
   * will create a new error message with the diagnostics formatted with colors.
   *
   * @param message - The error message.
   * @param diagnostics - The TypeScript diagnostics.
   */
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  constructor(message: string, diagnostics: readonly Diagnostic[]);

  constructor(
    message: string,
    diagnostics: Diagnostic | readonly Diagnostic[],
  ) {
    const diagnosticsArray = Array.isArray(diagnostics)
      ? diagnostics
      : [diagnostics];

    const formattedDiagnostics = formatDiagnosticsWithColorAndContext(
      diagnosticsArray,
      {
        getCanonicalFileName,
        getCurrentDirectory: () => sys.getCurrentDirectory(),
        getNewLine: () => sys.newLine,
      },
    );

    super(`${chalk.red(message)}\n${formattedDiagnostics}`);
  }
}

export class NodeError extends Error {
  constructor(message: string, originalError: unknown) {
    const code = getErrorCode(originalError);
    const errorMessage = code
      ? NODE_ERROR_CODES[code] ?? 'An unknown error occurred.'
      : 'An unknown error occurred.';

    super(`${chalk.red(message)}\n${errorMessage}`);
  }
}
