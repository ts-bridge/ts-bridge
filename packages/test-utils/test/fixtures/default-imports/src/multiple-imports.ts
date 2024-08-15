import foo from 'commonjs-module';
import { foo as bar } from 'commonjs-module';
import baz from 'es-module';

console.log(foo, bar, baz);
