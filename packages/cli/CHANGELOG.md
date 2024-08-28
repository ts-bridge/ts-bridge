# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0]

### Uncategorized

- Add tests for shims and helper functions ([#37](https://github.com/ts-bridge/ts-bridge/pull/37))
- Update documentation about shims ([#36](https://github.com/ts-bridge/ts-bridge/pull/36))
- Transform default CommonJS imports ([#19](https://github.com/ts-bridge/ts-bridge/pull/19))
- Inline shims instead of importing from `@ts-bridge/shims` ([#35](https://github.com/ts-bridge/ts-bridge/pull/35))
- Detect CommonJS exports using `cjs-module-lexer` ([#34](https://github.com/ts-bridge/ts-bridge/pull/34))

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

[Unreleased]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.4.0...HEAD
[0.4.0]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.3.0...@ts-bridge/cli@0.4.0
[0.3.0]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.2.0...@ts-bridge/cli@0.3.0
[0.2.0]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.4...@ts-bridge/cli@0.2.0
[0.1.4]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.3...@ts-bridge/cli@0.1.4
[0.1.3]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.2...@ts-bridge/cli@0.1.3
[0.1.2]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.1...@ts-bridge/cli@0.1.2
[0.1.1]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.0...@ts-bridge/cli@0.1.1
[0.1.0]: https://github.com/ts-bridge/ts-bridge/releases/tag/@ts-bridge/cli@0.1.0
