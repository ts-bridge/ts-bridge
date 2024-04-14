import {
  createDefaultMapFromNodeModules,
  createSystem,
  createVirtualCompilerHost,
} from '@typescript/vfs';
import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, resolve, relative } from 'path';
import typescript from 'typescript';
import { fileURLToPath } from 'url';

import { getMockPackageJson, getMockTsConfig } from './mocks.js';

const {
  createProgram,
  formatDiagnosticsWithColorAndContext,
  getPreEmitDiagnostics,
  parseJsonConfigFileContent,
} = typescript;

/**
 * The path to the `node_modules` folder in the root of the project.
 */
const BASE_NODE_MODULES_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'node_modules',
);

/**
 * Get all the declaration files in the given path.
 *
 * @param basePath - The base path to use.
 * @param path - The path to get the declaration files from.
 * @returns The declaration files.
 */
function getFiles(basePath: string, path: string = basePath) {
  const files = new Set<string>();

  for (const file of readdirSync(path)) {
    const filePath = resolve(path, file);

    try {
      if (statSync(filePath).isDirectory()) {
        getFiles(basePath, filePath).forEach((childFile) =>
          files.add(childFile),
        );
        continue;
      }
    } catch {
      continue;
    }

    if (!file.endsWith('.d.ts')) {
      continue;
    }

    files.add(relative(basePath, filePath));
  }

  return files;
}

/**
 * Get a function that returns the declaration files in the `node_modules`
 * folder.
 *
 * @returns The function that returns the declaration files.
 */
function getGetDeclarationFiles() {
  let files: Map<string, string> | null = null;

  return () => {
    if (!files) {
      files = new Map();
      const nodeModules = getFiles(BASE_NODE_MODULES_PATH);
      for (const file of nodeModules) {
        files.set(
          `/node_modules/${file}`,
          readFileSync(resolve(BASE_NODE_MODULES_PATH, file), 'utf-8'),
        );
      }
    }

    return files;
  };
}

/**
 * Get the declaration files in the `node_modules` folder. This is a memoised
 * function that will only read the files from disk once.
 */
const getDeclarationFiles = getGetDeclarationFiles();

/**
 * Add any declaration files from the `node_modules` folder into the virtual
 * environment.
 *
 * @param fileSystem - The file system to add the declaration files to.
 */
function addNodeModulesToVirtualEnvironment(fileSystem: Map<string, string>) {
  const nodeModules = getDeclarationFiles();
  for (const [fileName, content] of nodeModules.entries()) {
    fileSystem.set(fileName, content);
  }
}

type VirtualEnvironmentOptions = {
  /**
   * The files to include in the memory environment.
   */
  files: Record<string, string>;

  /**
   * The `package.json` file to include in the memory environment. If not
   * provided, a default `package.json` file will be used.
   *
   * @see getMockPackageJson
   */
  packageJson?: Record<string, unknown>;

  /**
   * The `tsconfig.json` file to include in the memory environment. If not
   * provided, a default `tsconfig.json` file will be used.
   *
   * @see getMockTsConfig
   */
  tsconfig?: Record<string, unknown>;

  /**
   * Whether to check for diagnostics after creating the program. If there are
   * any diagnostics, an error will be thrown.
   */
  checkDiagnostic?: boolean;
};

/**
 * Get an in-memory environment for the TypeScript compiler.
 *
 * @param options - The options to use.
 * @param options.files - The files to include in the memory environment. A
 * `package.json` file and a `tsconfig.json` file will be added to the memory
 * environment automatically. If you want to include a different `package.json`
 * or `tsconfig.json` file, you can provide them using the `packageJson` and
 * `tsconfig` options.
 * @param options.packageJson - The `package.json` file to include in the memory
 * environment. If not provided, a default `package.json` file will be used.
 * @param options.tsconfig - The `tsconfig.json` file to include in the
 * memory environment. If not provided, a default `tsconfig.json` file will be
 * used.
 * @param options.checkDiagnostic - Whether to check for diagnostics after
 * creating the program. If there are any diagnostics, an error will be thrown.
 * @returns The in-memory environment.
 */
export function getVirtualEnvironment({
  files,
  packageJson = getMockPackageJson({ name: 'test-package' }),
  tsconfig = getMockTsConfig(),
  checkDiagnostic = true,
}: VirtualEnvironmentOptions) {
  const fileSystem = createDefaultMapFromNodeModules({});
  for (const [fileName, content] of Object.entries(files)) {
    fileSystem.set(fileName, content);
  }

  fileSystem.set('/package.json', JSON.stringify(packageJson));
  fileSystem.set('/tsconfig.json', JSON.stringify(tsconfig));

  // This adds `@types/*` packages from `node_modules` into the file system, but
  // these are not loaded by default.
  addNodeModulesToVirtualEnvironment(fileSystem);

  const system = createSystem(fileSystem);
  const { compilerHost: host } = createVirtualCompilerHost(
    system,
    {},
    typescript,
  );

  const program = createProgram({
    rootNames: [
      '/index.ts',
      '/node_modules/@types/node/index.d.ts',
      ...Object.keys(files).filter((file) => file.endsWith('.ts')),
    ],
    host,
    options: parseJsonConfigFileContent(tsconfig, system, '/').options,
  });

  if (checkDiagnostic) {
    const diagnostics = getPreEmitDiagnostics(program);
    if (diagnostics.length > 0) {
      throw new Error(formatDiagnosticsWithColorAndContext(diagnostics, host));
    }
  }

  const typeChecker = program.getTypeChecker();
  return { program, typeChecker, fileSystem, host, system };
}
