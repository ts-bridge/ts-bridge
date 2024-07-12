import { describe, expect, it } from 'vitest';

import { isObject, getIdentifierName, getDefinedArray } from './utils.js';

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

describe('getIdentifierName', () => {
  it.each([
    {
      value: 'foo-bar',
      expected: 'foobar',
    },
    {
      value: 'foo bar',
      expected: 'foobar',
    },
    {
      value: 'foo_bar',
      expected: 'foo_bar',
    },
    {
      value: '42foo',
      expected: 'foo',
    },
    {
      value: 'foo42',
      expected: 'foo',
    },
    {
      value: 'foo',
      expected: 'foo',
    },
    {
      value: '',
      expected: '_',
    },
  ])('converts "$value" to "$expected"', ({ value, expected }) => {
    expect(getIdentifierName(value)).toBe(expected);
  });
});

describe('getDefinedArray', () => {
  it('returns the array if it is defined', () => {
    expect(getDefinedArray([1, 2, 3])).toStrictEqual([1, 2, 3]);
  });

  it('removes undefined values from the array', () => {
    expect(getDefinedArray([1, undefined, 2, undefined, 3])).toStrictEqual([
      1, 2, 3,
    ]);
  });

  it('returns an empty array if the array is undefined', () => {
    expect(getDefinedArray(undefined)).toStrictEqual([]);
  });
});
