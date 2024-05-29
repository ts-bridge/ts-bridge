/**
 * An error that is thrown when a module specifier is an invalid URL, package
 * name or package subpath specifier.
 */
export class InvalidModuleSpecifierError extends Error {
  /**
   * Create a new `InvalidModuleSpecifierError`.
   *
   * @param moduleSpecifier - The module specifier that is invalid.
   * @returns A new `InvalidModuleSpecifierError`.
   */
  constructor(moduleSpecifier: string) {
    super(
      `Module specifier is an invalid URL, package name or package subpath specifier: "${moduleSpecifier}".`,
    );
  }
}

/**
 * An error that is thrown when a module specifier is a directory.
 */
export class UnsupportedDirectoryImportError extends Error {
  /**
   * Create a new `UnsupportedDirectoryImportError`.
   *
   * @param moduleSpecifier - The module specifier that is a directory.
   * @returns A new `UnsupportedDirectoryImportError`.
   */
  constructor(moduleSpecifier: string) {
    super(
      `The resolved path corresponds to a directory, which is not a supported target for module imports: "${moduleSpecifier}".`,
    );
  }
}

/**
 * An error that is thrown when a package is not found.
 */
export class ModuleNotFoundError extends Error {
  /**
   * Create a new `ModuleNotFoundError`.
   *
   * @param moduleSpecifier - The module specifier that is not found.
   * @returns A new `ModuleNotFoundError`.
   */
  constructor(moduleSpecifier: string) {
    super(
      `The package or module requested does not exist: "${moduleSpecifier}".`,
    );
  }
}

/**
 * An error that is thrown when a `package.json` configuration is invalid.
 */
export class InvalidPackageConfigurationError extends Error {
  /**
   * Create a new `InvalidPackageConfigurationError`.
   *
   * @param packageUrl - The URL of the `package.json` file.
   * @returns A new `InvalidPackageConfigurationError`.
   */
  constructor(packageUrl: string) {
    super(
      `\`package.json\` configuration is invalid or contains an invalid configuration: "${packageUrl}".`,
    );
  }
}

/**
 * An error that is thrown when a package exports configuration is invalid.
 */
export class InvalidPackageTargetError extends Error {
  /**
   * Create a new `InvalidPackageTargetError`.
   *
   * @param target - The target of the package exports.
   * @returns A new `InvalidPackageTargetError`.
   */
  constructor(target: string) {
    super(
      `Package exports or imports define a target module for the package that is an invalid type or string target: "${target}".`,
    );
  }
}

/**
 * An error that is thrown when a package subpath is not exported.
 */
export class PackagePathNotExportedError extends Error {
  /**
   * Create a new `PackagePathNotExportedError`.
   *
   * @param packageSubpath - The subpath of the package that is not exported.
   * @returns A new `PackagePathNotExportedError`.
   */
  constructor(packageSubpath: string) {
    super(
      `Package exports do not define or permit a target subpath in the package for the given module: "${packageSubpath}".`,
    );
  }
}

/**
 * An error that is thrown when a package import is not defined.
 */
export class PackageImportNotDefinedError extends Error {
  /**
   * Create a new `PackageImportNotDefinedError`.
   *
   * @param packageSpecifier - The package specifier that is not defined.
   * @returns A new `PackageImportNotDefinedError`.
   */
  constructor(packageSpecifier: string) {
    super(
      `Package imports do not define the specifier: "${packageSpecifier}".`,
    );
  }
}
