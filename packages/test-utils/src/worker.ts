import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { WorkerOptions } from 'worker_threads';

const TSCONFIG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'tsconfig.json',
);

/**
 * The worker code that runs TypeScript code. This is executed in the worker by
 * using it as a data URL.
 */
const WORKER_CODE = `
  import { createRequire } from 'module';
  import { workerData } from 'worker_threads';

  const filename = '${import.meta.url}';
  const tsconfig = '${TSCONFIG_PATH}';

  const require = createRequire(filename);
  const { tsImport } = require('tsx/esm/api');

  tsImport(workerData.fileName, {
    parentURL: import.meta.url,
    tsconfig,
  });
`;

/**
 * Partial signature of the `Worker` class. We use this to avoid a TypeScript
 * error when extending the original `Worker` class:
 *
 * TS4058: Return type of exported function has or is using name ... but cannot
 * be named.
 */
export type Worker = new (
  filename: string | URL,
  options?: WorkerOptions | undefined,
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
) => {
  // This is intentionally empty. The `Worker` class is only used for typing.
};

/**
 * Get a mock `Worker` class that runs TypeScript code.
 *
 * @param OriginalWorker - The original `Worker` class. This must be provided
 * in order to extend the original class without importing it directly. It can
 * be obtained using the `importOriginal` function in Vitest.
 * @returns The mock `Worker` class.
 * @example
 * vi.mock('worker_threads', async (importOriginal) => {
 *   // eslint-disable-next-line @typescript-eslint/consistent-type-imports
 *   const original = await importOriginal<typeof import('worker_threads')>();
 *
 *   return {
 *     ...original,
 *     Worker: getMockWorker(original.Worker),
 *   };
 * });
 */
export function getMockWorker(OriginalWorker: Worker) {
  return class TypeScriptWorker extends OriginalWorker {
    /**
     * Creates a new TypeScript worker.
     *
     * @param fileName - The file name of worker to run.
     * @param options - The worker options.
     * @returns The TypeScript worker.
     */
    constructor(fileName: string | URL, options: WorkerOptions = {}) {
      options.workerData ??= {};
      options.workerData.fileName = fileName.toString().replace('.js', '.ts');

      super(new URL(`data:text/javascript,${WORKER_CODE}`), options);
    }
  };
}
