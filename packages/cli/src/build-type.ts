import type {
  SourceFile,
  TransformerFactory,
  ResolutionMode,
} from 'typescript';
import typescript from 'typescript';

import type { TransformerOptions } from './transformers.js';
import {
  getDefaultImportTransformer,
  getRemoveImportAttributeTransformer,
  getImportAttributeTransformer,
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
 */
export type BuildTypeOptions = {
  /**
   * The name of the package.
   */
  name: string;

  /**
   * The file extension for the output files.
   */
  extension: string;

  /**
   * The file extension for the declaration files.
   */
  declarationExtension: string;

  /**
   * The file extension for the source files.
   */
  sourceExtension: string;

  /**
   * The target module kind.
   */
  target: ResolutionMode;

  /**
   * Get the transformers to use for the build type.
   *
   * @param options - The transformer options to use.
   * @returns The transformers to use.
   */
  getTransformers: (
    options: TransformerOptions,
  ) => TransformerFactory<SourceFile>[];

  /**
   * Get the transformers to use for the build when shims are enabled.
   *
   * @param options - The transformer options to use.
   * @returns The transformers to use.
   */
  getShimsTransformers: (
    options: TransformerOptions,
  ) => TransformerFactory<SourceFile>[];
};

export const BUILD_TYPES: Record<BuildType, BuildTypeOptions> = {
  module: {
    name: 'ES module',
    extension: '.mjs',
    declarationExtension: '.d.mts',
    sourceExtension: '.mts',
    target: ModuleKind.ESNext,
    getTransformers: (options) => [
      getDefaultImportTransformer(options),
      getNamedImportTransformer(options),
      getImportAttributeTransformer(
        {
          moduleType: 'json',
          type: 'json',
        },
        options,
      ),
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
    sourceExtension: '.cts',
    target: ModuleKind.CommonJS,
    getTransformers: (options) => [
      getRemoveImportAttributeTransformer(options),
      getTargetTransformer(ModuleKind.CommonJS),
    ],
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
