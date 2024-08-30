import chalk from 'chalk';
import { dirname, relative } from 'path';
import type {
  CompilerHost,
  CompilerOptions,
  ParsedCommandLine,
  Program,
  ProjectReference,
  System,
} from 'typescript';
import typescript from 'typescript';

import type { BuildType } from './build-type.js';
import { getBuildTypeOptions } from './build-type.js';
import {
  getBaseCompilerOptions,
  getCompilerOptions,
  getTypeScriptConfig,
} from './config.js';
import { TypeScriptError } from './errors.js';
import { getWriteFileFunction, removeDirectory } from './file-system.js';
import { getLoggingTransformer, info } from './logging.js';
import {
  createProjectReferencesCompilerHost,
  getResolvedProjectReferences,
} from './project-references.js';
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

type GetInitialCompilerHostOptions = {
  format: BuildType[];
  compilerOptions: CompilerOptions;
  system: System;
  host?: CompilerHost;
  projectReferences?: readonly ProjectReference[];
};

/**
 * Get the initial compiler host to use for the build. This function will return
 * the host to use based on the build options.
 *
 * @param options - The options.
 * @param options.format - The formats to build.
 * @param options.compilerOptions - The compiler options to use.
 * @param options.system - The file system to use.
 * @param options.projectReferences - The project references to use.
 * @returns The initial compiler host to use for the build.
 */
function getInitialCompilerHost({
  format,
  compilerOptions,
  system,
  projectReferences,
}: GetInitialCompilerHostOptions) {
  if (getDefinedArray(projectReferences).length === 0) {
    return undefined;
  }

  const mockProgram = createProgram({
    rootNames: [],
    options: {},
    projectReferences,
  });

  return createProjectReferencesCompilerHost(
    format,
    compilerOptions,
    getDefinedArray(mockProgram.getResolvedProjectReferences()),
    system,
  );
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
  format: BuildType[];
  project: string;
  files?: string[];
  clean: boolean;
  system: System;
  host?: CompilerHost;
  verbose?: boolean;
  references?: boolean;
  shims?: boolean;
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
  if (clean && baseOptions.outDir) {
    removeDirectory(baseOptions.outDir, baseDirectory);
  }

  const files = getFiles(customFiles, tsConfig.fileNames);

  const initialHost = getInitialCompilerHost({
    format,
    compilerOptions: baseOptions,
    system,
    projectReferences: tsConfig.projectReferences,
  });

  const compilerOptions = getCompilerOptions(baseOptions);
  const program = getProgram({
    compilerOptions,
    files,
    host: initialHost,
    projectReferences: tsConfig.projectReferences,
  });

  const buildOptions: BuilderOptions = {
    projectReferences: tsConfig.projectReferences,
    program,
    compilerOptions,
    format,
    files,
    system,
    baseDirectory,
    tsConfig,
    verbose,
    shims,
  };

  const buildFunction = getBuildFunction(tsConfig, references);
  buildFunction(buildOptions);
}

type BuilderOptions = {
  program: Program;
  projectReferences?: readonly ProjectReference[];
  compilerOptions: CompilerOptions;
  format: BuildType[];
  files: string[];
  system: System;
  host?: CompilerHost;
  baseDirectory: string;
  tsConfig: ParsedCommandLine;
  verbose?: boolean;
  shims: boolean;
};

/**
 * Build the project using the Node.js 10 module resolution strategy. This
 * function will build the project using the specified formats. Note that this
 * function is slower than {@link buildNode16} because it creates a new program
 * for each format.
 *
 * @param options - The build options.
 * @param options.program - The TypeScript program to build.
 * @param options.projectReferences - The project references to use.
 * @param options.compilerOptions - The compiler options to use.
 * @param options.format - The formats to build.
 * @param options.files - The files to include in the program.
 * @param options.system - The file system to use.
 * @param options.host - The compiler host to use.
 * @param options.verbose - Whether to enable verbose logging.
 * @param options.shims - Whether to generate shims for environment-specific
 * APIs.
 */
export function buildNode10({
  program,
  projectReferences,
  compilerOptions,
  format,
  files,
  system,
  host,
  verbose,
  shims,
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

            // `ModuleResolutionKind.NodeJs` is deprecated in TypeScript 5 and
            // later, but TypeScript 4 doesn't support
            // `ModuleResolutionKind.Node10`.
            moduleResolution: ModuleResolutionKind.NodeJs,
          },
          projectReferences,
          files,
          oldProgram: program,
          host,
        });

        build({
          program: newProgram,
          type: 'module',
          system,
          verbose,
          shims,
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

            // `ModuleResolutionKind.NodeJs` is deprecated in TypeScript 5 and
            // later, but TypeScript 4 doesn't support
            // `ModuleResolutionKind.Node10`.
            moduleResolution: ModuleResolutionKind.NodeJs,
          },
          projectReferences,
          files,
          oldProgram: program,
          host,
        });

        build({
          program: newProgram,
          type: 'commonjs',
          system,
          verbose,
          shims,
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
 * @param options.shims - Whether to generate shims for environment-specific
 * APIs.
 */
export function buildNode16({
  program,
  format,
  system,
  verbose,
  shims,
}: BuilderOptions) {
  const buildSteps: Steps<Record<string, never>> = [
    {
      name: 'Building ES module.',
      condition: () => format.includes('module'),
      task: () => {
        build({ program, type: 'module', system, shims, verbose });
      },
    },
    {
      name: 'Building CommonJS module.',
      condition: () => format.includes('commonjs'),
      task: () => {
        build({ program, type: 'commonjs', system, shims, verbose });
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
 */
export function buildProjectReferences(options: BuilderOptions) {
  const { program, tsConfig, format, system, baseDirectory, verbose, shims } =
    options;

  const resolvedProjectReferences = getDefinedArray(
    program.getResolvedProjectReferences(),
  );

  const sortedProjectReferences = getResolvedProjectReferences(
    baseDirectory,
    resolvedProjectReferences,
  );

  for (const {
    sourceFile,
    commandLine,
    references,
  } of sortedProjectReferences) {
    verbose &&
      info(
        `Building referenced project "${chalk.underline(
          relative(baseDirectory, sourceFile.fileName),
        )}".`,
      );

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
      format,
      compilerOptions,
      getDefinedArray(references),
      system,
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
      projectReferences: childProjectReferences,
      compilerOptions,
      format,
      files: fileNames,
      system,
      baseDirectory: dirname(sourceFile.fileName),
      tsConfig: commandLine,
      verbose,
      shims,
    });
  }

  info('All project references built. Building main project.');

  const buildFunction = getBuildFunction(tsConfig, false);
  buildFunction(options);
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
 * @param useShims - Whether to generate shims for environment-specific APIs.
 * @returns The transformers to use for the build.
 */
export function getTransformers(
  type: BuildType,
  options: TransformerOptions,
  useShims: boolean,
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
  shims: boolean;
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
 * @param options.shims - Whether to generate shims for environment-specific
 * APIs.
 * @returns A promise that resolves when the build is complete.
 */
export function build({
  program,
  type,
  system,
  verbose,
  shims,
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
        ...getTransformers(type, options, shims),
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
