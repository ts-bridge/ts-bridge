import { beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from './worker-utils.js';

vi.mock('./worker-utils.js', () => ({
  main: vi.fn(),
}));

describe('worker', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calls the main function with the provided worker data', async () => {
    const workerData = {
      foo: 'bar',
    };

    vi.doMock('worker_threads', () => ({
      workerData,
      parentPort: {},
      isMainThread: false,
    }));

    await import('./worker.js');

    expect(main).toHaveBeenCalledWith(workerData);
  });

  it('throws an error if the current context is not a worker', async () => {
    vi.doMock('worker_threads', () => ({
      workerData: {},
      parentPort: {},
      isMainThread: true,
    }));

    await expect(import('./worker.js')).rejects.toThrowError(
      'This module must be run as a worker.',
    );
  });

  it('throws an error if the parent port is not available', async () => {
    vi.doMock('worker_threads', () => ({
      workerData: {},
      parentPort: null,
      isMainThread: false,
    }));

    await expect(import('./worker.js')).rejects.toThrowError(
      'This module must be run as a worker.',
    );
  });
});
