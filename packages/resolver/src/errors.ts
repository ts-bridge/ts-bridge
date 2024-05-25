export class InvalidModuleSpecifierError extends Error {
  constructor(moduleSpecifier: string) {
    super(
      `Module specifier is an invalid URL, package name or package subpath specifier: "${moduleSpecifier}".`,
    );
  }
}

export class UnsupportedDirectoryImportError extends Error {
  constructor(moduleSpecifier: string) {
    super(
      `The resolved path corresponds to a directory, which is not a supported target for module imports: "${moduleSpecifier}".`,
    );
  }
}

export class ModuleNotFoundError extends Error {
  constructor(moduleSpecifier: string) {
    super(
      `The package or module requested does not exist: "${moduleSpecifier}".`,
    );
  }
}

export class InvalidPackageConfigurationError extends Error {
  constructor(packageUrl: string) {
    super(
      `\`package.json\` configuration is invalid or contains an invalid configuration: "${packageUrl}".`,
    );
  }
}

export class InvalidPackageTargetError extends Error {
  constructor(target: string) {
    super(
      `Package exports or imports define a target module for the package that is an invalid type or string target: "${target}".`,
    );
  }
}

export class PackagePathNotExportedError extends Error {
  constructor(packageSubpath: string) {
    super(
      `Package exports do not define or permit a target subpath in the package for the given module: "${packageSubpath}".`,
    );
  }
}

export class PackageImportNotDefinedError extends Error {
  constructor(packageSpecifier: string) {
    super(
      `Package imports do not define the specifier: "${packageSpecifier}".`,
    );
  }
}
