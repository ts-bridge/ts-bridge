import { describe, expect, it } from 'vitest';

import { isObject } from './utils.js';

describe('isObject', () => {
  it('returns `true` if the value is an object', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ key: 'value' })).toBe(true);
  });

  it('returns `false` if the value is not an object', () => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject('string')).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject(Symbol('symbol'))).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject(() => undefined)).toBe(false);
  });
});
