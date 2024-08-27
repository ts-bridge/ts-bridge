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

### `--references`

- Alias: `--build`
- Type: `boolean`

Whether to build project references. By default, project references are built if
they are detected in the `tsconfig.json` file.

```shell
$ ts-bridge build --references
```

### `--shims`

- Type: `boolean`
- Default: `true`

Enable or disable shims for CommonJS and ESM environments. Shims are enabled by
default. To disable them, specify `--shims false`, or `--no-shims`.

```shell
$ ts-bridge build --shims false
```

```shell
$ ts-bridge build --no-shims
```

### `--verbose`

- Alias: `-v`
- Type: `boolean`

Enable verbose logging. The tool will output more information about the build
process.

```shell
$ ts-bridge build --verbose
```
