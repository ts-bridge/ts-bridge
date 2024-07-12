import { dirname, join } from 'path';
import type {
  CompilerHost,
  CompilerOptions,
  ParsedCommandLine,
  Program,
  ProjectReference,
  System,
} from 'typescript';
import typescript from 'typescript';
import { pathToFileURL } from 'url';

import type { BuildType } from './build-type.js';
import { getBuildTypeOptions } from './build-type.js';
import {
  getBaseCompilerOptions,
  getCompilerOptions,
  getTypeScriptConfig,
} from './config.js';
import { TypeScriptError } from './errors.js';
import { getWriteFileFunction, removeDirectory } from './file-system.js';
import { getLoggingTransformer } from './logging.js';
import {
  createProjectReferencesCompilerHost,
  getResolvedProjectReferences,
} from './project-references.js';
import { isShimsPackageInstalled } from './shims.js';
import type { Steps } from './steps.js';
import { executeSteps } from './steps.js';
import type { TransformerOptions } from './transformers.js';
import {
  getTypeImportExportTransformer,
  getExportExtensionTransformer,
  getImportExtensionTransformer,
  getRequireExtensionTransformer,
} from './transformers.js';
import { getDefinedArray } from './utils.js';

const { createProgram, getPreEmitDiagnostics, ModuleResolutionKind } =
  typescript;

type GetProgramOptions = {
  compilerOptions: CompilerOptions;
  projectReferences?: readonly ProjectReference[];
  files: string[];
  oldProgram?: Program;
  host?: CompilerHost;
};

/**
 * Get the TypeScript program for the project. This function will create a new
 * program using the provided options and files, and perform a pre-emit
 * diagnostics check to ensure the project is valid.
 *
 * @param options - The options.
 * @param options.compilerOptions - The compiler options to use.
 * @param options.projectReferences - The project references to use.
 * @param options.files - The files to include in the program.
 * @param options.oldProgram - The old program to reuse.
 * @param options.host - The compiler host to use.
 * @returns The TypeScript program for the project.
 */
export function getProgram({
  compilerOptions,
  projectReferences,
  files,
  oldProgram,
  host,
}: GetProgramOptions): Program {
  const program = createProgram({
    rootNames: files,
    options: compilerOptions,
    projectReferences,
    oldProgram,
    host,
  });

  // Check for pre-emit diagnostics, which includes syntax errors, type errors,
  // and other issues that would prevent the build from starting.
  const preEmitDiagnostics = getPreEmitDiagnostics(program);
  if (preEmitDiagnostics.length > 0) {
    throw new TypeScriptError(
      'Failed to initialise the project.',
      preEmitDiagnostics,
    );
  }

  return program;
}

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
 *
 * @property format - The formats to build.
 * @property project - The path to the project's `tsconfig.json` file.
 * @property files - The files to include in the build.
 * @property clean - Whether to clean the output directory before building.
 */
export type BuildHandlerOptions = {
  format: string[];
  project: string;
  files?: string[];
  clean: boolean;
  system: System;
  host?: CompilerHost;
  verbose?: boolean;
  references?: boolean;
};

/**
 * Handle the `build` command. This is intended to be called by the CLI.
 *
 * @param options - The build command options.
 */
export function buildHandler(options: BuildHandlerOptions) {
  const {
    format,
    project,
    files: customFiles,
    clean,
    system,
    host,
    verbose,
    references,
  } = options;

  const tsConfig = getTypeScriptConfig(project, system);
  const baseOptions = getBaseCompilerOptions(
    dirname(project),
    tsConfig.options,
  );

  const baseDirectory = dirname(project);
  if (clean && baseOptions.outDir) {
    removeDirectory(baseOptions.outDir, baseDirectory);
  }

  const files = getFiles(customFiles, tsConfig.fileNames);

  const compilerOptions = getCompilerOptions(baseOptions);
  const program = getProgram({
    compilerOptions,
    files,
    host,
    projectReferences: tsConfig.projectReferences,
  });

  const buildOptions: BuilderOptions = {
    program,
    compilerOptions,
    format,
    files,
    system,
    host,
    baseDirectory,
    tsConfig,
    verbose,
  };

  const buildFunction = getBuildFunction(tsConfig, references);
  buildFunction(buildOptions);
}

