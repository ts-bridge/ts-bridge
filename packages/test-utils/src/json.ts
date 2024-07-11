/**
 * Parse a JSON string.
 *
 * @param value - The JSON string to parse.
 * @returns The parsed JSON object, or `null` if the input is `undefined`.
 */
export function parseJson(value: string | undefined) {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
