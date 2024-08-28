import $foo, { bar } from 'commonjs-module';

/**
 * Default import helper.
 *
 * @param module - Module with default export.
 * @returns Default export.
 */
function $importDefault(module: any): any {
  if (module?.__esModule) {
    return module.default;
  }
  return module;
}

const foo = $importDefault($foo);
console.log(foo, bar);
