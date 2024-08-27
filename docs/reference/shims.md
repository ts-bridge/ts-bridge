---
label: Shims
icon: code-square
---

# Shims

When shims are enabled (which is the default), TS Bridge will automatically
use it to provide shims for certain APIs that are not available in the target
environment. This is useful for using APIs specific to CommonJS environments
such as `__dirname` and `__filename`, or `import.meta.url` in ESM environments.

This means that you can use these APIs in your TypeScript code, and TS Bridge
will automatically provide the necessary shims when compiling the code. This
makes it easier to write code that works in both CommonJS and ESM environments.

> [!NOTE]
> Shims are enabled by default, but you can disable them by specifying
> `--shims false` or `--no-shims` when running the `ts-bridge` CLI.

The following shims are available:

- **For CommonJS environments**:
  - `import.meta.url`
- **For ESM environments**:
  - `__dirname`
  - `__filename`
  - `require`

## Example

The following example demonstrates how TS Bridge compiles code that uses the
`__dirname` global variable:

```typescript
import { resolve } from 'path';

function getFile(filePath: string) {
  return resolve(__dirname, filePath);
}
```

When compiled with TS Bridge, the code will work in both CommonJS and ESM
environments, as the necessary shims will be provided injected into the output
code. The ESM version of the code will look something like this:

```javascript
function $__dirname(url) {
  // Some logic to get the directory name from `import.meta.url`.
}

import { resolve } from 'path';

function getFile(filePath) {
  return resolve($__dirname(import.meta.url), filePath);
}
```

The CommonJS version of the code will not include the shims, as they are not
needed in CommonJS environments. The output will look something like this:

```javascript
const path_1 = require('path');

function getFile(filePath) {
  return path_1.resolve(__dirname, filePath);
}
```
