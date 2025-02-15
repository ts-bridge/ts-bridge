# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.3]

### Fixed

- Keep default imports when removing type imports ([#78](https://github.com/ts-bridge/ts-bridge/pull/78))
  - This fixes a bug where default imports would sometimes be removed when
    removing type imports.
- Remove implicit type imports and exports from output ([#77](https://github.com/ts-bridge/ts-bridge/pull/77))
  - Previously only explicit type imports and exports (`import type ...;`) were
    removed from the output, but now implicit type imports and exports are
    detected and removed as well.

## [0.6.2]

### Fixed

- Handle export detection errors ([#73](https://github.com/ts-bridge/ts-bridge/pull/73))

## [0.6.1]

### Fixed

- Properly handle re-exports when detecting CJS exports ([#69](https://github.com/ts-bridge/ts-bridge/pull/69))

## [0.6.0]

### Changed

- **BREAKING:** Add support for Node.js 22 and drop support for Node.js 21 ([#57](https://github.com/ts-bridge/ts-bridge/pull/57))
- Build project references in parallel ([#56](https://github.com/ts-bridge/ts-bridge/pull/56))
  - This change can significantly reduce the build time of projects with many
    references.

## [0.5.1]

### Fixed

- Transform dynamic imports ([#53](https://github.com/ts-bridge/ts-bridge/pull/53))
  - This fixes a bug where dynamic imports were not transformed correctly,
    resulting in unresolved imports in some cases.

## [0.5.0]

### Added

- Add shim for `require.resolve` ([#51](https://github.com/ts-bridge/ts-bridge/pull/51))
  - This will replace `require.resolve` calls with an ESM-compatible version
    when targeting ESM.

### Fixed

- Fix detection of global symbols ([#50](https://github.com/ts-bridge/ts-bridge/pull/50))

## [0.4.4]

### Fixed

- Resolve `index.js` file in `main` if `main` is a folder ([#48](https://github.com/ts-bridge/ts-bridge/pull/48))
  - Accomplished by bumping `@ts-bridge/resolver` to `0.1.2`.

## [0.4.3]

### Fixed

- Clean dist folders of referenced projects if `clean` is enabled ([#46](https://github.com/ts-bridge/ts-bridge/pull/46))
- Forward verbose option to build function when building for Node 16 ([#45](https://github.com/ts-bridge/ts-bridge/pull/45))

## [0.4.2]

### Fixed

- Fix building subset of project references ([#43](https://github.com/ts-bridge/ts-bridge/pull/43))

## [0.4.1]

### Fixed

- Re-use existing default import for importing undetected named imports ([#40](https://github.com/ts-bridge/ts-bridge/pull/40))
  - This fixes a bug where the default import was not properly replaced,
    resulting in undefined variables.

## [0.4.0]

### Added

- Add transform for default CommonJS imports when targeting ESM ([#19](https://github.com/ts-bridge/ts-bridge/pull/19), [#37](https://github.com/ts-bridge/ts-bridge/pull/37))
  - Default CommonJS imports are transformed to use a helper function which
    checks if the module has a `__esModule` property, and returns the default
    export if it does.

### Changed

- Inline shims instead of importing from `@ts-bridge/shims` ([#35](https://github.com/ts-bridge/ts-bridge/pull/35), [#36](https://github.com/ts-bridge/ts-bridge/pull/36), [#37](https://github.com/ts-bridge/ts-bridge/pull/37))
  - `@ts-bridge/shims` is now deprecated and no longer used by the tool.
  - This reduces the number of dependencies and makes the tool more
    self-contained.
- Only transform undetected named CommonJS imports ([#34](https://github.com/ts-bridge/ts-bridge/pull/34))
  - Named CommonJS imports are only transformed if they are not detected as
    exports.
    - This uses `cjs-module-lexer` to detect named exports, which is used by
      Node.js and other tools to detect named exports as well.

## [0.3.0]

### Added

- Add experimental support for project references ([#30](https://github.com/ts-bridge/ts-bridge/pull/30), [#32](https://github.com/ts-bridge/ts-bridge/pull/32))
  - If the specified `tsconfig.json` contains a `references` field, all
    referenced projects will be sorted based on their dependencies, and built.

## [0.2.0]

### Added

- Add import attribute to JSON imports ([#26](https://github.com/ts-bridge/ts-bridge/pull/26))
  - This fixes compatibility with Node.js, Rollup, and other tools that do not
    support JSON imports without a `with { type: 'json' }` attribute.

### Changed

- Implement `@ts-bridge/resolver` ([#24](https://github.com/ts-bridge/ts-bridge/pull/24))
  - `@ts-bridge/resolver` implements the Node.js module resolution algorithm and
    is now used instead of the custom resolver implementation.
  - This resolves some edge cases and makes the tool more compatible with
    Node.js and other tools.

## [0.1.4]

### Fixed

- Check parent paths for `package.json` file when checking if a module is ESM ([#16](https://github.com/ts-bridge/ts-bridge/pull/16))

## [0.1.3]

### Fixed

- Fix "ENOENT: no such file or directory, mkdir '...'" error when using nested folders ([#14](https://github.com/ts-bridge/ts-bridge/pull/14))

## [0.1.2]

### Changed

- Bump minimum TypeScript version to 4.8 ([#12](https://github.com/ts-bridge/ts-bridge/pull/12))
  - The tool was already incompatible with TypeScript versions older than 4.8,
    but this change makes the minimum version explicit.

### Fixed

- Add transformer to remove type imports and exports ([#10](https://github.com/ts-bridge/ts-bridge/pull/10))
  - This fixes compatibility with TypeScript 4.8 and later in certain cases.

## [0.1.1]

### Added

- Add MIT license ([#2](https://github.com/ts-bridge/ts-bridge/pull/2))
  - The package was already licensed under the MIT license, but the license file
    was missing.

### Fixed

- Fix compatibility with TypeScript 4.x ([#6](https://github.com/ts-bridge/ts-bridge/pull/6))

## [0.1.0]

### Added

- Initial release of the `@ts-bridge/cli` package.

[Unreleased]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.6.3...HEAD
[0.6.3]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.6.2...@ts-bridge/cli@0.6.3
[0.6.2]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.6.1...@ts-bridge/cli@0.6.2
[0.6.1]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.6.0...@ts-bridge/cli@0.6.1
[0.6.0]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.5.1...@ts-bridge/cli@0.6.0
[0.5.1]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.5.0...@ts-bridge/cli@0.5.1
[0.5.0]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.4.4...@ts-bridge/cli@0.5.0
[0.4.4]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.4.3...@ts-bridge/cli@0.4.4
[0.4.3]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.4.2...@ts-bridge/cli@0.4.3
[0.4.2]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.4.1...@ts-bridge/cli@0.4.2
[0.4.1]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.4.0...@ts-bridge/cli@0.4.1
[0.4.0]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.3.0...@ts-bridge/cli@0.4.0
[0.3.0]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.2.0...@ts-bridge/cli@0.3.0
[0.2.0]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.4...@ts-bridge/cli@0.2.0
[0.1.4]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.3...@ts-bridge/cli@0.1.4
[0.1.3]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.2...@ts-bridge/cli@0.1.3
[0.1.2]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.1...@ts-bridge/cli@0.1.2
[0.1.1]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.0...@ts-bridge/cli@0.1.1
[0.1.0]: https://github.com/ts-bridge/ts-bridge/releases/tag/@ts-bridge/cli@0.1.0
