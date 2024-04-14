---
label: Features
icon: tasklist
order: 2
---

# Features

There are many great build tools and bundlers out there, such as Webpack,
Esbuild, and Vite, which have been around for a while and have a large
community. However, they are not perfect for every use case. For example, if
you are working on a library that needs to be used in different environments,
like ES modules and CommonJS, configuration using these tools can be a bit
tricky.

TS Bridge is a build tool that is designed to be simple and easy to use. It
essentially works as a drop-in replacement for the TypeScript compiler, but
with some additional features that make it easier to build libraries that need
to be used in different environments.

Here are some of the key features of TS Bridge:

- **Zero configuration**: TS Bridge works out of the box with no configuration
  needed. You can start using it right away without having to set up a complex
  build configuration.
- **Support for multiple output formats**: TS Bridge can output your code in
  different formats, such as ES modules and CommonJS, without any additional
  configuration.
- **TypeScript compatibility**: TS Bridge is fully compatible with TypeScript
  and can be used as a drop-in replacement for the TypeScript compiler.
- **Built-in type checking**: TS Bridge performs type checking as part of the
  build process, so you can catch type errors early and avoid runtime errors.
- **Shims for CommonJS and ES module features**: TS Bridge provides shims for
  features that are specific to CommonJS or ES module environments, such as
  `import.meta.url` so you can use modern JavaScript features without worrying
  about compatibility. See the [shims](./reference/shims) documentation for more
  information.

## Hybrid builds

One of the key features of TS Bridge is its support for building libraries that
need to be used in different environments. For example, if you are building a
library that needs to be used in both Node.js and the browser, you may want to
output your code in both CommonJS and ES module formats.

By default, TS Bridge will output your code in both formats, so you can use it
in different environments without any additional configuration. For example, if
your project has the following directory structure:

```
src/
  index.ts
```

And you run the CLI command:

```sh
tsbridge
```

TS Bridge will output the following files:

```
dist/
  index.cjs
  index.d.cts
  index.d.mts
  index.mjs
```

The `index.cjs` file contains the CommonJS version of your code, which can be
used in Node.js or older environments that do not support ES modules. The
`index.mjs` file contains the ES module version of your code, which can be used
in modern browsers or environments that support ES modules. The `.mjs` and
`.cjs` extensions guarantee that Node.js and other tools are able to resolve the
correct file.

The `.d.cts` and `.d.mts` files contain the declaration files for the CommonJS
and ES module versions of your code, respectively. These files are used by
TypeScript to provide type information for your library.

## Limitations

That being said, TS Bridge is not a replacement for more advanced build tools
like Webpack, Esbuild, or Vite. If you need more advanced features like code
splitting, tree shaking, or hot module replacement, you may want to consider
using one of these tools instead. It's also not intended to be faster or more
efficient than other build tools. It's not written in a low-level language like
Rust or Go, and uses the slow TypeScript compiler under the hood. In fact, TS
Bridge may be slower than `tsc`, as it performs additional checks and
transformations during the build process.

TS Bridge is designed for libraries, not applications. If you are building a
web application, you may want to use a more advanced build tool that is
optimized for that use case.
