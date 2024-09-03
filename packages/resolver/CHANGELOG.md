# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2]

### Fixed

- Resolve `index.js` file in `main` if `main` is a folder ([#48](https://github.com/ts-bridge/ts-bridge/pull/48))

## [0.1.1]

### Fixed

- Remove `require` from default exports conditions ([#41](https://github.com/ts-bridge/ts-bridge/pull/41))
  - Node.js does not use the `require` field when resolving CommonJS modules.

## [0.1.0]

### Added

- Initial release of the `@ts-bridge/resolver` package ([#20](https://github.com/ts-bridge/ts-bridge/pull/20), [#24](https://github.com/ts-bridge/ts-bridge/pull/24))

[Unreleased]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/resolver@0.1.2...HEAD
[0.1.2]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/resolver@0.1.1...@ts-bridge/resolver@0.1.2
[0.1.1]: https://github.com/ts-bridge/ts-bridge/compare/@ts-bridge/resolver@0.1.0...@ts-bridge/resolver@0.1.1
[0.1.0]: https://github.com/ts-bridge/ts-bridge/releases/tag/@ts-bridge/resolver@0.1.0
