---
label: Usage
icon: codespaces
---

# Usage

After [installing TS Bridge](../getting-started/installation), you can use it to
build your TypeScript project. TS Bridge works as a drop-in replacement for the
TypeScript compiler, so you can use it in the same way you would use `tsc`:
Simply run the `tsbridge` command in your project directory to compile your
TypeScript files:

```shell
$ ts-bridge
```

## Using a different `tsconfig.json` file

By default, TS Bridge looks for a `tsconfig.json` file in the root of your
project. If you want to use a different configuration file, you can specify it
using the `--project` option:

```shell
$ ts-bridge --project tsconfig.build.json
```

For other options, refer to the
[Command line options](../reference/command-line-options).
