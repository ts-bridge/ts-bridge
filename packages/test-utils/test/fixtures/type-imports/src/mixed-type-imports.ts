import { type foo, bar } from './dummy';

export { type foo, bar } from './dummy';

export type Foo = typeof foo;
console.log(bar);
