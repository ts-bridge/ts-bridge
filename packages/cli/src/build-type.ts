import type {
  SourceFile,
  TransformerFactory,
  ResolutionMode,
} from 'typescript';
import typescript from 'typescript';

import type { TransformerOptions } from './transformers.js';
import {
  getRequireTransformer,
  getGlobalsTransformer,
  getImportMetaTransformer,
  getNamedImportTransformer,
  getTargetTransformer,
} from './transformers.js';

const { ModuleKind } = typescript;

/**
 * The type of build to generate.
 *
 * - `module` - Build as an ES module.
 * - `commonjs` - Build as a CommonJS module.
 */
export type BuildType = 'module' | 'commonjs';

/**
 * Options for different build types.
 *
 * @property extension - The file extension for the output files.
 * @property declarationExtension - The file extension for the declaration
 * files.
 * @property compilerOptions - The compiler options to use for the build type.
 * This will be merged with the project's `tsconfig.json` file.
 * @property getTransformers - Get the transformers to use for the build type.
 * @property getShimsTransformers - Get the transformers to use for the build
 * when the `@ts-bridge/shims` package is installed.
 */
export type BuildTypeOptions = {
  name: string;
  extension: string;
  declarationExtension: string;
  target: ResolutionMode;
  getTransformers: (
    options: TransformerOptions,
  ) => TransformerFactory<SourceFile>[];
  getShimsTransformers: (
    options: TransformerOptions,
  ) => TransformerFactory<SourceFile>[];
};

export const BUILD_TYPES: Record<BuildType, BuildTypeOptions> = {
  module: {
    name: 'ES module',
    extension: '.mjs',
    declarationExtension: '.d.mts',
    target: ModuleKind.ESNext,
    getTransformers: (options) => [
      getNamedImportTransformer(options),
      getTargetTransformer(ModuleKind.ESNext),
    ],
    getShimsTransformers: (options) => [
      getGlobalsTransformer(options),
      getRequireTransformer(options),
    ],
  },
  commonjs: {
    name: 'CommonJS module',
    extension: '.cjs',
    declarationExtension: '.d.cts',
    target: ModuleKind.CommonJS,
    getTransformers: () => [getTargetTransformer(ModuleKind.CommonJS)],
    getShimsTransformers: (options) => [getImportMetaTransformer(options)],
  },
};

/**
 * Get the options for a build type.
 *
 * @param type - The build type to get the options for.
 * @returns The options for the build type.
 * @throws If the build type is unknown.
 */
export function getBuildTypeOptions(type: BuildType): BuildTypeOptions {
  const options = BUILD_TYPES[type];
  if (!options) {
    throw new Error(`Unknown build type: "${type}".`);
  }

  return options;
}
