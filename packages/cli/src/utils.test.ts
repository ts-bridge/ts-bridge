import { createDeferredPromise } from '@metamask/utils';
import { delay } from '@ts-bridge/test-utils';
import { describe, expect, it } from 'vitest';

import type { DependencyGraph } from './project-references.js';
import { topologicalSort } from './project-references.js';
import {
  isObject,
  getIdentifierName,
  getDefinedArray,
  parallelise,
} from './utils.js';

describe('isObject', () => {
  it('returns `true` if the value is an object', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ key: 'value' })).toBe(true);
  });

  it('returns `false` if the value is not an object', () => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject('string')).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject(Symbol('symbol'))).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject(() => undefined)).toBe(false);
  });
});

describe('getIdentifierName', () => {
  it.each([
    {
      value: 'foo-bar',
      expected: 'foobar',
    },
    {
      value: 'foo bar',
      expected: 'foobar',
    },
    {
      value: 'foo_bar',
      expected: 'foo_bar',
    },
    {
      value: '42foo',
      expected: 'foo',
    },
    {
      value: 'foo42',
      expected: 'foo',
    },
    {
      value: 'foo',
      expected: 'foo',
    },
    {
      value: '',
      expected: '_',
    },
  ])('converts "$value" to "$expected"', ({ value, expected }) => {
    expect(getIdentifierName(value)).toBe(expected);
  });
});

describe('getDefinedArray', () => {
  it('returns the array if it is defined', () => {
    expect(getDefinedArray([1, 2, 3])).toStrictEqual([1, 2, 3]);
  });

  it('removes undefined values from the array', () => {
    expect(getDefinedArray([1, undefined, 2, undefined, 3])).toStrictEqual([
      1, 2, 3,
    ]);
  });

  it('returns an empty array if the array is undefined', () => {
    expect(getDefinedArray(undefined)).toStrictEqual([]);
  });
});

describe('parallelise', () => {
  it('runs a function in parallel for a dependency graph', async () => {
    const graph: DependencyGraph<string> = new Map([
      ['a', ['b', 'c']],
      ['b', ['d', 'e']],
      ['c', ['e']],
      ['d', ['e']],
      ['e', []],
    ]);

    const { promise: promiseA, resolve: resolveA } = createDeferredPromise();
    const { promise: promiseB, resolve: resolveB } = createDeferredPromise();
    const { promise: promiseC, resolve: resolveC } = createDeferredPromise();
    const { promise: promiseD, resolve: resolveD } = createDeferredPromise();
    const { promise: promiseE, resolve: resolveE } = createDeferredPromise();

    const set = new Set<string>();

    const sorted = topologicalSort(graph).stack;
    const parallelPromise = parallelise(sorted, graph, async (key) => {
      set.add(key);
      switch (key) {
        case 'a':
          await promiseA;
          break;
        case 'b':
          await promiseB;
          break;
        case 'c':
          await promiseC;
          break;
        case 'd':
          await promiseD;
          break;
        case 'e':
          await promiseE;
          break;
        default:
          throw new Error(`Unknown key: "${key}".`);
      }
    });

    // `e` is the only node without dependencies, so it should be resolve
    // first.
    expect(set.has('e')).toBe(true);
    expect(set.has('d')).toBe(false);
    expect(set.has('c')).toBe(false);

    resolveE();
    await delay(1);

    // `d` and `c` are the next nodes in the graph, so they should be resolved
    // next.
    expect(set.has('d')).toBe(true);
    expect(set.has('c')).toBe(true);

    resolveD();
    await delay(1);

    // `b` depends on `d` and `e`, so it should be resolved once they are.
    expect(set.has('b')).toBe(true);
    expect(set.has('a')).toBe(false);

    resolveC();
    resolveB();
    await delay(1);

    // `a` depends on `b` and `c`, so it should be resolved once they are.
    expect(set.has('a')).toBe(true);

    resolveA();
    await parallelPromise;
  });

  it('limits the tasks to the concurrency limit', async () => {
    const graph: DependencyGraph<string> = new Map([
      ['a', []],
      ['b', []],
      ['c', []],
    ]);

    const { promise: promiseA, resolve: resolveA } = createDeferredPromise();
    const { promise: promiseB, resolve: resolveB } = createDeferredPromise();
    const { promise: promiseC, resolve: resolveC } = createDeferredPromise();

    const set = new Set<string>();

    const sorted = topologicalSort(graph).stack;
    const parallelPromise = parallelise(
      sorted,
      graph,
      async (key) => {
        set.add(key);
        switch (key) {
          case 'a':
            await promiseA;
            break;
          case 'b':
            await promiseB;
            break;
          case 'c':
            await promiseC;
            break;
          default:
            throw new Error(`Unknown key: "${key}".`);
        }
      },
      1,
    );

    // `a` is the first node in the graph, so it should be resolved first.
    expect(set.has('a')).toBe(true);
    expect(set.has('b')).toBe(false);
    expect(set.has('c')).toBe(false);

    resolveA();
    await delay(1);

    // `b` is the next node in the graph, so it should be resolved next.
    expect(set.has('b')).toBe(true);
    expect(set.has('c')).toBe(false);

    resolveB();
    await delay(1);

    // `c` is the last node in the graph, so it should be resolved last.
    expect(set.has('c')).toBe(true);

    resolveC();

    await parallelPromise;
  });

  it('assumes no dependencies if a value is not in the graph', async () => {
    const graph: DependencyGraph<string> = new Map([
      ['a', ['b', 'c']],
      ['b', ['d', 'e']],
      ['c', ['e']],
      ['d', ['e']],
    ]);

    const { promise: promiseA, resolve: resolveA } = createDeferredPromise();
    const { promise: promiseB, resolve: resolveB } = createDeferredPromise();
    const { promise: promiseC, resolve: resolveC } = createDeferredPromise();
    const { promise: promiseD, resolve: resolveD } = createDeferredPromise();
    const { promise: promiseE, resolve: resolveE } = createDeferredPromise();

    const set = new Set<string>();

    const sorted = topologicalSort(graph).stack;
    const parallelPromise = parallelise(sorted, graph, async (key) => {
      set.add(key);
      switch (key) {
        case 'a':
          await promiseA;
          break;
        case 'b':
          await promiseB;
          break;
        case 'c':
          await promiseC;
          break;
        case 'd':
          await promiseD;
          break;
        case 'e':
          await promiseE;
          break;
        default:
          throw new Error(`Unknown key: "${key}".`);
      }
    });

    // `e` is the only node without dependencies, so it should be resolve
    // first.
    expect(set.has('e')).toBe(true);
    expect(set.has('d')).toBe(false);
    expect(set.has('c')).toBe(false);

    resolveE();
    await delay(1);

    // `d` and `c` are the next nodes in the graph, so they should be resolved
    // next.
    expect(set.has('d')).toBe(true);
    expect(set.has('c')).toBe(true);

    resolveD();
    await delay(1);

    // `b` depends on `d` and `e`, so it should be resolved once they are.
    expect(set.has('b')).toBe(true);
    expect(set.has('a')).toBe(false);

    resolveC();
    resolveB();
    await delay(1);

    // `a` depends on `b` and `c`, so it should be resolved once they are.
    expect(set.has('a')).toBe(true);

    resolveA();
    await parallelPromise;
  });
});
