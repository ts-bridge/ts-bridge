# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.4]

### Uncategorized

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

[Unreleased]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.4...HEAD
[0.1.4]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.3...@ts-bridge/cli@0.1.4
[0.1.3]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.2...@ts-bridge/cli@0.1.3
[0.1.2]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.1...@ts-bridge/cli@0.1.2
[0.1.1]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/cli@0.1.0...@ts-bridge/cli@0.1.1
[0.1.0]: https://github.com/ts-bridge/ts-bridge/releases/tag/@ts-bridge/cli@0.1.0
