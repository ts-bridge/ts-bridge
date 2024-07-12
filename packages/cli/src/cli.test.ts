import { noOp } from '@ts-bridge/test-utils';
import { resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';

import { buildHandler } from './build.js';
import { main } from './cli.js';

describe('cli', () => {
  it('logs the manual', async () => {
    // @ts-expect-error - `process.exit` returns `never`.
    const processExit = vi.spyOn(process, 'exit').mockImplementation(noOp);
    const log = vi.spyOn(console, 'log').mockImplementation(noOp);

    await main(['node', 'ts-bridge', '--help']);

    expect(processExit).toHaveBeenCalledWith(0);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        'Build the project using the TypeScript compiler. This is the default command.',
      ),
    );
  });

  it('calls the build handler with the provided arguments', async () => {
    vi.mock('./build.js', () => ({
      buildHandler: vi.fn(),
    }));

    await main([
      'node',
      'ts-bridge',
      'build',
      '--project',
      './tsconfig.json',
      '--formats',
      'module',
      '--formats',
      'commonjs',
      '--clean',
      '--references',
    ]);

    expect(buildHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        clean: true,
        formats: ['module', 'commonjs'],
        project: resolve(process.cwd(), './tsconfig.json'),
        references: true,
      }),
    );
  });

  it('logs an error and exits when the build handler fails', async () => {
    vi.mocked(buildHandler).mockRejectedValueOnce(new Error('Test error.'));

    // @ts-expect-error - `process.exit` returns `never`.
    const processExit = vi.spyOn(process, 'exit').mockImplementation(noOp);
    const log = vi.spyOn(console, 'error').mockImplementation(noOp);

    await expect(main(['node', 'ts-bridge', 'build'])).rejects.toThrow(
      'Test error.',
    );

    expect(processExit).toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Test error.'));
  });
});
