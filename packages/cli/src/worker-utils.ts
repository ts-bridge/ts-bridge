import { dirname, relative } from 'path';
import type { ResolvedProjectReference } from 'typescript';
import typescript from 'typescript';
import { Worker } from 'worker_threads';

import { WorkerError } from './errors.js';
import { success } from './logging.js';
import { createProjectReferencesCompilerHost } from './project-references.js';
import type { BuilderOptions } from './shared.js';
import {
  cleanOutputDirectory,
  getBuildFunction,
  getInitialProgram,
} from './shared.js';
import { getDefinedArray } from './utils.js';

const { sys } = typescript;

export type WorkerOptions = Omit<
  BuilderOptions,
  | 'compilerOptions'
  | 'files'
  | 'host'
  | 'program'
  | 'projectReferences'
  | 'system'
> & {
  project: string;
};

export type GetBuildWorkerFunctionOptions = Omit<
  WorkerOptions,
  'baseDirectory' | 'name' | 'project' | 'tsConfig'
> & {
  parentBaseDirectory: string;
};

/**
 * Get the build worker function.
 *
 * @param options - The options to use for the worker.
 * @returns The build worker function.
 */
export function getBuildWorkerFunction(options: GetBuildWorkerFunctionOptions) {
  /**
   * Build a project reference using a worker thread.
   *
   * @param projectReference - The project reference to build.
   */
  return async function buildWorker(
    projectReference: ResolvedProjectReference,
  ) {
    return await new Promise<void>((resolve, reject) => {
      const name = relative(
        options.parentBaseDirectory,
        projectReference.sourceFile.fileName,
      );

      try {
        const workerData: WorkerOptions = {
          ...options,
          name,
          project: projectReference.sourceFile.fileName,
          tsConfig: projectReference.commandLine,
          baseDirectory: dirname(projectReference.sourceFile.fileName),
        };

        const worker = new Worker(new URL('./worker.js', import.meta.url), {
          workerData,
          stdout: true,
          stderr: true,
        });

        worker.stdout.on('data', (data) => {
          options.verbose && console.log(data.toString().trim());
        });

        worker.stderr.on('data', (data) => {
          options.verbose && console.error(data.toString().trim());
        });

        worker.on('error', (errorObject) => {
          reject(
            new WorkerError(
              `Failed to build referenced project "${name}"`,
              errorObject,
            ),
          );
        });

        worker.on('exit', (code) => {
          if (code === 0) {
            options.verbose && success(`Built referenced project "${name}".`);
            return resolve();
          }

          return reject(
            new Error(
              `Failed to build referenced project "${name}". The worker exited with code ${code}.`,
            ),
          );
        });
      } catch (errorObject) {
        reject(
          new WorkerError(`Failed to initialise "${name}" worker`, errorObject),
        );
      }
    });
  };
}

/**
 * The main function for the worker. This function should be run in the context
 * of a worker thread.
 *
 * @param options - The options passed to the worker as `workerData`.
 * @param options.baseDirectory - The base directory of the project.
 * @param options.clean - Whether to clean the output directory.
 * @param options.format - The module format to use.
 * @param options.name - The name of the project.
 * @param options.project - The project to build.
 * @param options.shims - Whether to use shims.
 * @param options.tsConfig - The TypeScript configuration.
 * @param options.verbose - Whether to log verbose output.
 */
export async function main({
  baseDirectory,
  clean,
  format,
  name,
  project,
  shims,
  tsConfig,
  verbose,
}: WorkerOptions) {
  cleanOutputDirectory(project, tsConfig.options, clean, verbose);

  const program = getInitialProgram({
    project,
    tsConfig,
    format,
    system: sys,
  });

  const build = getBuildFunction(tsConfig, false);
  await build({
    name,
    program,
    tsConfig,
    baseDirectory,
    compilerOptions: program.getCompilerOptions(),
    files: tsConfig.fileNames,
    format,
    system: sys,
    verbose,
    shims,
    host: createProjectReferencesCompilerHost(
      ['module'],
      tsConfig.options,
      getDefinedArray(program.getResolvedProjectReferences()),
      sys,
    ),
    projectReferences: tsConfig.projectReferences,
  });
}
