import type { foo } from 'commonjs-module';
import { type foo as bar } from 'commonjs-module';

export type Foo = typeof foo;
export type Bar = typeof bar;
