// We export the CommonJS shims from the index file so that they can be imported
// from the package root. This is useful for consumers who are using the package
// in an older environments that don't support the exports field in the
// `package.json`, which usually don't support ESM in the first place.
export * from './commonjs.js';
