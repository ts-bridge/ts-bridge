import { describe, expect, it } from 'vitest';

import {
  InvalidModuleSpecifierError,
  InvalidPackageConfigurationError,
  InvalidPackageTargetError,
  ModuleNotFoundError,
  PackageImportNotDefinedError,
  PackagePathNotExportedError,
  UnsupportedDirectoryImportError,
} from './errors.js';

describe('InvalidModuleSpecifierError', () => {
  it('is an error', () => {
    const error = new InvalidModuleSpecifierError('invalid');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      'Module specifier is an invalid URL, package name or package subpath specifier: "invalid".',
    );
  });
});

describe('UnsupportedDirectoryImportError', () => {
  it('is an error', () => {
    const error = new UnsupportedDirectoryImportError('invalid');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      'The resolved path corresponds to a directory, which is not a supported target for module imports: "invalid".',
    );
  });
});

describe('ModuleNotFoundError', () => {
  it('is an error', () => {
    const error = new ModuleNotFoundError('invalid');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      'The package or module requested does not exist: "invalid".',
    );
  });
});

describe('InvalidPackageConfigurationError', () => {
  it('is an error', () => {
    const error = new InvalidPackageConfigurationError('invalid');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      '`package.json` configuration is invalid or contains an invalid configuration: "invalid".',
    );
  });
});

describe('InvalidPackageTargetError', () => {
  it('is an error', () => {
    const error = new InvalidPackageTargetError('invalid');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      'Package exports or imports define a target module for the package that is an invalid type or string target: "invalid".',
    );
  });
});

describe('PackagePathNotExportedError', () => {
  it('is an error', () => {
    const error = new PackagePathNotExportedError('invalid');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      'Package exports do not define or permit a target subpath in the package for the given module: "invalid".',
    );
  });
});

describe('PackageImportNotDefinedError', () => {
  it('is an error', () => {
    const error = new PackageImportNotDefinedError('invalid');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(
      'Package imports do not define the specifier: "invalid".',
    );
  });
});