type BuilderOptions = {
  program: Program;
  compilerOptions: CompilerOptions;
  format: string[];
  files: string[];
  system: System;
  host?: CompilerHost;
  baseDirectory: string;
  tsConfig: ParsedCommandLine;
  verbose?: boolean;
};

/**
 * Build the project using the Node.js 10 module resolution strategy. This
 * function will build the project using the specified formats. Note that this
 * function is slower than {@link buildNode16} because it creates a new program
 * for each format.
 *
 * @param options - The build options.
 * @param options.program - The TypeScript program to build.
 * @param options.compilerOptions - The compiler options to use.
 * @param options.format - The formats to build.
 * @param options.files - The files to include in the program.
 * @param options.system - The file system to use.
 * @param options.host - The compiler host to use.
 * @param options.verbose - Whether to enable verbose logging.
 */
export function buildNode10({
  program,
  compilerOptions,
  format,
  files,
  system,
  host,
  verbose,
}: BuilderOptions) {
  const buildSteps: Steps<Record<string, never>> = [
    {
      name: 'Building ES module.',
      condition: () => format.includes('module'),
      task: () => {
        const newProgram = getProgram({
          compilerOptions: {
            ...compilerOptions,
            module: typescript.ModuleKind.ES2022,

            // `ModuleResolutionKind.NodeJs` is in TypeScript 5 and later, but
            // TypeScript 4 doesn't support `ModuleResolutionKind.Node10`.
            moduleResolution: ModuleResolutionKind.NodeJs,
          },
          files,
          oldProgram: program,
          host,
        });

        build({
          program: newProgram,
          type: 'module',
          system,
          verbose,
        });
      },
    },
    {
      name: 'Building CommonJS module.',
      condition: () => format.includes('commonjs'),
      task: () => {
        const newProgram = getProgram({
          compilerOptions: {
            ...compilerOptions,
            module: typescript.ModuleKind.CommonJS,

            // `ModuleResolutionKind.NodeJs` is in TypeScript 5 and later, but
            // TypeScript 4 doesn't support `ModuleResolutionKind.Node10`.
            moduleResolution: ModuleResolutionKind.NodeJs,
          },
          files,
          oldProgram: program,
          host,
        });

        build({
          program: newProgram,
          type: 'commonjs',
          system,
          verbose,
        });
      },
    },
  ];

  executeSteps(buildSteps, {}, verbose);
}

/**
 * Build the project using the Node.js 16 module resolution strategy.
 *
 * @param options - The build options.
 * @param options.program - The TypeScript program to build.
 * @param options.format - The formats to build.
 * @param options.system - The file system to use.
 * @param options.verbose - Whether to enable verbose logging.
 */
export function buildNode16({
  program,
  format,
  system,
  verbose,
}: BuilderOptions) {
  const buildSteps: Steps<Record<string, never>> = [
    {
      name: 'Building ES module.',
      condition: () => format.includes('module'),
      task: () => {
        build({ program, type: 'module', system });
      },
    },
    {
      name: 'Building CommonJS module.',
      condition: () => format.includes('commonjs'),
      task: () => {
        build({ program, type: 'commonjs', system });
      },
    },
  ];

  executeSteps(buildSteps, {}, verbose);
}

/**
 * Build the project references. This function will build the project references
 * using the specified formats.
 *
 * @param options - The build options.
 * @param options.program - The base TypeScript program to use.
 * @param options.format - The formats to build.
 * @param options.system - The file system to use.
 */
