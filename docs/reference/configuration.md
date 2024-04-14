---
label: Configuration
icon: gear
order: 100
---

# Configuration

TS Bridge does not have a configuration file of its own. Instead, it uses the
`tsconfig.json` file in your project directory to determine how to compile your
TypeScript code. This means that you can use all the features of the TypeScript
compiler in your project, such as specifying compiler options, including files
and directories, configuring the target, and more.

For more information on how to configure the TypeScript compiler, refer to the
[TypeScript documentation](https://www.typescriptlang.org/tsconfig).

## Recommended configuration

### `Node16` module resolution

While TS Bridge supports `Node10` (the default) module resolution strategies,
it is recommended to use the `Node16` module resolution strategy for much
improved build performance. To do this, set the `moduleResolution` option in
your `tsconfig.json` file to `Node16`:

```json
{
  "compilerOptions": {
    "module": "Node16",
    "moduleResolution": "Node16"
  }
}
```

This is because TypeScript does not support changing the output module format
dynamically when using the `Node10` module resolution strategy, meaning that the
project needs to be initialised (and type checked) once for each module format.
This adds significant overhead to the build process, especially for large
projects.

When using `Node16` module resolution, TS Bridge can take advantage of the
TypeScript compiler's ability to change the output module format dynamically,
resulting in much faster builds for large projects.

## Caveats

There are a few caveats to keep in mind when using TS Bridge with your
TypeScript project:

- **No support for project references**: TS Bridge does not support TypeScript
  project references. Though support for project references is planned for a
  future release, it is not currently available.
- **No incremental compilation**: TS Bridge does not support incremental
  compilation. This means that TS Bridge will always compile all files in your
  project, even if they have not changed since the last build.
- **Some compiler options cannot be changed**: Some compiler options cannot be
  changed when using TS Bridge. For example, the `noEmit` option is always set
  to `false`, and the `incremental` option is always set to `false`, regardless
  of the values specified in the `tsconfig.json` file. TS Bridge will show a
  warning if you try to change one of these options.
