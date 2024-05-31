import { describe, expect, it } from 'vitest';

import {
  isValidPath,
  isValidPathSegments,
  validateExportsObject,
  validatePatternKey,
} from './validation.js';

describe('isValidPathSegments', () => {
  it('returns `true` for an array without any invalid segments', () => {
    expect(isValidPathSegments(['foo', 'bar'])).toBe(true);
  });

  it.each(['.', '..', 'node_modules', ''])(
    'returns `false` for an array containing "%s"',
    (segment) => {
      expect(isValidPathSegments(['foo', segment])).toBe(false);
    },
  );
});

describe('isValidPath', () => {
  it('returns `true` for a path without any invalid segments', () => {
    expect(isValidPath('foo/bar')).toBe(true);
  });

  it('returns `true` for a path with backslashes', () => {
    expect(isValidPath('foo\\bar')).toBe(true);
  });

  it.each(['./foo', '../foo', 'node_modules', ''])(
    'returns `false` for a path containing "%s"',
    (segment) => {
      expect(isValidPath(`foo/${segment}`)).toBe(false);
    },
  );

  it.each(['./foo', '../foo', 'node_modules', ''])(
    'returns `false` for a path containing "%s" with backslashes',
    (segment) => {
      expect(isValidPath(`foo\\${segment}`)).toBe(false);
    },
  );

  it('is case-insensitive', () => {
    expect(isValidPath('foo/NODE_MODULES')).toBe(false);
  });
});

describe('validateExportsObject', () => {
  it('does not throw an error for an object with only relative keys', () => {
    expect(() =>
      validateExportsObject('file:///foo/package.json', {
        './foo': 'bar',
        './baz/qux': 'quux',
      }),
    ).not.toThrow();
  });

  it('does not throw an error for an object with only non-relative keys', () => {
    expect(() =>
      validateExportsObject('file:///foo/package.json', {
        foo: 'bar',
        baz: 'qux',
      }),
    ).not.toThrow();
  });

  it('throws an error for an object with a mix of relative and non-relative keys', () => {
    expect(() =>
      validateExportsObject('file:///foo/package.json', {
        './foo': 'bar',
        baz: 'qux',
      }),
    ).toThrow(
      '`package.json` configuration is invalid or contains an invalid configuration: "file:///foo/package.json".',
    );
  });

  it('throws an error for an object containing valid array index keys', () => {
    expect(() =>
      validateExportsObject('file:///foo/package.json', {
        '0': 'bar',
        '1': 'qux',
      }),
    ).toThrow(
      '`package.json` configuration is invalid or contains an invalid configuration: "file:///foo/package.json".',
    );
  });
});

describe('validatePatternKey', () => {
  it('does not throw an error for a valid pattern key', () => {
    expect(() => validatePatternKey('./foo/')).not.toThrow();
    expect(() => validatePatternKey('./foo/*')).not.toThrow();
  });

  it('throws an error for an invalid pattern key', () => {
    expect(() => validatePatternKey('./foo')).toThrow();
  });
});
