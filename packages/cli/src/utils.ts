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
