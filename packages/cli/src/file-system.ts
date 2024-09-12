import { rmSync } from 'fs';
import { sep, resolve, normalize, relative, join } from 'path';
import type { CompilerOptions, System, WriteFileCallback } from 'typescript';
import typescript from 'typescript';

import type { BuildType } from './build-type.js';
import { getBuildTypeOptions } from './build-type.js';
import { transformFile } from './transformers.js';

const { sys } = typescript;

/**
 * Remove the directory and all of its contents. This is similar to `rm -rf`.
 *
 * @param path - The path to the directory to remove.
 * @param baseDirectory - The base directory that the path must be within.
 */
export function removeDirectory(path: string, baseDirectory: string) {
  const normalisedPath = normalize(path);
  const normalisedBaseDirectory = normalize(baseDirectory);

  // Ensure that the path is within the base directory.
  if (!normalisedPath.startsWith(`${normalisedBaseDirectory}${sep}`)) {
    throw new Error('Cannot remove directory outside of the base directory.');
  }

  rmSync(path, { recursive: true, force: true });
}

/**
 * Get the new file name with the given extension.
 *
 * @param fileName - The file name to change.
 * @param extension - The new extension for source files.
 * @param declarationExtension - The new extension for declaration files.
 * @returns The new file name.
 */
export function getNewFileName(
  fileName: string,
  extension: string,
  declarationExtension: string,
) {
  // If the file is a declaration file, we need to change the extension to the
  // new declaration extension.
  if (fileName.endsWith('.d.ts')) {
    return fileName.replace(/\.d\.ts$/u, declarationExtension);
  }

  // If the file is a declaration source map, we need to change the extension
  // and add the new extension to the source map file name.
  if (fileName.endsWith('.d.ts.map')) {
    return fileName.replace(/\.d\.ts\.map$/u, `${declarationExtension}.map`);
  }

  // We optionally capture the `.map` extension and add it back to the new file
  // name using `$1`.
  return fileName.replace(/\.js(\.map)?$/u, `${extension}$1`);
}

/**
 * Given the output file path, map it back to its source file path.
 *
 * @param outputFilePath - The path to the output file.
 * @param rootDir - The root directory where the source files are located.
 * @param outDir - The output directory where the compiled files are placed.
 * @returns The source file path corresponding to the output file.
 */
function getSourceFilePath(
  outputFilePath: string,
  rootDir: string,
  outDir: string,
): string {
  const relativePath = relative(outDir, outputFilePath);
  const sourceFilePath = join(rootDir, relativePath);
  return sourceFilePath.replace(/\.jsx?$/u, '.ts');
}

/**
 * Get a function that writes files to the file system, after transforming them.
 *
 * This function is called by the TypeScript compiler API to write transformed
 * files to the file system.
 *
 * @param type - The build type to use.
 * @param compilerOptions - The compiler options to use.
 * @param system - The system to use for file operations.
 * @param verbose - Whether to log verbose output.
 * @returns The function that writes files to the file system.
 */
export function getWriteFileFunction(
  type: BuildType,
  compilerOptions: CompilerOptions,
  system: System,
  verbose = false,
): WriteFileCallback {
  const { extension, declarationExtension } = getBuildTypeOptions(type);

  return (fileName: string, content: string, writeByteOrderMark: boolean) => {
    const fileNameWithExtension = getNewFileName(
      fileName,
      extension,
      declarationExtension,
    );

    const sourceFilePath = getSourceFilePath(
      fileName,
      compilerOptions.rootDir ?? '.',
      compilerOptions.outDir ?? './dist',
    );

    const updatedContent = transformFile(
      fileName,
      sourceFilePath,
      content,
      extension,
      declarationExtension,
      system,
      verbose,
    );

    system.writeFile(fileNameWithExtension, updatedContent, writeByteOrderMark);
  };
}

/**
 * Read a JSON file and return its content as a parsed value.
 *
 * @param path - The path to the JSON file.
 * @param system - The system to use for file operations.
 * @returns The parsed JSON content or `null` if the file could not be read or
 * parsed.
 */
export function readJsonFile(path: string, system: System) {
  if (!system.fileExists(path)) {
    return null;
  }

  try {
    const content = system.readFile(path, 'utf-8');
    if (!content) {
      return null;
    }

    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get the canonical file name for a file.
 *
 * @param fileName - The file name.
 * @param system - The system to use for file operations.
 * @returns The canonical file name.
 */
export function getCanonicalFileName(fileName: string, system = sys) {
  if (system.useCaseSensitiveFileNames) {
    return fileName;
  }

  return fileName.toLowerCase();
}

/**
 * Get the absolute path for the specified path, relative to the current working
 * directory.
 *
 * @param paths - The paths to resolve.
 * @returns The absolute path.
 */
export function getAbsolutePath(...paths: string[]): string {
  return resolve(process.cwd(), ...paths);
}
