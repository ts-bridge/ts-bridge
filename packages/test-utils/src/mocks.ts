type MockTsConfigJsonOptions = {
  /**
   * The compiler options to use.
   */
  compilerOptions?: Record<string, unknown>;

  /**
   * The include paths to use.
   */
  include?: string[];

  /**
   * The exclude paths to use.
   */
  exclude?: string[];
};

/**
 * Get a mock `tsconfig.json` file.
 *
 * @param options - The options to use.
 * @param options.compilerOptions - The compiler options to use.
 * @param options.include - The include paths to use.
 * @param options.exclude - The exclude paths to use.
 * @returns The mock `tsconfig.json` file.
 */
export function getMockTsConfig({
  compilerOptions = {},
  include = undefined,
  exclude = ['node_modules'],
}: MockTsConfigJsonOptions = {}): Record<string, unknown> {
  return {
    compilerOptions: {
      declaration: true,
      declarationMap: true,
      esModuleInterop: true,
      lib: ['ES2022'],
      module: 'Node16',
      moduleResolution: 'Node16',
      outDir: '/',
      declarationDir: '/',
      skipLibCheck: true,
      strict: true,
      target: 'ES2022',
      ...compilerOptions,
    },
    include,
    exclude,
  };
}

type MockPackageJsonOptions = {
  /**
   * The name of the package.
   */
  name: string;

  /**
   * The version of the package.
   */
  version?: string;

  /**
   * The main file of the package.
   */
  main?: string;

  /**
   * The type of module to use in the `package.json` file.
   */
  type?: 'commonjs' | 'module';

  /**
   * The exports of the package.
   */
  exports?: Record<string, unknown>;
};

/**
 * Get a mock `package.json` file.
 *
 * @param options - The options to use.
 * @param options.name - The name of the package.
 * @param options.version - The version of the package.
 * @param options.main - The main file of the package.
 * @param options.type - The type of module to use in the `package.json` file.
 * @param options.exports - The exports of the package.
 * @returns The mock `package.json` file.
 */
export function getMockPackageJson({
  name,
  version = '1.0.0',
  main = 'index.cjs',
  type,
  exports,
}: MockPackageJsonOptions): Record<string, unknown> {
  return {
    name,
    version,
    main,
    type,
    exports,
  };
}

type MockNodeModuleOptions = {
  /**
   * The name of the module.
   */
  name: string;

  /**
   * The files to include in the module.
   */
  files: Record<string, string>;

  /**
   * The `package.json` file to include in the module.
   */
  packageJson?: Record<string, unknown>;
};

/**
 * Get a mock node module.
 *
 * @param options - The options to use.
 * @param options.name - The name of the module.
 * @param options.files - The files to include in the module.
 * @param options.packageJson - The `package.json` file to include in the
 * module.
 * @returns The mock node module.
 */
export function getMockNodeModule({
  name,
  files,
  packageJson = getMockPackageJson({ name }),
}: MockNodeModuleOptions): Record<string, string> {
  const basePath = `/node_modules/${name}`;
  const sourceFiles = Object.fromEntries(
    Object.entries(files).map(([fileName, content]) => [
      `${basePath}/${fileName}`,
      content,
    ]),
  );

  return {
    ...sourceFiles,
    [`${basePath}/package.json`]: JSON.stringify(packageJson),
  };
}

/**
 * A no-op function.
 *
 * @returns `undefined`.
 */
export function noOp() {
  return undefined;
}
