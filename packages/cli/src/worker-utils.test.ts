import { getFixture, noOp } from '@ts-bridge/test-utils';
import assert from 'assert';
import chalk from 'chalk';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Worker } from 'worker_threads';

import { getProgram } from './build-utils.js';
import { getTypeScriptConfig } from './config.js';
import { removeDirectory } from './file-system.js';
import { getDefinedArray } from './utils.js';
import { getWorkerBuildFunction, main } from './worker-utils.js';

beforeAll(() => {
  chalk.level = 0;
});

vi.mock('worker_threads', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const original = await importOriginal<typeof import('worker_threads')>();
  const MockWorker = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    postMessage: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
  }));

  return {
    ...original,
    Worker: MockWorker,
  };
});

vi.mock('./build-utils.js', async (importOriginal) => ({
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  ...(await importOriginal<typeof import('./build-utils.js')>()),
  getBuildFunction: vi.fn().mockImplementation(() => vi.fn()),
}));

vi.mock('./file-system.js', async (importOriginal) => ({
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  ...(await importOriginal<typeof import('./file-system.js')>()),
  removeDirectory: vi.fn(),
}));

const FIXTURE_NAME = 'project-references-node-16';
const FIXTURE_PATH = getFixture(FIXTURE_NAME);
const FIXTURE_TS_CONFIG = getFixture(FIXTURE_NAME, 'tsconfig.json');

describe('getWorkerBuildFunction', () => {
  it('creates a worker function', async () => {
    const fn = getWorkerBuildFunction({
      parentBaseDirectory: FIXTURE_PATH,
      format: ['commonjs'],
      shims: false,
      verbose: true,
    });

    expect(fn).toBeInstanceOf(Function);
  });

  describe('worker function', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    const fn = getWorkerBuildFunction({
      parentBaseDirectory: FIXTURE_PATH,
      format: ['commonjs'],
      shims: false,
      verbose: true,
    });

    it('builds a project reference', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(noOp);
      const { options, projectReferences, fileNames } =
        getTypeScriptConfig(FIXTURE_TS_CONFIG);

      const program = getProgram({
        compilerOptions: options,
        files: fileNames,
        projectReferences,
      });

      const [reference] = getDefinedArray(
        program.getResolvedProjectReferences(),
      );

      assert(reference);

      const promise = fn(reference);
      const worker = vi.mocked(Worker).mock.results[0]?.value;
      assert(worker);

      expect(worker.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(worker.on).toHaveBeenCalledWith('exit', expect.any(Function));

      const on = vi.mocked(worker.on);
      const exit = on.mock.calls[1][1];

      exit(0);

      await promise;
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining(
          'Built referenced project "packages/project-1/tsconfig.json".',
        ),
      );
    });

    it('forwards `stdout` and `stderr`', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(noOp);
      const error = vi.spyOn(console, 'error').mockImplementation(noOp);

      const { options, projectReferences, fileNames } =
        getTypeScriptConfig(FIXTURE_TS_CONFIG);

      const program = getProgram({
        compilerOptions: options,
        files: fileNames,
        projectReferences,
      });

      const [reference] = getDefinedArray(
        program.getResolvedProjectReferences(),
      );

      assert(reference);

      const promise = fn(reference);
      const worker = vi.mocked(Worker).mock.results[0]?.value;
      assert(worker);

      expect(worker.stdout.on).toHaveBeenCalledWith(
        'data',
        expect.any(Function),
      );

      expect(worker.stderr.on).toHaveBeenCalledWith(
        'data',
        expect.any(Function),
      );

      const stdoutOn = vi.mocked(worker.stdout.on);
      const stdoutData = stdoutOn.mock.calls[0][1];
      stdoutData(Buffer.from('Test message.'));

      const stderrOn = vi.mocked(worker.stderr.on);
      const stderrData = stderrOn.mock.calls[0][1];
      stderrData(Buffer.from('Test error.'));

      const on = vi.mocked(worker.on);
      const exit = on.mock.calls[1][1];

      exit(0);

      await promise;
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('Test message.'),
      );

      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('Test error.'),
      );
    });

    it('throws an error if the worker throws an error', async () => {
      const { options, projectReferences, fileNames } =
        getTypeScriptConfig(FIXTURE_TS_CONFIG);

      const program = getProgram({
        compilerOptions: options,
        files: fileNames,
        projectReferences,
      });

      const [reference] = getDefinedArray(
        program.getResolvedProjectReferences(),
      );

      assert(reference);

      const promise = fn(reference);
      const worker = vi.mocked(Worker).mock.results[0]?.value;

      const on = vi.mocked(worker.on);
      const error = on.mock.calls[0][1];

      error(new Error('Test error.'));

      await expect(promise).rejects.toThrow(
        'Failed to build referenced project "packages/project-1/tsconfig.json": Test error.',
      );
    });

    it('throws an error if the worker exits with a non-zero exit code', async () => {
      const { options, projectReferences, fileNames } =
        getTypeScriptConfig(FIXTURE_TS_CONFIG);

      const program = getProgram({
        compilerOptions: options,
        files: fileNames,
        projectReferences,
      });

      const [reference] = getDefinedArray(
        program.getResolvedProjectReferences(),
      );

      assert(reference);

      const promise = fn(reference);
      const worker = vi.mocked(Worker).mock.results[0]?.value;

      const on = vi.mocked(worker.on);
      const exit = on.mock.calls[1][1];

      exit(1);

      await expect(promise).rejects.toThrow(
        'Failed to build referenced project "packages/project-1/tsconfig.json". The worker exited with code 1.',
      );
    });

    it('throws an error if the worker fails to initialise', async () => {
      const { options, projectReferences, fileNames } =
        getTypeScriptConfig(FIXTURE_TS_CONFIG);

      const program = getProgram({
        compilerOptions: options,
        files: fileNames,
        projectReferences,
      });

      const [reference] = getDefinedArray(
        program.getResolvedProjectReferences(),
      );

      assert(reference);

      vi.mocked(Worker).mockImplementationOnce(() => {
        throw new Error('Test error.');
      });

      const promise = fn(reference);
      await expect(promise).rejects.toThrow(
        'Failed to initialise "packages/project-1/tsconfig.json" worker: Test error.',
      );
    });
  });
});

describe('main', () => {
  it('cleans the output directory', async () => {
    await main({
      baseDirectory: FIXTURE_PATH,
      clean: true,
      format: ['commonjs'],
      name: 'project-1',
      project: FIXTURE_TS_CONFIG,
      shims: false,
      tsConfig: getTypeScriptConfig(FIXTURE_TS_CONFIG),
      verbose: false,
    });

    expect(removeDirectory).toHaveBeenCalledWith(
      expect.stringContaining('project-references-node-16/dist'),
      expect.stringContaining('project-references-node-16'),
    );
  });

  it('builds the project', async () => {
    await expect(
      main({
        baseDirectory: FIXTURE_PATH,
        clean: false,
        format: ['commonjs'],
        name: 'project-1',
        project: FIXTURE_TS_CONFIG,
        shims: false,
        tsConfig: getTypeScriptConfig(FIXTURE_TS_CONFIG),
        verbose: false,
      }),
    ).resolves.not.toThrow();
  });
});
