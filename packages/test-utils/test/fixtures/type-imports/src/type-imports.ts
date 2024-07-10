import type { foo } from './dummy';

export type { foo } from './dummy';
export type Foo = typeof foo;
