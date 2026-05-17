import { it, expect } from 'vitest'

import * as b from '../src/index.js'

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

  utf8: b.utf8(),
  utf8Fixed: b.utf8({ size: 3 }),
  optional1: b.optional(b.utf8()),
  optional2: b.optional(b.utf8()),

  nullable1: b.nullable(b.utf8()),
  nullable2: b.nullable(b.utf8()),

  array: b.list(b.utf8()),
  tuple: b.tuple(b.uint8(), b.uint16(), b.uint32()),
  struct: b.struct({ a: b.utf8(), b: b.utf8(), optional: b.optional(b.utf8()) }),
  partial: b.partial(b.struct({ a: b.utf8(), b: b.utf8(), optional: b.optional(b.utf8()) })),

  tagged: b.tagged('tag', [
    b.struct({ tag: b.literal('a'), a: b.utf8() }),
    b.struct({ tag: b.literal('b'), b: b.utf8() }),
  ]),

  json: b.json<{ a: string; b: number }>(),
  intersect: b.intersect(b.struct({ a: b.utf8() }), b.partial(b.struct({ b: b.utf8() }))),
})

it('should encode and decode', () => {
  const value: b.Decoded<typeof test> = {
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
    utf8: 'Some foo some bar',
    utf8Fixed: '123',
    optional2: '456',
    nullable1: null,
    nullable2: 'test',
    array: ['test', 'test2'],
    tuple: [1, 2, 3],
    struct: { b: 'bar', a: 'foo' },
    partial: { a: 'foo', optional: 'test' },
    tagged: { tag: 'a', a: 'foo' },
    json: { a: 'foo', b: 10 },
    intersect: { a: 'foo', b: 'bar' },
  }
  const encoded = b.encode(test, value)
  const [decoded] = b.decode(test, encoded)
  expect(decoded).toEqual(value)
})

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type EncodeTypeInferTests = [
  Assert<Equal<b.Encodable<typeof test.shape.uint8>, number>>,
  Assert<Equal<b.Encodable<typeof test.shape.uint16>, number>>,
  Assert<Equal<b.Encodable<typeof test.shape.uint32>, number>>,
  Assert<Equal<b.Encodable<typeof test.shape.int8>, number>>,
  Assert<Equal<b.Encodable<typeof test.shape.int16>, number>>,
  Assert<Equal<b.Encodable<typeof test.shape.int32>, number>>,
  Assert<Equal<b.Encodable<typeof test.shape.float32>, number>>,
  Assert<Equal<b.Encodable<typeof test.shape.float64>, number>>,
  Assert<Equal<b.Encodable<typeof test.shape.bigInt64>, bigint>>,
  Assert<Equal<b.Encodable<typeof test.shape.bigUint64>, bigint>>,
  Assert<Equal<b.Encodable<typeof test.shape.utf8>, string>>,
  Assert<Equal<b.Encodable<typeof test.shape.utf8Fixed>, string>>,
  Assert<Equal<b.Encodable<typeof test.shape.optional1>, string | undefined>>,
  Assert<Equal<b.Encodable<typeof test.shape.optional2>, string | undefined>>,
  Assert<Equal<b.Encodable<typeof test.shape.nullable1>, string | null>>,
  Assert<Equal<b.Encodable<typeof test.shape.nullable2>, string | null>>,
  Assert<Equal<b.Encodable<typeof test.shape.array>, string[]>>,
  Assert<Equal<b.Encodable<typeof test.shape.tuple>, [number, number, number]>>,
  Assert<Equal<b.Encodable<typeof test.shape.struct>, { a: string; b: string; optional?: string | undefined }>>,
  Assert<Equal<b.Encodable<typeof test.shape.partial>, { a?: string; b?: string; optional?: string | undefined }>>,
  Assert<Equal<b.Encodable<typeof test.shape.tagged>, { tag: 'a'; a: string } | { tag: 'b'; b: string }>>,
  Assert<Equal<b.Encodable<typeof test.shape.json>, { a: string; b: number }>>,
  Assert<Equal<b.Encodable<typeof test.shape.intersect>, { a: string; b?: string }>>,
]

export type DecodeTypeInferTests = [
  Assert<Equal<b.Decoded<typeof test.shape.uint8>, number>>,
  Assert<Equal<b.Decoded<typeof test.shape.uint16>, number>>,
  Assert<Equal<b.Decoded<typeof test.shape.uint32>, number>>,
  Assert<Equal<b.Decoded<typeof test.shape.int8>, number>>,
  Assert<Equal<b.Decoded<typeof test.shape.int16>, number>>,
  Assert<Equal<b.Decoded<typeof test.shape.int32>, number>>,
  Assert<Equal<b.Decoded<typeof test.shape.float32>, number>>,
  Assert<Equal<b.Decoded<typeof test.shape.float64>, number>>,
  Assert<Equal<b.Decoded<typeof test.shape.bigInt64>, bigint>>,
  Assert<Equal<b.Decoded<typeof test.shape.bigUint64>, bigint>>,
  Assert<Equal<b.Decoded<typeof test.shape.utf8>, string>>,
  Assert<Equal<b.Decoded<typeof test.shape.utf8Fixed>, string>>,
  Assert<Equal<b.Decoded<typeof test.shape.optional1>, string | undefined>>,
  Assert<Equal<b.Decoded<typeof test.shape.optional2>, string | undefined>>,
  Assert<Equal<b.Decoded<typeof test.shape.nullable1>, string | null>>,
  Assert<Equal<b.Decoded<typeof test.shape.nullable2>, string | null>>,
  Assert<Equal<b.Decoded<typeof test.shape.array>, string[]>>,
  Assert<Equal<b.Decoded<typeof test.shape.tuple>, [number, number, number]>>,
  Assert<Equal<b.Decoded<typeof test.shape.struct>, { a: string; b: string; optional?: string | undefined }>>,
  Assert<Equal<b.Decoded<typeof test.shape.partial>, { a?: string; b?: string; optional?: string | undefined }>>,
  Assert<Equal<b.Decoded<typeof test.shape.tagged>, { tag: 'a'; a: string } | { tag: 'b'; b: string }>>,
  Assert<Equal<b.Decoded<typeof test.shape.json>, { a: string; b: number }>>,
  Assert<Equal<b.Decoded<typeof test.shape.intersect>, { a: string; b?: string }>>,
]
