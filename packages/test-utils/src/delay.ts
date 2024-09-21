/**
 * Delay for a given number of milliseconds.
 *
 * @param ms - The number of milliseconds to delay for.
 * @returns A promise that resolves after the given number of milliseconds.
 * @example
 * await delay(1000); // Delay for 1 second
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
