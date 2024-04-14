/**
 * Get the URL of the current module, i.e., `import.meta.url`, but for CommonJS.
 *
 * If the current environment is a browser, it will return the URL of the
 * current script (if it's available). Otherwise, it will return the URL of the
 * current file.
 *
 * @param fileName - The name of the current file.
 * @returns The URL of the current module.
 */
export function getImportMetaUrl(fileName: string): string {
  return typeof document === 'undefined'
    ? new URL(`file:${fileName}`).href
    : // @ts-expect-error - Property `src` does not exist on type `HTMLOrSVGScriptElement`.
      document.currentScript?.src ?? new URL('main.js', document.baseURI).href;
}
