import { resolve } from '@ts-bridge/resolver';
import type { FileSystemInterface, FileFormat } from '@ts-bridge/resolver';
import chalk from 'chalk';
import { init, parse } from 'cjs-module-lexer';
import { resolve as resolvePath, extname } from 'path';
import type { System } from 'typescript';
import { pathToFileURL } from 'url';

import { warn } from './logging.js';

// This initialises `cjs-module-lexer` so that we can parse CommonJS modules
// quickly using the WASM binary.
await init();

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

export type ResolvedModule = {
  /**
   * The specifier for the module.
   */
  specifier: string;

  /**
   * The path to the module.
   */
  path: string;

  /**
   * The type of the module.
   */
  format: FileFormat | null;
};

/**
 * Resolve a package specifier to a file in a package. This function will try to
 * resolve the package specifier to a file in the package's directory.
 *
 * @param packageSpecifier - The specifier for the package.
 * @param parentUrl - The URL of the parent module.
 * @param system - The TypeScript system.
 * @param extensions - The extensions to use for resolving the package.
 * @returns The resolved package specifier, or `null` if the package could not
 * be resolved.
 */
export function resolvePackageSpecifier(
  packageSpecifier: string,
  parentUrl: string,
  system: System,
  extensions = DEFAULT_EXTENSIONS,
): ResolvedModule | null {
  // We check for `/index.js` as well, to support packages without a `main`
  // entry in their `package.json`.
  for (const specifier of [packageSpecifier, `${packageSpecifier}/index`]) {
    for (const extension of extensions) {
      try {
        const { format, path } = resolve(
          `${specifier}${extension}`,
          pathToFileURL(parentUrl),
          getFileSystemFromTypeScript(system),
        );

        return {
          specifier: `${specifier}${extension}`,
          path,
          format,
        };
      } catch {
        // no-op
      }
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
 * @param parentUrl - The URL of the parent module.
 * @param system - The TypeScript system.
 * @param extensions - The extensions to use for resolving the package.
 * @returns The resolved package specifier, or `null` if the package could not
 * be resolved.
 */
export function resolveRelativePackageSpecifier(
  packageSpecifier: string,
  parentUrl: string,
  system: System,
  extensions = TYPESCRIPT_EXTENSIONS,
): ResolvedModule | null {
  const basePath = resolvePath(parentUrl, '..', packageSpecifier);
  if (system.directoryExists(basePath)) {
    return resolveRelativePackageSpecifier(
      `${packageSpecifier}/index`,
      parentUrl,
      system,
    );
  }

  const packageSpecifierWithoutExtension = packageSpecifier.replace(
    extname(packageSpecifier),
    '',
  );

  for (const specifier of [
    packageSpecifier,
    packageSpecifierWithoutExtension,
  ]) {
    const resolution = resolvePackageSpecifier(specifier, parentUrl, system, [
      ...extensions,
      ...DEFAULT_EXTENSIONS,
    ]);

    if (resolution) {
      return resolution;
    }
  }

  return null;
}

/**
 * Resolve a module.
 *
 * @param packageSpecifier - The specifier for the module.
 * @param parentUrl - The URL of the parent module.
 * @param system - The TypeScript system.
 * @param extensions - The extensions to use for resolving the module.
 * @returns The resolved module, or `null` if the module could not be resolved.
 */
function resolveModule(
  packageSpecifier: string,
  parentUrl: string,
  system: System,
  extensions?: string[],
): ResolvedModule | null {
  if (isRelative(packageSpecifier)) {
    return resolveRelativePackageSpecifier(
      packageSpecifier,
      parentUrl,
      system,
      extensions,
    );
  }

  return resolvePackageSpecifier(
    packageSpecifier,
    parentUrl,
    system,
    extensions,
  );
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
 * Replace the extension of a path.
 *
 * @param path - The path to replace the extension of.
 * @param extension - The new extension.
 * @returns The path with the new extension.
 */
export function replaceExtension(path: string, extension: string) {
  return path.replace(SOURCE_EXTENSIONS_REGEX, extension);
}

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
}: GetModulePathOptions): string {
  const resolution = resolveModule(packageSpecifier, parentUrl, system);
  if (!resolution) {
    verbose &&
      warn(
        `Could not resolve module: ${chalk.bold(
          `"${packageSpecifier}"`,
        )}. This means that TS Bridge will not update the import path, and the module may not be resolved correctly in some cases.`,
      );

    return packageSpecifier;
  }

  if (isRelative(packageSpecifier)) {
    return replaceExtension(resolution.specifier, extension);
  }

  return resolution.specifier;
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
 * Get the module type for a given package specifier.
 *
 * @param packageSpecifier - The specifier for the package.
 * @param system - The TypeScript system.
 * @param parentUrl - The URL of the parent module.
 * @returns The module type for the package.
 */
export function getModuleType(
  packageSpecifier: string,
  system: System,
  parentUrl: string,
) {
  const resolution = resolveModule(packageSpecifier, parentUrl, system);
  return resolution?.format ?? null;
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

  return getModuleType(packageSpecifier, system, parentUrl) === 'commonjs';
}

/**
 * Get the exports for a CommonJS package. This uses `cjs-module-lexer` to parse
 * the CommonJS module and extract the exports, which matches the behaviour of
 * Node.js. This function will return an empty array if the package is not a
 * CommonJS package, or if the package could not be resolved.
 *
 * @param packageSpecifier - The specifier for the package.
 * @param system - The TypeScript system.
 * @param parentUrl - The URL of the parent module.
 * @returns The exports for the CommonJS package.
 * @throws If the package could not be parsed.
 */
export function getCommonJsExports(
  packageSpecifier: string,
  system: System,
  parentUrl: string,
): Set<string> {
  const relative = isRelative(packageSpecifier);
  const resolution = resolveModule(
    packageSpecifier,
    parentUrl,
    system,
    // We assume that if the packageSpecifier is relative, we are traversing a specific file looking for CJS imports
    relative ? DEFAULT_EXTENSIONS : undefined,
  );

  if (!resolution || resolution.format !== 'commonjs') {
    return new Set();
  }

  const { path } = resolution;
  const code = system.readFile(path);
  if (!code) {
    return new Set();
  }

  const { exports, reexports } = parse(code);

  // Re-exports are paths to exports that must be resolved themselves
  const resolvedReexports = reexports.reduce((accumulator, reexport) => {
    const exportSet = getCommonJsExports(reexport, system, path);
    exportSet.forEach((exportName) => accumulator.add(exportName));
    return accumulator;
  }, new Set<string>());

  return new Set([...exports, ...resolvedReexports]);
}
