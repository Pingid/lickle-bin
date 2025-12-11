import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import * as b from '../src/index.js'

// =========================================
// 1. Define Fast-Check Generators (Arbitraries)
// =========================================

// Primitives
const arb = {
  uint8: fc.integer({ min: 0, max: 255 }),
  uint16: fc.integer({ min: 0, max: 65535 }),
  // Use max safe integer for JS numbers to avoid precision issues before float conversion
  uint32: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
  int8: fc.integer({ min: -128, max: 127 }),
  int16: fc.integer({ min: -32768, max: 32767 }),
  int32: fc.integer({ min: -(2 ** 31), max: 2 ** 31 - 1 }),
  // Varints cover full 32-bit range
  vuint: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
  vint: fc.integer({ min: -(2 ** 31), max: 2 ** 31 - 1 }),
  // standard floats (including infinity, NaN, negative zero)
  float32: fc.float(),
  float64: fc.double(),
  // BigInts
  bigUint64: fc.bigInt(0n, BigInt(Number.MAX_SAFE_INTEGER) - 1n),
  bigInt64: fc.bigInt(-BigInt(Number.MAX_SAFE_INTEGER), BigInt(Number.MAX_SAFE_INTEGER) - 1n),
  // Strings & Bytes
  bool: fc.boolean(),
  // fullUnicodeString tests weird emojis, zero-width characters, etc.
  utf8: fc.string({ unit: 'grapheme' }),
  bytes: fc.uint8Array(),
}

// Complex "Kitchen Sink" Generator
// This creates deeply nested random data structures.
const arbitraryKitchenSink = fc.record({
  primitives: fc.record({
    u8: arb.uint8,
    u32: arb.uint32,
    i16: arb.int16,
    f64: arb.float64,
    vu: arb.vuint,
    vi: arb.vint,
    bool: arb.bool,
  }),
  bigNumbers: fc.record({
    bu64: arb.bigUint64,
    bi64: arb.bigInt64,
  }),
  strings: fc.record({
    standard: arb.utf8,
    nullable: fc.option(arb.utf8, { nil: null }),
    optional: fc.option(arb.utf8, { nil: undefined }),
  }),
  buffers: fc.record({
    raw: arb.bytes,
    arrayOfUint8: fc.array(arb.uint8), // Alternative way to represent bytes
  }),
  collections: fc.record({
    // Nested arrays of complex objects
    numArray: fc.array(arb.int32),
    structArray: fc.array(
      fc.record({
        id: arb.vuint,
        tags: fc.array(arb.utf8),
      }),
    ),
    tuple: fc.tuple(arb.uint8, arb.utf8, arb.float32),
  }),
  unions: fc.record({
    // Tagged Union: Generates ['tag', value] tuple
    tagged: fc.oneof(fc.tuple(fc.constant('ok'), arb.utf8), fc.tuple(fc.constant('err'), arb.int32)),
    // Discriminated Union: Generates { kind: 'tag', ...fields } object
    discriminated: fc.oneof(
      fc.record({ kind: fc.constant('A'), valA: arb.uint16 }),
      fc.record({ kind: fc.constant('B'), valB: arb.float64 }),
      fc.record({ kind: fc.constant('C'), valC: arb.bool }),
    ),
  }),
  // Deeply nested recursive-like structure containing options and arrays
  nestedDeep: fc.array(
    fc.option(
      fc.record({
        label: arb.utf8,
        data: fc.oneof(arb.uint32, arb.bytes),
      }),
    ),
  ),
})

// =========================================
// 2. Define Matching Bincode Schema
// =========================================

// This MUST match the structure of `arbitraryKitchenSink` exactly.
const schemaKitchenSink = b.struct({
  primitives: b.struct({
    u8: b.uint8(),
    u32: b.uint32(),
    i16: b.int16(),
    f64: b.float64(),
    vu: b.vuint(),
    vi: b.vint(),
    bool: b.bool(),
  }),
  bigNumbers: b.struct({
    bu64: b.bigUint64(),
    bi64: b.bigInt64(),
  }),
  strings: b.struct({
    standard: b.utf8(),
    nullable: b.nullable(b.utf8()),
    optional: b.optional(b.utf8()),
  }),
  buffers: b.struct({
    raw: b.bytes(),
    arrayOfUint8: b.array(b.uint8()),
  }),
  collections: b.struct({
    numArray: b.array(b.int32()),
    structArray: b.array(
      b.struct({
        id: b.vuint(),
        tags: b.array(b.utf8()),
      }),
    ),
    tuple: b.tuple(b.uint8(), b.utf8(), b.float32()),
  }),
  unions: b.struct({
    tagged: b.taggedUnion({
      ok: b.utf8(),
      err: b.int32(),
    }),
    discriminated: b.discriminatedUnion('kind', [
      b.struct({ kind: b.literal('A'), valA: b.uint16() }),
      b.struct({ kind: b.literal('B'), valB: b.float64() }),
      b.struct({ kind: b.literal('C'), valC: b.bool() }),
    ]),
  }),
  nestedDeep: b.array(
    b.optional(
      b.struct({
        label: b.utf8(),
        // We don't have an untagged union codec yet, so we use a structured approach for fuzzing here
        // Ideally you would add a `b.union([b.uint32(), b.bytes()])` codec later.
        // For now, let's simplify this specific nested part to fit current capabilities:
        data: b.bytes(),
      }),
    ),
  ),
})

// Patching the generator to match the simplified schema above
const arbitraryKitchenSinkPatched = arbitraryKitchenSink.map((data) => ({
  ...data,
  nestedDeep: data.nestedDeep.map((opt) => (opt ? { ...opt, data: new Uint8Array() } : undefined)),
}))

// =========================================
// 3. The Fuzz Test
// =========================================

const assertSymmetric = (data: any) => {
  const encoded = b.encode(schemaKitchenSink, data as any)
  const decoded = b.decode(schemaKitchenSink, encoded)
  expect(decoded).toEqual(data)
}

describe('Fuzz Testing: Kitchen Sink', () => {
  it('should symmetrically encode and decode complex nested structures', () => {
    // Run 10,000 random tests
    fc.assert(
      fc.property(arbitraryKitchenSinkPatched, (data) => assertSymmetric(data)),
      { numRuns: 10_000, verbose: true },
    )
  })
})
