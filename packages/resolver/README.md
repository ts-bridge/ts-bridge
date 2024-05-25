# `@ts-bridge/resolver`

An implementation of the Node.js module resolution algorithm as defined in the
specification [here](https://nodejs.org/api/esm.html#resolution-algorithm).

## Why?

There are several tools out there for resolving modules, such as
[`enhanced-resolve`](https://github.com/webpack/enhanced-resolve), or
[`import-meta-resolve`](https://github.com/wooorm/import-meta-resolve), or even
Node.js' own `require.resolve` or `import.meta.resolve` functions. Unfortunately
we cannot use these in TS Bridge, since the resolution logic has some specific
requirements:

- TS Bridge needs to know the format of a resolved module, i.e., whether it is
  a CommonJS module, ES module, or something else.
  - This is not trivial as Node.js has a lot of edge cases when determining the
    format. Take a look at the `ESM_FILE_FORMAT` function in the
    [specification](https://nodejs.org/api/esm.html#resolution-algorithm) if
    you're curious.
- TypeScript's compiler API is completely synchronous, so the module resolution
  needs to be synchronous as well.

To ensure correct behaviour, the best solution seemed to reimplement the
algorithm as used by Node.js.

## Usage

> [!NOTE]
> Usage outside of TS Bridge is possible, but not recommended. Consider using
> a library like
> [`enhanced-resolve`](https://github.com/webpack/enhanced-resolve) or
> [`import-meta-resolve`](https://github.com/wooorm/import-meta-resolve)
> instead.

> [!NOTE]
> This is an ESM-only module. It cannot be used from CommonJS.

### `resolve`

This library exports a single function, `resolve`, which can be used to resolve
a package specifier to its path and format (e.g., `module`, `commonjs`).

It takes the following arguments:

| Name                 | Type                  | Optional | Description                                                                                                                                      |
| :------------------- | :-------------------- | :------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **packageSpecifier** | `string`              | No       | The specifier to resolve, e.g., `@ts-bridge/resolver`, or `some-module/sub-path`.                                                                |
| **parentUrl**        | `string \| URL`       | No       | The URL to start resolving from. This can be an (absolute) path, or instance of `URL`.                                                           |
| **fileSystem**       | `FileSystemInterface` | Yes      | The file system to use for the resolution. This is mainly used for testing purposes, but can be used to use the resolver on custom file systems. |

#### Example

```ts
import { resolve } from '@ts-bridge/resolver';

const { path, format } = resolve('some-es-module/sub-path', import.meta.url);
console.log(path); // "/path/to/node_modules/some-es-module/dist/sub-path.mjs"
console.log(format); // "module"
```
