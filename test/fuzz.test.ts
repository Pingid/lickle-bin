import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import * as b from '../src/index.js'

// =========================================
// 1. Define Fast-Check Generators (Arbitraries)
// =========================================

// Helper to ensure we compare plain Uint8Arrays, as Buffer vs Uint8Array can cause equality failures
const toPlain = (val: any): any => {
  if (val instanceof Uint8Array) {
    // Convert Buffer (or any Uint8Array subclass) to a plain Uint8Array
    const plain = new Uint8Array(val.byteLength)
    plain.set(val)
    return plain
  }
  if (Array.isArray(val)) {
    return val.map(toPlain)
  }
  if (val && typeof val === 'object' && val !== null) {
    const out: any = {}
    for (const k in val) {
      out[k] = toPlain(val[k])
    }
    return out
  }
  return val
}

const arb = {
  u8: fc.integer({ min: 0, max: 255 }),
  u16: fc.integer({ min: 0, max: 65535 }),
  u32: fc.integer({ min: 0, max: 4294967295 }),

  i8: fc.integer({ min: -128, max: 127 }),
  i16: fc.integer({ min: -32768, max: 32767 }),
  i32: fc.integer({ min: -2147483648, max: 2147483647 }),

  // Standard floats
  f32: fc.float(),
  f64: fc.double(),

  // BigInts
  u64: fc.bigInt({ min: 0n, max: 0xffffffffffffffffn }),
  i64: fc.bigInt({ min: -0x8000000000000000n, max: 0x7fffffffffffffffn }),

  // VarInt (must be non-negative, fits in uint32 to match schema)
  varint: fc.integer({ min: 0, max: 0xffffffff }),

  // Strings & Bytes
  bool: fc.boolean(),
  str: fc.string({ unit: 'grapheme' }),
  bytes: fc.uint8Array().map(toPlain), // Ensure input is plain Uint8Array
}

// Complex "Kitchen Sink" Generator
const arbitraryKitchenSink = fc.record({
  primitives: fc.record({
    u8: arb.u8,
    i16: arb.i16,
    f32: arb.f32,
    f64: arb.f64,
    bool: arb.bool,
  }),
  bigNumbers: fc.record({
    u64: arb.u64,
    i64: arb.i64,
  }),
  strings: fc.record({
    standard: arb.str,
    long: fc.string({ maxLength: 1000 }), // Longer strings
  }),
  buffers: fc.record({
    raw: arb.bytes,
    arrayOfUint8: fc.array(arb.u8),
  }),
  collections: fc.record({
    // Standard list
    numArray: fc.array(arb.i32),
    // List with varint length prefix (simulated in schema)
    varintList: fc.array(arb.str),

    structArray: fc.array(
      fc.record({
        id: arb.varint,
        tags: fc.array(arb.str),
        payload: arb.bytes,
      }),
    ),
    tuple: fc.tuple(arb.u8, arb.str, arb.f32),
  }),
  // Nested structure
  nested: fc.record({
    level1: fc.record({
      level2: fc.array(
        fc.record({
          val: arb.varint,
        }),
      ),
    }),
  }),
})

// =========================================
// 2. Define Matching Bincode Schema
// =========================================

// This MUST match the structure of `arbitraryKitchenSink` exactly.
const schemaKitchenSink = b.struct({
  primitives: b.struct({
    u8: b.uint8(),
    i16: b.int16(),
    f32: b.float32(),
    f64: b.float64(),
    bool: b.bool(),
  }),
  bigNumbers: b.struct({
    u64: b.bigUint64(),
    i64: b.bigInt64(),
  }),
  strings: b.struct({
    standard: b.utf8(),
    long: b.utf8(),
  }),
  buffers: b.struct({
    raw: b.bytes(),
    arrayOfUint8: b.list(b.uint8()),
  }),
  collections: b.struct({
    numArray: b.list(b.int32()),
    varintList: b.list(b.utf8()),
    structArray: b.list(
      b.struct({
        id: b.uint32(),
        tags: b.list(b.utf8()),
        payload: b.bytes(),
      }),
    ),
    tuple: b.tuple(b.uint8(), b.utf8(), b.float32()),
  }),
  nested: b.struct({
    level1: b.struct({
      level2: b.list(
        b.struct({
          val: b.uint32(),
        }),
      ),
    }),
  }),
})

// =========================================
// 3. The Fuzz Test
// =========================================
const assertSymmetric = (data: any) => {
  const size = b.measure(schemaKitchenSink, data)
  expect(size).toBeGreaterThanOrEqual(0)

  const encoded = b.encode(schemaKitchenSink, data)
  expect(encoded.length).toBe(size)

  const [decoded] = b.decode(schemaKitchenSink, encoded)

  expect(toPlain(decoded)).toEqual(toPlain(data))
}

describe('Fuzz Testing: Kitchen Sink', () => {
  it('should symmetrically encode and decode complex nested structures', { timeout: 30_000 }, () => {
    // Run 10,000 random tests
    fc.assert(
      fc.property(arbitraryKitchenSink, (data) => assertSymmetric(data)),
      {
        numRuns: 10_000,
        verbose: true,
      },
    )
  })
})
