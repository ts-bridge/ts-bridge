import { createRequire } from 'module';
import { dirname, join } from 'path';
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { createContext, Script, SyntheticModule, SourceTextModule } from 'vm';

/**
 * Get the main file from the file system.
 *
 * @param fileSystem - The (virtual) file system to use.
 * @returns The main file.
 */
function getMainFile(fileSystem: Map<string, string>) {
  if (fileSystem.has('/index.mjs')) {
    return '/index.mjs';
  }

  if (fileSystem.has('/index.cjs')) {
    return '/index.cjs';
  }

  throw new Error('No main file found.');
}

/**
 * Get a synthetic module for the given imported module.
 *
 * @param importedModule - The imported module.
 * @returns The synthetic module.
 */
function getSyntheticModule(importedModule: Record<string, unknown>) {
  const exportNames = Object.keys(importedModule);

  return new SyntheticModule(exportNames, function () {
    exportNames.forEach((key) => {
      this.setExport(key, importedModule[key]);
    });
  });
}

/**
 * Resolve the specifier from the virtual file system.
 *
 * @param fileSystem - The (virtual) file system to use.
 * @param specifier - The specifier to resolve.
 * @param referencingModule - The referencing module.
 * @returns The resolved specifier, or null if it could not be resolved.
 */
export function resolveFromVirtualFileSystem(
  fileSystem: Map<string, string>,
  specifier: string,
  referencingModule: SourceTextModule,
) {
  const fileName = join(dirname(referencingModule.identifier), specifier);
  if (fileSystem.has(fileName)) {
    return fileSystem.get(fileName);
  }

  if (fileSystem.has(`/node_modules/${specifier}/index.js`)) {
    return fileSystem.get(`/node_modules/${specifier}/index.js`);
  }

  if (fileSystem.has(`/node_modules/${specifier}/index.cjs`)) {
    return fileSystem.get(`/node_modules/${specifier}/index.cjs`);
  }

  return null;
}

/**
 * Get the `initializeImportMeta` function for the given file name.
 *
 * @param fileName - The file name to use.
 * @returns The `initializeImportMeta` function.
 */
function getInitializeImportMeta(fileName: string) {
  return (meta: ImportMeta) => {
    meta.url = `file://${fileName}`;
  };
}

/**
 * Get a module linker for the given file system.
 *
 * @param fileSystem - The (virtual) file system to use.
 * @returns The module linker.
 */
function getModuleLinker(fileSystem: Map<string, string>) {
  return async (specifier: string, referencingModule: SourceTextModule) => {
    const fileName = join(dirname(referencingModule.identifier), specifier);
    const file = resolveFromVirtualFileSystem(
      fileSystem,
      specifier,
      referencingModule,
    );

    if (file) {
      return new SourceTextModule(file, {
        identifier: fileName,
        initializeImportMeta: getInitializeImportMeta(fileName),
      });
    }

    const importedModule = await import(specifier);
    return getSyntheticModule(importedModule);
  };
}

/**
 * Get a require function for the given file system.
 *
 * @param mainFile - The main file to use.
 * @param fileSystem - The (virtual) file system to use.
 * @returns The require function.
 */
function getRequireFunction(mainFile: string, fileSystem: Map<string, string>) {
  const require = createRequire(import.meta.url);

  return (specifier: string) => {
    const fileName = join(dirname(mainFile), specifier);
    const file = fileSystem.get(fileName);

    if (file) {
      return evaluateCommonJS(fileName, file, fileSystem);
    }

    // eslint-disable-next-line import-x/no-dynamic-require
    return require(specifier);
  };
}

/**
 * Evaluate the ES module code.
 *
 * @param code - The code to evaluate.
 * @param fileSystem - The (virtual) file system to use.
 * @returns The namespace of the evaluated code (i.e., the exports).
 */
export async function evaluateModule<Type>(
  code: string,
  fileSystem: Map<string, string> = new Map(),
): Promise<Type> {
  const module = new SourceTextModule(code, {
    identifier: '/index.mjs',
    initializeImportMeta: getInitializeImportMeta('/index.mjs'),
  });

  await module.link(getModuleLinker(fileSystem));
  await module.evaluate();

  return module.namespace as Type;
}

/**
 * Evaluate the CommonJS code.
 *
 * @param mainFile - The main file to use.
 * @param code - The code to evaluate.
 * @param fileSystem - The (virtual) file system to use.
 * @returns The namespace of the evaluated code (i.e., the exports).
 */
export function evaluateCommonJS(
  mainFile: string,
  code: string,
  fileSystem: Map<string, string>,
) {
  const context = createContext({
    require: getRequireFunction(mainFile, fileSystem),
    exports: {},
    /* eslint-disable @typescript-eslint/naming-convention */
    __dirname: dirname(mainFile),
    __filename: mainFile,
    URL,
    /* eslint-enable @typescript-eslint/naming-convention */
  });

  const script = new Script(code);

  script.runInNewContext(context);
  return context.exports;
}

/**
 * Evaluate the code with the given file system. This uses Node.js's VM module
 * to compile and evaluate the code. It handles both ES modules and CommonJS
 * modules, and has some simple glue code to support imports from both the
 * virtual file system and the real file system.
 *
 * If a file is not found in the virtual file system, it will attempt to import
 * the module using Node.js's module resolution algorithm.
 *
 * This is used to ensure that the generated code works as expected with
 * Node.js, as TypeScript does not do any checks on transformed code.
 *
 * @param code - The code to evaluate.
 * @param fileSystem - The (virtual) file system to use.
 * @returns The namespace of the evaluated code (i.e., the exports).
 */
export async function evaluate(code: string, fileSystem: Map<string, string>) {
  const fileName = getMainFile(fileSystem);
  const extension = fileName.endsWith('.mjs') ? 'mjs' : 'cjs';

  if (extension === 'mjs') {
    return evaluateModule(code, fileSystem);
  }

  return evaluateCommonJS(fileName, code, fileSystem);
}
