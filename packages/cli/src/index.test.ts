import { noOp } from '@ts-bridge/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const main = vi.fn().mockResolvedValue(undefined);
vi.mock('./cli.js', () => ({
  main,
}));

describe('cli', () => {
  beforeEach(() => {
    // This ensures that the main function is called once per test.
    vi.resetModules();
  });

  it('runs the main function', async () => {
    await import('./index.js');

    expect(main).toHaveBeenCalled();
  });

  it('exits with an error code if the main function throws an error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(noOp);
    const error = new Error('An error occurred');
    main.mockRejectedValue(error);

    await import('./index.js');

    expect(process.exitCode).toBe(1);
    expect(consoleError).toHaveBeenCalledWith(error);
  });
});
