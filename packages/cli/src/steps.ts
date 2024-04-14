import chalk from 'chalk';

import { error, info } from './logging.js';

/**
 * A single step to execute in a series of steps.
 */
export type Step<Context extends Record<string, unknown>> = {
  name: string;
  condition?: (context: Context) => boolean;
  task: (context: Context) => void;
};

/**
 * A list of steps to execute in series.
 */
export type Steps<Context extends Record<string, unknown>> = Readonly<
  Step<Context>[]
>;

/**
 * Execute a list of steps in series. Each step receives the context object,
 * and can conditionally execute based on the context.
 *
 * @param steps - The steps to execute.
 * @param context - The context object that will be passed to each step.
 * @param verbose - Whether to log each step as it is executed.
 */
export function executeSteps<Context extends Record<string, unknown>>(
  steps: Steps<Context>,
  context: Context,
  verbose?: boolean,
) {
  try {
    for (const step of steps) {
      // If the step has a condition, and it returns false, we skip the step.
      if (step.condition && !step.condition(context)) {
        continue;
      }

      verbose && info(chalk.bold(step.name));
      step.task(context);
    }
  } catch (_error) {
    error(_error);
    process.exitCode = 1;
  }
}
