import { describe, expect, it, vi } from 'vitest';

import { getImportMetaUrl } from './commonjs.js';

describe('getImportMetaUrl', () => {
  it('returns the URL of the current module when `document` is undefined', () => {
    expect(getImportMetaUrl(__filename)).toBe(`file://${__filename}`);
  });

  it('returns the URL of the current script when `document.currentScript.src` is defined', () => {
    vi.stubGlobal('document', {
      currentScript: { src: 'http://example.com/script.js' },
      baseURI: 'http://example.com/',
    });

    expect(getImportMetaUrl(__filename)).toBe('http://example.com/script.js');
  });

  it('returns the URL of the main script when `document.baseURI` is undefined', () => {
    vi.stubGlobal('document', {
      baseURI: 'http://example.com/',
    });

    expect(getImportMetaUrl(__filename)).toBe('http://example.com/main.js');
  });
});
