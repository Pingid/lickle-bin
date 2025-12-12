import { it, expect } from 'vitest'

import { createDecoder, createEncoder } from './runtime/index.js'
import * as b from './schema/index.js'

const Sized = b.struct({
  bool: b.bool(),
  i8: b.i8(),
  u8: b.u8(),
  i16: b.i16(),
  u16: b.u16(),
  i32: b.i32(),
  u32: b.u32(),
  i64: b.i64(),
  u64: b.u64(),
})

it('should encode and decode a simple struct', () => {
  const encode = createEncoder(Sized)
  const decode = createDecoder(Sized)
  const value: typeof Sized.$infer = {
    bool: false,
    i8: -1,
    u8: 2,
    i16: -3,
    u16: 4,
    i32: -6,
    u32: 7,
    i64: -9n,
    u64: 10n,
  }
  expect(Sized.size).toBeDefined()
  const encoded = encode(value)
  const decoded = decode(encoded)
  expect(decoded).toEqual(value)
})

const Floats = b.struct({
  f16: b.f16(),
  f32: b.f32(),
  f64: b.f64(),
})
it('should encode and decode a struct with floats', () => {
  const encode = createEncoder(Floats)
  const decode = createDecoder(Floats)
  const value: typeof Floats.$infer = { f16: 5.1, f32: 8.1, f64: 11.1 }
  expect(Floats.size).toBeDefined()
  const encoded = encode(value)
  const decoded = decode(encoded)
  expect(decoded.f16).toBeCloseTo(value.f16)
  expect(decoded.f32).toBeCloseTo(value.f32)
})

const Unsized = b.struct({
  str: b.str(),
  list: b.list(b.str()),
})
it('should encode and decode a struct with unsized fields', () => {
  const encode = createEncoder(Unsized)
  const decode = createDecoder(Unsized)
  const value: typeof Unsized.$infer = { str: 'hello', list: ['world'] }
  const encoded = encode(value)
  const decoded = decode(encoded)
  expect(decoded).toEqual(value)
})
