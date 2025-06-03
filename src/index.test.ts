import { it, expect } from 'vitest'

import * as b from './index.js'

export const test = b.struct({
  uint8: b.uint8(),
  uint16: b.uint16(),
  uint32: b.uint32(),
  int8: b.int8(),
  int16: b.int16(),
  int32: b.int32(),
  float32: b.float32(),
  float64: b.float64(),
  bigInt64: b.bigInt64(),
  bigUint64: b.bigUint64(),
  bigInt64Num: b.bigInt64({ cast: 'number' }),
  bigUint64Num: b.bigUint64({ cast: 'number' }),

  utf8: b.utf8(),
  utf8Fixed: b.utf8({ fixed: 3 }),
  optional1: b.optional(b.utf8()),
  optional2: b.optional(b.utf8()),

  nullable1: b.nullable(b.utf8()),
  nullable2: b.nullable(b.utf8()),

  array: b.array(b.utf8()),
  tuple: b.tuple(b.uint8<1>(), b.uint16<2>(), b.uint32<3>()),
  struct: b.struct({ a: b.utf8(), b: b.utf8(), optional: b.optional(b.utf8()) }),
  partial: b.partial(b.struct({ a: b.utf8(), b: b.utf8(), optional: b.optional(b.utf8()) })),

  union: b.taggedUnion({
    one: b.struct({ type: b.uint8(), name: b.utf8() }),
    two: b.array(b.uint8()),
  }),

  descriminatedUnion: b.descriminatedUnion('tag', [
    b.struct({ tag: b.literal('a'), a: b.utf8() }),
    b.struct({ tag: b.literal('b'), b: b.utf8() }),
  ]),
})

it('should encode and decode', () => {
  type Encode = b.Infer<typeof test>['encode']
  const value: Encode = {
    uint8: 10,
    uint16: 10,
    uint32: 10,
    int8: 10,
    int16: 10,
    int32: 10,
    float32: 10,
    float64: 10,
    bigInt64: 10n,
    bigUint64: 10n,
    bigInt64Num: 10,
    bigUint64Num: 10,
    utf8: 'Some foo some bar',
    utf8Fixed: '123',
    optional2: '456',
    nullable1: null,
    nullable2: 'test',
    array: ['test', 'test2'],
    tuple: [1, 2, 3],
    struct: { b: 'bar', a: 'foo' },
    partial: { a: 'foo', optional: 'test' },
    union: ['two', [1]],
    descriminatedUnion: { tag: 'a', a: 'foo' },
  }
  const encoded = b.encode(test, value)
  const decoded = b.decode(test, encoded)
  expect(decoded).toEqual(value)
})
