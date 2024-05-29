import { describe, expect, it } from 'vitest';

import {
  getCharacterCount,
  getDataUrlMimeType,
  getDataUrlType,
  getProtocol,
  isDefined,
  isFlagEnabled,
  isObject,
  isPath,
  isRelativeExports,
  isURL,
  parseJson,
} from './utils.js';

describe('isURL', () => {
  it.each([
    'http://example.com',
    'https://example.com',
    'file:///example.com',
    'data:text/javascript,console.log("Hello, world!")',
    'data:application/json,{"hello":"world"}',
  ])('returns true for "%s"', (url) => {
    expect(isURL(url)).toBe(true);
  });

  it.each(['example.com', 'example'])('returns false for "%s"', (url) => {
    expect(isURL(url)).toBe(false);
  });
});

describe('getProtocol', () => {
  it.each([
    ['http:', 'http://example.com'],
    ['https:', 'https://example.com'],
    ['file:', 'file:///example.com'],
    ['data:', 'data:text/javascript,console.log("Hello, world!")'],
  ])('returns "%s" for "%s"', (protocol, url) => {
    expect(getProtocol(url)).toBe(protocol);
  });
});

describe('isPath', () => {
  it.each(['/example', './example', '../example'])(
    'returns true for "%s"',
    (path) => {
      expect(isPath(path)).toBe(true);
    },
  );

  it.each(['example.com', 'example'])('returns false for "%s"', (path) => {
    expect(isPath(path)).toBe(false);
  });
});

describe('parseJson', () => {
  it('parses JSON', () => {
    expect(parseJson('{"hello":"world"}')).toStrictEqual({ hello: 'world' });
  });

  it('returns `null` for invalid JSON', () => {
    expect(parseJson('hello')).toBe(null);
  });
});

describe('isObject', () => {
  it.each([{ hello: 'world' }, {}])('returns `true` for `%o`', (value) => {
    expect(isObject(value)).toBe(true);
  });

  it.each([null, undefined, 0, 'hello', ['hello']])(
    'returns `false` for `%o`',
    (value) => {
      expect(isObject(value)).toBe(false);
    },
  );
});

describe('isRelativeExports', () => {
  it('returns true if all keys in an object are relative', () => {
    expect(isRelativeExports({ './foo': 'bar', './baz/qux': 'quux' })).toBe(
      true,
    );
  });

  it('returns false if any key in an object is not relative', () => {
    expect(isRelativeExports({ './foo': 'bar', baz: 'qux' })).toBe(false);
  });
});

describe('isDefined', () => {
  it.each([
    [false, null],
    [false, undefined],
    [true, 0],
    [true, ''],
  ])('returns `%s` for `%o`', (expected, value) => {
    expect(isDefined(value)).toBe(expected);
  });
});

describe('getCharacterCount', () => {
  it('returns the number of characters in a string', () => {
    expect(getCharacterCount('hello', 'l')).toBe(2);
  });

  it('returns 0 if the character is not found', () => {
    expect(getCharacterCount('hello', 'z')).toBe(0);
  });

  it('supports special characters', () => {
    expect(getCharacterCount('hello, world!', ',')).toBe(1);
  });
});

describe('isFlagEnabled', () => {
  it('returns true if the flag is enabled', () => {
    expect(
      isFlagEnabled('--experimental-wasm-modules', [
        '--experimental-wasm-modules',
      ]),
    ).toBe(true);
  });

  it('returns false if the flag is disabled', () => {
    expect(isFlagEnabled('--experimental-wasm-modules', [])).toBe(false);
  });

  it('returns false if the flag is not set', () => {
    expect(isFlagEnabled('--experimental-wasm-modules')).toBe(false);
  });
});

describe('getDataUrlMimeType', () => {
  it.each([
    ['text/javascript', 'data:text/javascript,console.log("Hello, world!")'],
    ['application/json', 'data:application/json,{"hello":"world"}'],
    ['application/wasm', 'data:application/wasm,base64,...'],
  ])('returns "%s" for "%s"', (mimeType, url) => {
    expect(getDataUrlMimeType(url)).toBe(mimeType);
  });

  it('throws an error if the MIME type is not found', () => {
    expect(() => getDataUrlMimeType('data:')).toThrow(
      'Module specifier is an invalid URL, package name or package subpath specifier: "data:".',
    );
  });
});

describe('getDataUrlType', () => {
  it.each([
    ['module', 'data:text/javascript,console.log("Hello, world!")'],
    ['json', 'data:application/json,{"hello":"world"}'],
    ['wasm', 'data:application/wasm,base64,...'],
  ])('returns "%s" for "%s"', (mimeType, url) => {
    expect(getDataUrlType(url)).toBe(mimeType);
  });

  it('throws an error if the MIME type is not found', () => {
    expect(() => getDataUrlType('data:')).toThrow(
      'Module specifier is an invalid URL, package name or package subpath specifier: "data:".',
    );
  });

  it('throws an error if the MIME type is not supported', () => {
    expect(() => getDataUrlType('data:application/unknown,...')).toThrow(
      'Module specifier is an invalid URL, package name or package subpath specifier: "data:application/unknown,...".',
    );
  });
});
