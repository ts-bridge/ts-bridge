/**
 * An object containing the exports for a package, i.e., the `exports` field in
 * a `package.json`.
 *
 * The keys are the names of the exports, and the values are the paths to the
 * files that the exports point to, or an object containing the exports for
 * certain conditions.
 */
export type PackageExportsObject = Record<
  string,
  string | Record<string, string>
>;

/**
 * The exports for a package, i.e., the `exports` field in a `package.json`.
 */
export type PackageExports = string | string[] | PackageExportsObject;

/**
 * An object containing the imports for a package, i.e., the `imports` field in
 * a `package.json`.
 *
 * The keys are the names of the imports, and the values are the paths to the
 * files that the imports point to.
 */
export type PackageImports = Record<string, string>;

/**
 * A (partial) `package.json` file. This type is used to represent the contents
 * of a `package.json` file, and is used to extract the information needed to
 * resolve imports.
 *
 * It does not contain all the fields of a `package.json` file, only the fields
 * that are relevant for resolving imports.
 */
export type PackageJson = {
  /**
   * The name of the package.
   */
  name?: string;

  /**
   * The type of the package.
   */
  type?: 'commonjs' | 'module';

  /**
   * The main entry point of the package. This is unused if `exports` is
   * present.
   */
  main?: string;

  /**
   * The exports of the package.
   */
  exports?: PackageExports;

  /**
   * The imports of the package.
   */
  imports?: PackageImports;
};

/**
 * The supported file formats for resolving imports.
 */
export type FileFormat = 'module' | 'commonjs' | 'json' | 'wasm' | 'builtin';

/**
 * The resolution of an import.
 */
export type Resolution = {
  /**
   * The absolute path to the resolved file.
   */
  path: string;

  /**
   * The format of the resolved file, or `null` if the format is unknown.
   */
  format: FileFormat | null;
};
