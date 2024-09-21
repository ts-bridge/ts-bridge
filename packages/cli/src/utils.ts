import assert from 'assert';
import { availableParallelism } from 'os';

import type { DependencyGraph } from './project-references.js';

/**
 * Check if a value is an object (and not an array or `null`).
 *
 * @param value - The value to check.
 * @returns `true` if the value is an object, `false` otherwise.
 */
export function isObject(
  value: unknown,
): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Convert a string value to a safe identifier name. This basically removes any
 * characters that can be invalid for identifiers.
 *
 * @param value - The value to convert to camelCase.
 * @returns The identifier name.
 */
export function getIdentifierName(value: string) {
  const sanitisedValue = value.replace(/[\W0-9]/gu, '');
  if (sanitisedValue.length === 0) {
    return '_';
  }

  return sanitisedValue;
}

/**
 * Get the defined values from an array, removing all `undefined` values. If the
 * array itself is `undefined`, an empty array is returned.
 *
 * @param array - The array to get the defined values from.
 * @returns The array with all `undefined` values removed.
 */
export function getDefinedArray<Type>(
  array: readonly (Type | undefined)[] | undefined,
): Type[] {
  if (!array) {
    return [];
  }

  return array.filter((value): value is Type => value !== undefined);
}

/**
 * Run a function in parallel for each value in the graph. This means that the
 * function is run for each value in the graph, but the order in which the
 * values are processed is determined by the topological sort of the graph.
 * Values that are not dependent on each other, or that are dependent on each
 * other, but the dependencies have been resolved, are processed in parallel.
 *
 * @param sortedValues - The sorted values from the graph.
 * @param graph - The dependency graph.
 * @param fn - The function to run for each value. This function is expected to
 * spawn a new process or thread for each value, to properly parallelise the
 * work.
 * @param maxConcurrency - The maximum number of concurrent functions to run.
 */
export async function parallelise<Value>(
  sortedValues: Value[],
  graph: DependencyGraph<Value>,
  fn: (value: Value) => Promise<void>,
  maxConcurrency = availableParallelism(),
): Promise<void> {
  const resolved = new Set<Value>();
  const queue = [...sortedValues];
  const running = new Map<Value, Promise<void>>();

  /**
   * Check if a value is ready to be processed. A value is ready if all its
   * dependencies have been resolved.
   *
   * @param value - The value to check.
   * @returns Whether the value is ready to be processed.
   */
  function isReady(value: Value): boolean {
    const dependencies = graph.get(value) ?? [];
    return dependencies.every((dep) => resolved.has(dep));
  }

  /**
   * Run a task. This will call the provided function and add the value to the
   * resolved set when the function has completed.
   *
   * @param value - The value to run the function for.
   * @returns A promise that resolves when the function has completed.
   */
  async function run(value: Value): Promise<void> {
    try {
      await fn(value);
      resolved.add(value);
    } finally {
      running.delete(value);
    }
  }

  while (queue.length > 0 || running.size > 0) {
    while (running.size < maxConcurrency && queue.length > 0) {
      const nextTaskIndex = queue.findIndex(isReady);
      if (nextTaskIndex === -1) {
        break;
      }

      const nextTask = queue.splice(nextTaskIndex, 1)[0];
      assert(nextTask);

      const taskPromise = run(nextTask);
      running.set(nextTask, taskPromise);
    }

    // Wait for any running task to complete.
    /* istanbul ignore else -- @preserve */
    if (running.size > 0) {
      await Promise.race(running.values());
    }
  }
}
