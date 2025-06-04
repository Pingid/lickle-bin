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
  bigInt64Num: b.bigInt64<10>({ cast: 'number' }),
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

  taggedUnion: b.taggedUnion({
    one: b.struct({ type: b.uint8(), name: b.utf8() }),
    two: b.array(b.uint8()),
  }),

  descriminatedUnion: b.descriminatedUnion('tag', [
    b.struct({ tag: b.literal('a'), a: b.utf8() }),
    b.struct({ tag: b.literal('b'), b: b.utf8() }),
  ]),

  json: b.json<{ a: string; b: number }>(),
  intersection: b.intersection([b.struct({ a: b.utf8() }), b.partial(b.struct({ b: b.utf8() }))]),
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
    taggedUnion: ['two', [1]],
    descriminatedUnion: { tag: 'a', a: 'foo' },
    json: { a: 'foo', b: 10 },
    intersection: { a: 'foo', b: 'bar' },
  }
  const encoded = b.encode(test, value)
  const decoded = b.decode(test, encoded)
  expect(decoded).toEqual(value)
})

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type EncodeTypeInferTests = [
  Assert<Equal<b.Infer<typeof test.schema.uint8>['encode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.uint16>['encode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.uint32>['encode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.int8>['encode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.int16>['encode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.int32>['encode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.float32>['encode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.float64>['encode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.bigInt64>['encode'], bigint>>,
  Assert<Equal<b.Infer<typeof test.schema.bigUint64>['encode'], bigint>>,
  Assert<Equal<b.Infer<typeof test.schema.bigInt64Num>['encode'], 10>>,
  Assert<Equal<b.Infer<typeof test.schema.bigUint64Num>['encode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.utf8>['encode'], string>>,
  Assert<Equal<b.Infer<typeof test.schema.utf8Fixed>['encode'], string>>,
  Assert<Equal<b.Infer<typeof test.schema.optional1>['encode'], string | undefined>>,
  Assert<Equal<b.Infer<typeof test.schema.optional2>['encode'], string | undefined>>,
  Assert<Equal<b.Infer<typeof test.schema.nullable1>['encode'], string | null>>,
  Assert<Equal<b.Infer<typeof test.schema.nullable2>['encode'], string | null>>,
  Assert<Equal<b.Infer<typeof test.schema.array>['encode'], string[]>>,
  Assert<Equal<b.Infer<typeof test.schema.tuple>['encode'], [1, 2, 3]>>,
  Assert<Equal<b.Infer<typeof test.schema.struct>['encode'], { a: string; b: string; optional?: string }>>,
  Assert<Equal<b.Infer<typeof test.schema.partial>['encode'], { a?: string; b?: string; optional?: string }>>,
  Assert<
    Equal<
      b.Infer<typeof test.schema.taggedUnion>['encode'],
      ['two', number[]] | ['one', { type: number; name: string }]
    >
  >,
  Assert<
    Equal<b.Infer<typeof test.schema.descriminatedUnion>['encode'], { tag: 'a'; a: string } | { tag: 'b'; b: string }>
  >,
  Assert<Equal<b.Infer<typeof test.schema.json>['encode'], { a: string; b: number }>>,
  Assert<Equal<b.Infer<typeof test.schema.intersection>['encode'], { a: string; b?: string }>>,
]

export type DecodeTypeInferTests = [
  Assert<Equal<b.Infer<typeof test.schema.uint8>['decode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.uint16>['decode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.uint32>['decode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.int8>['decode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.int16>['decode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.int32>['decode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.float32>['decode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.float64>['decode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.bigInt64>['decode'], bigint>>,
  Assert<Equal<b.Infer<typeof test.schema.bigUint64>['decode'], bigint>>,
  Assert<Equal<b.Infer<typeof test.schema.bigInt64Num>['decode'], 10>>,
  Assert<Equal<b.Infer<typeof test.schema.bigUint64Num>['decode'], number>>,
  Assert<Equal<b.Infer<typeof test.schema.utf8>['decode'], string>>,
  Assert<Equal<b.Infer<typeof test.schema.utf8Fixed>['decode'], string>>,
  Assert<Equal<b.Infer<typeof test.schema.optional1>['decode'], string | undefined>>,
  Assert<Equal<b.Infer<typeof test.schema.optional2>['decode'], string | undefined>>,
  Assert<Equal<b.Infer<typeof test.schema.nullable1>['decode'], string | null>>,
  Assert<Equal<b.Infer<typeof test.schema.nullable2>['decode'], string | null>>,
  Assert<Equal<b.Infer<typeof test.schema.array>['decode'], string[]>>,
  Assert<Equal<b.Infer<typeof test.schema.tuple>['decode'], [1, 2, 3]>>,
  Assert<Equal<b.Infer<typeof test.schema.struct>['decode'], { a: string; b: string; optional?: string }>>,
  Assert<Equal<b.Infer<typeof test.schema.partial>['decode'], { a?: string; b?: string; optional?: string }>>,
  Assert<
    Equal<
      b.Infer<typeof test.schema.taggedUnion>['decode'],
      ['two', number[]] | ['one', { type: number; name: string }]
    >
  >,
  Assert<
    Equal<b.Infer<typeof test.schema.descriminatedUnion>['decode'], { tag: 'a'; a: string } | { tag: 'b'; b: string }>
  >,
  Assert<Equal<b.Infer<typeof test.schema.json>['decode'], { a: string; b: number }>>,
  Assert<Equal<b.Infer<typeof test.schema.intersection>['decode'], { a: string; b?: string }>>,
]