export function buildProjectReferences({
  program,
  format,
  system,
}: BuilderOptions) {
  const resolvedProjectReferences = getDefinedArray(
    program.getResolvedProjectReferences(),
  );

  const sortedProjectReferences = getResolvedProjectReferences(
    resolvedProjectReferences,
  );

  for (const {
    sourceFile,
    commandLine,
    references,
  } of sortedProjectReferences) {
    const {
      fileNames,
      options: childOptions,
      projectReferences: childProjectReferences,
    } = commandLine;

    const baseChildOptions = getBaseCompilerOptions(
      dirname(sourceFile.fileName),
      childOptions,
    );

    const compilerOptions = getCompilerOptions(baseChildOptions);
    const host = createProjectReferencesCompilerHost(
      compilerOptions,
      getDefinedArray(references),
    );

    const childProgram = getProgram({
      compilerOptions,
      host,
      projectReferences: childProjectReferences,
      files: fileNames,
      oldProgram: program,
    });

    const buildFunction = getBuildFunction(commandLine);
    buildFunction({
      host,
      program: childProgram,
      compilerOptions,
      format,
      files: fileNames,
      system,
      baseDirectory: dirname(sourceFile.fileName),
      tsConfig: commandLine,
    });
  }
}

/**
 * Get the build function to use based on the TypeScript configuration. This
 * function will return the appropriate build function based on whether project
 * references are used and the module resolution strategy.
 *
 * @param tsConfig - The TypeScript configuration.
 * @param useReferences - Whether to include project references in the build.
 * @returns The build function to use.
 */
export function getBuildFunction(
  tsConfig: ParsedCommandLine,
  useReferences = false,
): (options: BuilderOptions) => void {
  if (useReferences && tsConfig.projectReferences) {
    return buildProjectReferences;
  }

  if (
    tsConfig.options.moduleResolution !== ModuleResolutionKind.Node16 &&
    tsConfig.options.moduleResolution !== ModuleResolutionKind.NodeNext
  ) {
    return buildNode10;
  }

  return buildNode16;
}

/**
 * Get the transformers to use for the build. This function will return the
 * transformers to use based on the build type and whether shims are enabled.
 * If shims are enabled, the shims transformers will be included in the list.
 *
 * @param type - The build type to use.
 * @param options - The transformer options.
 * @param useShims - Whether to use shims. By default, this is determined by
 * whether the shims package is installed.
 * @returns The transformers to use for the build.
 */
export function getTransformers(
  type: BuildType,
  options: TransformerOptions,
  useShims = isShimsPackageInstalled(
    pathToFileURL(join(process.cwd(), 'dummy.js')).href,
  ),
) {
  const { getTransformers: getBaseTransformers, getShimsTransformers } =
    getBuildTypeOptions(type);

  const baseTransformers = getBaseTransformers(options);

  if (useShims) {
    return [...baseTransformers, ...getShimsTransformers(options)];
  }

  return baseTransformers;
}

type BuildOptions = {
  program: Program;
  type: BuildType;
  system: System;
  verbose?: boolean;
};

/**
 * Build the project. This function will compile the project using the
 * TypeScript compiler.
 *
 * @param options - The build options.
 * @param options.program - The TypeScript program to build.
 * @param options.type - The build type to use.
 * @param options.system - The file system to use.
 * @param options.verbose - Whether to enable verbose logging.
 * @returns A promise that resolves when the build is complete.
 */
export function build({
  program,
  type,
  system,
  verbose,
}: BuildOptions): Program {
  const { name, extension } = getBuildTypeOptions(type);

  const options: TransformerOptions = {
    typeChecker: program.getTypeChecker(),
    system,
  };

  const { diagnostics } = program.emit(
    undefined,
    getWriteFileFunction(type, system),
    undefined,
    undefined,
    {
      before: [
        getLoggingTransformer(verbose),
        getRequireExtensionTransformer(extension, options),
        getImportExtensionTransformer(extension, options),
        getExportExtensionTransformer(extension, options),
        getTypeImportExportTransformer(options),
        ...getTransformers(type, options),
      ],
      afterDeclarations: [
        getImportExtensionTransformer(extension, options),
        getExportExtensionTransformer(extension, options),
      ],
    },
  );

  /* istanbul ignore if -- @preserve */
  if (diagnostics.length > 0) {
    throw new TypeScriptError(`Failed to build ${name} files.`, diagnostics);
  }

  return program;
}
