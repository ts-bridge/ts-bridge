import { resolve } from '@ts-bridge/resolver';
import type { FileSystemInterface } from '@ts-bridge/resolver';
import chalk from 'chalk';
import { resolve as resolvePath, extname } from 'path';
import { join as joinPosix } from 'path/posix';
import type { System } from 'typescript';
import { pathToFileURL } from 'url';

import { warn } from './logging.js';

// The first entry is an empty string, which is used for the base package name.
const DEFAULT_EXTENSIONS = ['', '.js', '.cjs', '.mjs', '.json'];
const TYPESCRIPT_EXTENSIONS = ['.ts', '.tsx', '.d.ts'];

const SOURCE_EXTENSIONS_REGEX = /\.(js|jsx|cjs|mjs|ts|tsx)$/u;

/**
 * Check if a specifier is relative.
 *
 * @param specifier - The specifier to check.
 * @returns Whether the specifier is relative.
 */
export function isRelative(specifier: string) {
  return specifier.startsWith('.');
}

/**
 * Resolve a package specifier to a file in a package. This function will try to
 * resolve the package specifier to a file in the package's directory.
 *
 * @param packageSpecifier - The specifier for the package.
 * @param _extension - The extension to use for relative source paths. This is
 * unused for this function.
 * @param parentUrl - The URL of the parent module.
 * @param system - The TypeScript system.
 * @param extensions - The extensions to use for resolving the package.
 * @returns The resolved package specifier, or `null` if the package could not
 * be resolved.
 */
export function resolvePackageSpecifier(
  packageSpecifier: string,
  _extension: string,
  parentUrl: string,
  system: System,
  extensions = DEFAULT_EXTENSIONS,
): string | null {
  for (const extension of extensions) {
    try {
      resolve(
        `${packageSpecifier}${extension}`,
        pathToFileURL(parentUrl),
        getFileSystemFromTypeScript(system),
      );

      return `${packageSpecifier}${extension}`;
    } catch {
      // no-op
    }
  }

  return null;
}

/**
 * Resolve a relative package specifier to a file in the package. This function
 * will try to resolve the package specifier to a file in the package's
 * directory.
 *
 * @param packageSpecifier - The specifier for the package.
 * @param extension - The extension to use for relative source paths.
 * @param parentUrl - The URL of the parent module.
 * @param system - The TypeScript system.
 * @param extensions - The extensions to use for resolving the package.
 * @returns The resolved package specifier, or `null` if the package could not
 * be resolved.
 */
export function resolveRelativePackageSpecifier(
  packageSpecifier: string,
  extension: string,
  parentUrl: string,
  system: System,
  extensions = TYPESCRIPT_EXTENSIONS,
): string | null {
  const basePath = resolvePath(parentUrl, '..', packageSpecifier);
  if (system.directoryExists(basePath)) {
    return `./${joinPosix(packageSpecifier, `index${extension}`)}`;
  }

  const resolution = resolvePackageSpecifier(
    packageSpecifier,
    extension,
    parentUrl,
    system,
    [...extensions, ...DEFAULT_EXTENSIONS],
  );

  if (resolution) {
    return resolution.replace(SOURCE_EXTENSIONS_REGEX, extension);
  }

  const packageSpecifierWithoutExtension = packageSpecifier.replace(
    extname(packageSpecifier),
    '',
  );

  const resolutionWithoutExtension = resolvePackageSpecifier(
    packageSpecifierWithoutExtension,
    extension,
    parentUrl,
    system,
    [...extensions, ...DEFAULT_EXTENSIONS],
  );

  if (resolutionWithoutExtension) {
    return resolutionWithoutExtension.replace(
      SOURCE_EXTENSIONS_REGEX,
      extension,
    );
  }

  return null;
}

export type GetModulePathOptions = {
  /**
   * The specifier for the module.
   */
  packageSpecifier: string;

  /**
   * The extension to use for relative source paths.
   */
  extension: string;

  /**
   * The URL of the parent module.
   */
  parentUrl: string;

  /**
   * The TypeScript system.
   */
  system: System;

  /**
   * Whether to show verbose output.
   */
  verbose?: boolean;
};

/**
 * Get the path to a module.
 *
 * @param options - The options for resolving the module.
 * @param options.packageSpecifier - The specifier for the module.
 * @param options.extension - The extension to use for relative source paths.
 * @param options.parentUrl - The URL of the parent module.
 * @param options.system - The TypeScript system.
 * @param options.verbose - Whether to show verbose output.
 * @returns The path to the module, or the original specifier if the module
 * could not be resolved.
 */
export function getModulePath({
  packageSpecifier,
  extension,
  parentUrl,
  system,
  verbose,
}: GetModulePathOptions) {
  const resolver = isRelative(packageSpecifier)
    ? resolveRelativePackageSpecifier
    : resolvePackageSpecifier;

  const resolution = resolver(packageSpecifier, extension, parentUrl, system);
  if (!resolution) {
    verbose &&
      warn(
        `Could not resolve module: ${chalk.bold(
          `"${packageSpecifier}"`,
        )}. This means that TS Bridge will not update the import path, and the module may not be resolved correctly in some cases.`,
      );

    return packageSpecifier;
  }

  return resolution;
}

/**
 * Get a {@link FileSystemInterface} from a TypeScript system. This is used
 * for module resolution.
 *
 * @param system - The TypeScript system.
 * @returns The file system interface.
 */
export function getFileSystemFromTypeScript(
  system: System,
): FileSystemInterface {
  return {
    isFile: system.fileExists.bind(system),
    isDirectory: system.directoryExists.bind(system),

    readFile(path: string): string {
      const contents = system.readFile(path);
      if (contents === undefined) {
        throw new Error(`File not found: "${path}".`);
      }

      return contents;
    },

    readBytes(path: string, length: number): Uint8Array {
      const contents = system.readFile(path);
      if (contents === undefined) {
        throw new Error(`File not found: "${path}".`);
      }

      // TypeScript does not support reading a file as bytes, so we convert the
      // contents to a byte array manually. This is a bit hacky, but it should
      // work for most cases.
      const buffer = new Uint8Array(length);
      for (let index = 0; index < length; index++) {
        buffer[index] = contents.charCodeAt(index);
      }

      return buffer;
    },
  };
}

/**
 * Check if a package specifier is a CommonJS package.
 *
 * @param packageSpecifier - The specifier for the package.
 * @param system - The TypeScript system.
 * @param parentUrl - The URL of the parent module.
 * @returns Whether the package is a CommonJS package.
 */
export function isCommonJs(
  packageSpecifier: string,
  system: System,
  parentUrl: string,
) {
  if (isRelative(packageSpecifier)) {
    return false;
  }

  const { format } = resolve(
    packageSpecifier,
    pathToFileURL(parentUrl),
    getFileSystemFromTypeScript(system),
  );

  return format === 'commonjs';
}
