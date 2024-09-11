export const foo = 42;

export type Value = {
  value: number;
};

export class Foo {
  getValue(): Value {
    return {
      value: 0,
    };
  }
}
