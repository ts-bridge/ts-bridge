---
label: Project references
icon: git-compare
order: 100
---

When working in a monorepo or a project with multiple packages, you may want to
use TypeScript's project references to manage dependencies between projects. TS
Bridge has experimental support for project references, allowing you to build
your TypeScript projects with ease.

> [!CAUTION]
> Support for project references in TS Bridge is experimental and may not work
> correctly in all cases. If you encounter any issues, please
> [open an issue](https://github.com/ts-bridge/ts-bridge/issues/new/choose) on
> GitHub.

## Setting up project references

To use project references with TS Bridge, you need to set up your
`tsconfig.json` files correctly. Here's an example of how you can set up project
references in a monorepo with two packages, `package-a` and `package-b`:

1. Create a `tsconfig.json` file in the root of your monorepo with the following
   contents:

   ```json
   {
     "files": [],
     "references": [
       { "path": "./packages/package-a" },
       { "path": "./packages/package-b" }
     ]
   }
   ```

2. Create a `tsconfig.json` file in each package directory with the following
   contents:

   `packages/package-a/tsconfig.json`:

   ```json5
   {
     compilerOptions: {
       composite: true,
       // Other compiler options
     },
     references: [],
   }
   ```

   `packages/package-b/tsconfig.json`:

   ```json5
   {
     compilerOptions: {
       composite: true,
       // Other compiler options
     },
     references: [{ path: '../package-a' }],
   }
   ```

3. Run the following command in the root of your monorepo to build the projects:

   ```shell
   $ ts-bridge
   ```

TS Bridge detects if your project uses project references and builds the
projects in the correct order, ensuring that dependencies are resolved
correctly. If for any reason you want to disable project references, you can do
so by using `--references false`:

```shell
$ ts-bridge --references false
```
