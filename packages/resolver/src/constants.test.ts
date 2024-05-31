import { describe, expect, it } from 'vitest';

import { DEFAULT_CONDITIONS } from './constants.js';

describe('DEFAULT_CONDITIONS', () => {
  it('is defined', () => {
    expect(DEFAULT_CONDITIONS).toBeDefined();
    expect(DEFAULT_CONDITIONS).toBeInstanceOf(Array);
  });
});
