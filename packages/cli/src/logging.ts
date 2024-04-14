import chalk from 'chalk';
import type { SourceFile, Transformer } from 'typescript';

/**
 * Get an error message from an error object.
 *
 * @param errorObject - The error object.
 * @returns The error message.
 */
export function getErrorMessage(errorObject: unknown) {
  return errorObject instanceof Error
    ? errorObject.message
    : String(errorObject);
}

/**
 * Log an error message. The message is prefixed with a red cross.
 *
 * @param errorObject - The error to log.
 */
export function error(errorObject: unknown) {
  console.error(`${chalk.red('✖')} ${getErrorMessage(errorObject)}`);
}

/**
 * Log a warning message. The message is prefixed with a yellow exclamation
 * mark.
 *
 * @param message - The warning message to log.
 */
export function warn(message: string) {
  console.warn(`${chalk.yellow('⚠')} ${chalk.white(message)}`);
}

/**
 * Log an information message. The message is prefixed with a blue 'i'.
 *
 * @param message - The information message to log.
 */
export function info(message: string) {
  console.log(`${chalk.blue('ℹ')} ${chalk.reset(message)}`);
}

/**
 * Log a generic message. The message is prefixed with a green arrow.
 *
 * @param message - The message to log.
 */
export function log(message: string) {
  console.log(`${chalk.green('→')} ${chalk.reset(message)}`);
}

/**
 * Get a transformer function that logs the file that is being transformed.
 *
 * This transformer does not actually transform the source file. It just uses
 * TypeScript's transformer API to check which files are being transformed.
 *
 * @param verbose - Whether to enable verbose logging.
 * @returns The transformer function.
 */
export function getLoggingTransformer(verbose?: boolean) {
  return (): Transformer<SourceFile> => {
    return (sourceFile: SourceFile) => {
      verbose &&
        log(
          `Transforming source file "${chalk.underline(sourceFile.fileName)}".`,
        );

      return sourceFile;
    };
  };
}
