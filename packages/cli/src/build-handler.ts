import { dirname, relative } from 'path';
import type { CompilerHost, System } from 'typescript';

import type { BuildType } from './build-type.js';
import type { BuilderOptions } from './build-utils.js';
import {
  cleanOutputDirectory,
  getBuildFunction,
  getInitialProgram,
} from './build-utils.js';
import { getBaseCompilerOptions, getTypeScriptConfig } from './config.js';
import { success } from './logging.js';

/**
 * Get the files to include in the build. This function will return the custom
 * files if provided, or the files from the `tsconfig.json` file if not.
 *
 * @param customFiles - The custom files to include in the build.
 * @param tsConfigFiles - The files from the `tsconfig.json` file.
 * @returns The files to include in the build.
 */
export function getFiles(
  customFiles: string[] | undefined,
  tsConfigFiles: string[],
) {
  if (customFiles && customFiles.length > 0) {
    return customFiles;
  }

  return tsConfigFiles;
}

/**
 * Options for the build handler. This is intended to be provided by the CLI,
 * and these types should match the CLI options.
 */
export type BuildHandlerOptions = {
  /**
   * The formats to build.
   */
  format: BuildType[];

  /**
   * The path to the project's `tsconfig.json` file.
   */
  project: string;

  /**
   * The files to include in the build.
   */
  files?: string[];

  /**
   * Whether to clean the output directory before building.
   */
  clean: boolean;

  /**
   * The system to use for file operations.
   */
  system: System;

  /**
   * The compiler host to use.
   */
  host?: CompilerHost;

  /**
   * Whether to log verbose output.
   */
  verbose?: boolean;

  /**
   * Whether to use project references.
   */
  references?: boolean;

  /**
   * Whether to use shims for the build.
   */
  shims?: boolean;
};

/**
 * Handle the `build` command. This is intended to be called by the CLI.
 *
 * @param options - The build command options.
 */
export async function buildHandler(options: BuildHandlerOptions) {
  const {
    format,
    project,
    clean,
    system,
    verbose,
    references,
    shims = true,
  } = options;

  const tsConfig = getTypeScriptConfig(project, system);
  const baseOptions = getBaseCompilerOptions(
    dirname(project),
    tsConfig.options,
  );

  const baseDirectory = dirname(project);
  cleanOutputDirectory(project, baseOptions, clean, verbose);

  const program = getInitialProgram({
    project,
    system,
    tsConfig,
    format,
  });

  const buildOptions: BuilderOptions = {
    name: relative(process.cwd(), project),
    projectReferences: tsConfig.projectReferences,
    compilerOptions: program.getCompilerOptions(),
    files: tsConfig.fileNames,
    program,
    format,
    system,
    baseDirectory,
    tsConfig,
    verbose,
    shims,
    clean,
  };

  const buildFunction = getBuildFunction(tsConfig, references);
  await buildFunction(buildOptions);

  verbose && success('Project built successfully.');
}
