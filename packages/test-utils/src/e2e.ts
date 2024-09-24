import assert from 'assert';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import EventEmitter from 'events';
import { join } from 'path';
import stripAnsi from 'strip-ansi';
import { fileURLToPath } from 'url';

import { delay } from './delay.js';

/**
 * A test runner for running CLI commands. It keeps track of the stdout and
 * stderr of the process, and emits events when new data is written to stdout or
 * stderr.
 */
class CommandLineRunner extends EventEmitter {
  readonly #process: ChildProcess;

  readonly stdout: string[] = [];

  readonly stderr: string[] = [];

  readonly #defaultTimeout: number;

  #output = '';

  #exitCode?: number | null = null;

  constructor(
    command: string,
    options: string[],
    workingDirectory: string = process.cwd(),
    defaultTimeout = 30000,
  ) {
    super();

    this.#defaultTimeout = defaultTimeout;
    this.#process = spawn(command, options, {
      cwd: workingDirectory,
      stdio: 'pipe',
    });

    this.#process.stdout?.on('data', (data) => {
      const string = data.toString();
      this.#output += string;

      this.stdout.push(string);
      this.emit('stdout', string);
    });

    this.#process.stderr?.on('data', (data) => {
      const string = data.toString();
      this.#output += string;

      this.stderr.push(string);
      this.emit('stderr', string);
    });

    this.#process.on('exit', (exitCode) => {
      this.#exitCode = exitCode;
      this.emit('exit', exitCode);
    });
  }

  /**
   * Whether the process is running.
   *
   * @returns `true` if the process is running, otherwise `false`.
   */
  get running() {
    return this.#exitCode === null;
  }

  /**
   * The output of the command, without ANSI escape codes.
   *
   * @returns The output of the command.
   */
  get output() {
    return stripAnsi(this.#output);
  }

  /**
   * Kill the process. If the process is already dead, this does nothing.
   *
   * @param signal - The signal to send to the process.
   */
  kill(signal?: NodeJS.Signals) {
    if (!this.running) {
      return;
    }

    this.#process.kill(signal);
  }

  /**
   * Wait for the process to exit.
   *
   * @returns The exit code.
   */
  async waitForExit() {
    if (!this.running) {
      return this.#exitCode;
    }

    return new Promise<number | null>((resolve) => {
      this.#process.on('exit', (exitCode) => {
        resolve(exitCode);
      });
    });
  }

  /**
   * Wait for a message to be written to stdout.
   *
   * @param message - The message to wait for. If a string, the message must be
   * contained in the stdout. If a regular expression, the message must match
   * the stdout.
   * @param timeout - How long to wait for the message. If the message is not
   * written to stdout within this time, an error is thrown.
   * @returns The message that was written to stdout.
   */
  async expectStdout(
    message?: string | RegExp,
    timeout = this.#defaultTimeout,
  ) {
    assert(
      this.running,
      'Cannot wait for stdout while process is not running.',
    );

    const promise = new Promise<string>((resolve) => {
      const listener = (actual: string) => {
        if (this.#matches(message, actual)) {
          this.off('stdout', listener);
          resolve(actual);
        }
      };

      this.on('stdout', listener);
    });

    return await Promise.race([
      promise,
      this.#timeout(timeout, `Timed out waiting for stdout.`),
    ]);
  }

  /**
   * Wait for a message to be written to stderr.
   *
   * @param message - The message to wait for. If a string, the message must be
   * contained in the stderr. If a regular expression, the message must match
   * the stderr.
   * @param timeout - How long to wait for the message. If the message is not
   * written to stdout within this time, an error is thrown.
   * @returns The message that was written to stderr.
   */
  async expectStderr(
    message?: string | RegExp,
    timeout = this.#defaultTimeout,
  ) {
    assert(
      this.running,
      'Cannot wait for stderr while process is not running.',
    );

    const promise = new Promise<string>((resolve) => {
      const listener = (actual: string) => {
        if (this.#matches(message, actual)) {
          this.off('stderr', listener);
          resolve(actual);
        }
      };

      this.on('stderr', listener);
    });

    return await Promise.race([
      promise,
      this.#timeout(timeout, `Timed out waiting for stderr.`),
    ]);
  }

  /**
   * Check if `expected` matches `actual`.
   *
   * @param expected - The expected message.
   * @param actual - The actual message.
   * @returns `true` if `expected` matches `actual`, otherwise `false`.
   */
  #matches(expected: string | RegExp | undefined, actual: string) {
    if (expected === undefined) {
      return true;
    }

    if (typeof expected === 'string') {
      return actual.includes(expected);
    }

    return expected.test(actual);
  }

  async #timeout(timeout: number, message: string) {
    await delay(timeout);

    this.kill('SIGKILL');
    throw new Error(message);
  }
}

/**
 * Get a command runner.
 *
 * @param command - The `ts-bridge` CLI command to run.
 * @param options - The options to pass to `ts-bridge`.
 * @param workingDirectory - The working directory to run the command in.
 * @returns The test runner.
 */
export function run(
  command: string,
  options: string[] = [],
  workingDirectory: string = process.cwd(),
) {
  return new CommandLineRunner(
    'node',
    [
      join(
        fileURLToPath(import.meta.url),
        '..',
        '..',
        '..',
        'cli',
        'dist',
        'index.js',
      ),
      command,
      ...options,
    ],
    workingDirectory,
  );
}
