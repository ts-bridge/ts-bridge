import { dirname, join } from 'path';
import type { CompilerOptions, System } from 'typescript';
import typescript from 'typescript';

import { TypeScriptError } from './errors.js';
import { getAbsolutePath } from './file-system.js';
import { warn } from './logging.js';

const { parseJsonConfigFileContent, readConfigFile, sys } = typescript;

// The compiler options that are always set. These options cannot be overridden
// by the TypeScript configuration.
export const BASE_COMPILER_OPTIONS: CompilerOptions = {
  declaration: true,
  declarationMap: true,
  emitDeclarationOnly: false,
  noEmit: false,
  noEmitOnError: true,
};

/**
 * Get the TypeScript configuration path. This checks if the TypeScript
 * configuration exists at the specified path, and the path + `tsconfig.json`.
 * If the file exists at neither path, this throws an error.
 *
 * @param path - The path to check.
 * @param system - The system to use for file operations.
 * @returns The TypeScript configuration path.
 */
function getTypeScriptConfigPath(path: string, system: System) {
  if (system.fileExists(path)) {
    return path;
  }

  const configPath = join(path, 'tsconfig.json');
  if (system.fileExists(configPath)) {
    return configPath;
  }

  throw new Error(
    `The TypeScript configuration file does not exist at "${path}" or "${configPath}".`,
  );
}

/**
 * Get the TypeScript configuration.
 *
 * This function reads the TypeScript configuration from the specified path.
 *
 * @param path - The path to the TypeScript configuration.
 * @param system - The system to use for file operations.
 * @returns The TypeScript configuration.
 */
export function getTypeScriptConfig(path: string, system = sys) {
  const resolvedPath = getTypeScriptConfigPath(path, system);
  const { config, error } = readConfigFile(
    resolvedPath,
    system.readFile.bind(system),
  );

  if (error) {
    throw new TypeScriptError(
      'Failed to read the TypeScript configuration.',
      error,
    );
  }

  const parsedConfig = parseJsonConfigFileContent(
    config,
    system,
    dirname(resolvedPath),
    undefined,
    resolvedPath,
  );

  if (parsedConfig.errors.length) {
    throw new TypeScriptError(
      'Failed to parse the TypeScript configuration.',
      parsedConfig.errors,
    );
  }

  return parsedConfig;
}

/**
 * Get the base compiler options.
 *
 * @param basePath - The path to resolve relative paths against, i.e., the
 * directory of the TypeScript configuration file.
 * @param baseOptions - The base compiler options.
 * @returns The base compiler options with the default output directory.
 */
export function getBaseCompilerOptions(
  basePath: string,
  baseOptions: CompilerOptions,
): CompilerOptions {
  const fallbackPath = getAbsolutePath(basePath, 'dist');

  return {
    ...baseOptions,
    emitDeclarationOnly: false,
    declarationDir:
      baseOptions.declarationDir ?? baseOptions.outDir ?? fallbackPath,
    outDir: baseOptions.outDir ?? fallbackPath,
  };
}

/**
 * Get the compiler options for the specified path and build type. It merges the
 * compiler options from the TypeScript configuration with the build type
 * specific options, and shows a warning if an option is overridden.
 *
 * @param baseOptions - The base compiler options.
 * @returns The compiler options.
 */
export function getCompilerOptions(baseOptions: CompilerOptions) {
  return Object.entries(BASE_COMPILER_OPTIONS).reduce<CompilerOptions>(
    (options, [key, value]) => {
      if (
        options[key] !== undefined &&
        String(options[key]).toLowerCase() !== String(value).toLowerCase()
      ) {
        warn(
          `The compiler option "${key}" in the provided "tsconfig.json" will be overridden.`,
        );
      }

      return { ...options, [key]: value };
    },
    baseOptions,
  );
}
