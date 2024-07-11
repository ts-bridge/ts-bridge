// @ts-expect-error - `require` is an existing global.
const require = (_module: string) => undefined;

require('module');
