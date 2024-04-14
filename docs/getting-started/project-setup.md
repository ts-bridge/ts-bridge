---
label: Project setup
icon: file
---

# Project setup

TS Bridge assumes your project is already set up to use TypeScript. This means
you should have a `tsconfig.json` file in the root of your project, which
includes and excludes the files you want to compile. You may specify a different
configuration file using the `--project` option. Refer to the
[Usage](./usage.md) section for more information.

## `package.json` exports

When using TS Bridge, you can take advantage of the `exports` field in your
`package.json` file to specify the entry points for your package. It generates
a separate entry point for ES modules and CommonJS modules, as well as type
definitions for both.

Assuming you have a `index.ts` file in the root of your project, TS Bridge will
generate the following files:

```
dist/
├─ index.cjs
├─ index.cjs.map
├─ index.d.cts
├─ index.d.cts.map
├─ index.d.mts
├─ index.d.mts.map
├─ index.mjs
├─ index.mjs.map
├─ ...
```

For example, you can specify the following `exports` field in your
`package.json` file:

```json
{
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  }
}
```

> [!IMPORTANT]
> Make sure to specify `types` before `default` in the `exports` field, to
> ensure that the type definitions are loaded correctly by consumers of your
> package.

For consumers that don't support the `exports` field, you can use the `main`
field to specify the CommonJS entry point and the `module` field to specify the
ES module entry point.

```json
{
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs"
}
```
