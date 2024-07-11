import { resolve } from 'path';
import typescript from 'typescript';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import { buildHandler } from './build.js';
import { error } from './logging.js';

const { sys } = typescript;

/**
 * The main function that is called when the CLI is executed.
 *
 * @param argv - The command line arguments.
 * @returns A promise that resolves when the build is complete.
 */
export async function main(argv: string[]) {
  await yargs(hideBin(argv))
    .command(
      ['build', '$0'],
      // ['build [files ...]', '$0 [files ...]'],
      'Build the project using the TypeScript compiler. This is the default command.',
      (builder) =>
        builder
          .option('project', {
            alias: 'p',
            type: 'string',
            description: 'Path to the `tsconfig.json` file.',
            default: './tsconfig.json',
            coerce: (value) => {
              return resolve(process.cwd(), value);
            },
          })
          .option('format', {
            alias: 'f',
            type: 'array',
            description:
              'The format(s) of the output files. Defaults to `module` and `commonjs`.',
            choices: ['module', 'commonjs'],
            default: ['module', 'commonjs'],
          })
          .option('clean', {
            type: 'boolean',
            description: 'Remove the output directory before building.',
            default: false,
          })
          .option('verbose', {
            type: 'boolean',
            description: 'Enable verbose logging.',
            default: false,
          }),
      // .positional('files', {
      //   type: 'string',
      //   description:
      //     'The files to build. Defaults to the files in the `tsconfig.json`.',
      //   array: true,
      //   demandOption: false,
      // }),
      (options) => {
        return buildHandler({
          ...options,
          system: sys,
        });
      },
    )
    .fail((_, _error) => {
      error(_error);

      // If we don't exit immediately, Yargs will duplicate the error message.
      // eslint-disable-next-line n/no-process-exit
      process.exit(1);
    })
    .showHelpOnFail(false)
    .parseAsync();
}
