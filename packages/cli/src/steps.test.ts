import { noOp } from '@ts-bridge/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { executeSteps } from './steps.js';

describe('executeSteps', () => {
  it('executes steps in series', () => {
    vi.spyOn(console, 'log').mockImplementation(noOp);

    const first = vi.fn();
    const second = vi.fn();

    const steps = [
      { name: 'first', task: first },
      { name: 'second', task: second },
    ];

    executeSteps(steps, {});

    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it('logs each step if verbose is true', () => {
    vi.spyOn(console, 'log').mockImplementation(noOp);

    const first = vi.fn();
    const second = vi.fn();

    const steps = [
      { name: 'first', task: first },
      { name: 'second', task: second },
    ];

    executeSteps(steps, {}, true);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('first'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('second'));
  });

  it('catches errors and sets the process exit code', () => {
    vi.spyOn(console, 'log').mockImplementation(noOp);
    vi.spyOn(console, 'error').mockImplementation(noOp);

    const error = new Error('test error');
    const task = vi.fn(() => {
      throw error;
    });

    const steps = [{ name: 'task', task }];

    executeSteps(steps, {});

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('test error'),
    );
    expect(process.exitCode).toBe(1);
  });
});
