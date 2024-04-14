import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('isShimsPackageInstalled', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns true if the package is installed', async () => {
    vi.doMock('module', () => ({
      createRequire: vi.fn(() => ({
        resolve: vi.fn(),
      })),
    }));

    const { isShimsPackageInstalled } = await import('./shims.js');
    expect(isShimsPackageInstalled(import.meta.url)).toBe(true);
  });

  it('returns false if the package is not installed', async () => {
    vi.doMock('module', () => ({
      createRequire: vi.fn(() => ({
        resolve: vi.fn(() => {
          throw new Error();
        }),
      })),
    }));

    const { isShimsPackageInstalled } = await import('./shims.js');
    expect(isShimsPackageInstalled(import.meta.url)).toBe(false);
  });
});
