---
label: Installation
icon: download
---

# Installation

## Requirements

- Node.js 18.18 or later.
- TypeScript 4.8 or later.

## Installing the CLI

TS Bridge is available as a CLI on the NPM registry and can be installed using
NPM or Yarn. Simply run the following command in your project directory to
install it as a development dependency, together with the TypeScript compiler:

+++ NPM

```shell
$ npm install --save-dev @ts-bridge/cli typescript
```

+++ Yarn

```shell
$ yarn add -D @ts-bridge/cli typescript
```

+++

## Installing the shims package (optional)

If you want to use the shims provided by TS Bridge, you can install the
`@ts-bridge/shims` package as well. Make sure to install it as a **regular
dependency**:

+++ NPM

```shell
$ npm install --save @ts-bridge/shims
```

+++ Yarn

```shell
$ yarn add @ts-bridge/shims
```

+++

The shims will automatically be enabled when the package is installed.
