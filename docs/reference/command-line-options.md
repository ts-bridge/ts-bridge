---
label: Command line options
icon: terminal
---

# Command line options

## `ts-bridge build`

The main (and currently only) command. It can be called without specifying it,
simply by running:

```shell
$ ts-bridge
```

Or by specifying the command explicitly:

```shell
$ ts-bridge build
```

### `--clean`

- Alias: `-c`
- Type: `boolean`

Remove the `dist` directory before building the project.

```shell
$ ts-bridge build --clean
```

> [!NOTE]
> The `dist` directory is based on the `outDir` option in the `tsconfig.json`
> file. There is no command line option to change this directory.

### `--format`

- Alias: `-f`
- Type: `string[]`

Specify the output formats to build. The available formats are `module` and
`commonjs`. By default, both formats are built.

+++ Module only

```shell
$ ts-bridge --format module
```

+++ CommonJS only

```shell
$ ts-bridge --format commonjs
```

+++ Both formats (default)

```shell
$ ts-bridge --format module,commonjs
```

+++

### `--project`

- Alias: `-p`
- Type: `string`

Specify the path to the `tsconfig.json` file to use for the build.

```shell
$ ts-bridge build --project tsconfig.build.json
```

### `--verbose`

- Alias: `-v`
- Type: `boolean`

Enable verbose logging. The tool will output more information about the build
process.

```shell
$ ts-bridge build --verbose
```
