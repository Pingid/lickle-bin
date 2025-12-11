import { run, bench, group } from 'mitata'
import * as b from '../src/index.js'

// ==========================================
// Setup & Helpers
// ==========================================

const sizes = [100, 1_000, 10_000, 100_000]

// 1. Integer Array Schema
const IntArray = b.array(b.uint32())

// 2. Complex Object Array Schema
const UserSchema = b.struct({
  id: b.uint32(),
  username: b.utf8(),
  isActive: b.bool(),
  scores: b.array(b.uint16()),
})
const UserArray = b.array(UserSchema)

// 3. Raw Bytes Schema (for throughput comparison)
const BytesSchema = b.bytes()
const Uint8ArraySchema = b.array(b.uint8()) // The unoptimized way to do bytes

// Data Generators
const genInts = (n: number) => new Array(n).fill(0).map((_, i) => i)
const genUsers = (n: number) =>
  new Array(n).fill(0).map((_, i) => ({ id: i, username: `user_${i}`, isActive: i % 2 === 0, scores: [10, 20, 30] }))
const genBytes = (n: number) => new Uint8Array(n).fill(1)

// ==========================================
// Benchmarks
// ==========================================

// --- Scenario 1: Scaling Array of Integers ---
// Tests the overhead of the read/write loop vs raw data size.
group('Scaling: Array<Uint32>', () => {
  for (const size of sizes) {
    const data = genInts(size)
    const encoded = b.encode(IntArray, data)

    bench(`Encode [${size} items]`, () => b.encode(IntArray, data))
    bench(`Decode [${size} items]`, () => b.decode(IntArray, encoded))
  }
})

// --- Scenario 2: Scaling Array of Objects ---
// Tests object allocation garbage collection pressure and nested encoding.
group('Scaling: Array<Struct>', () => {
  // We limit the size slightly lower for complex objects to keep bench runtimes sane
  const objectSizes = [100, 1_000, 10_000]

  for (const size of objectSizes) {
    const data = genUsers(size)
    const encoded = b.encode(UserArray, data)
    bench(`Encode [${size} objs]`, () => b.encode(UserArray, data))
    bench(`Decode [${size} objs]`, () => b.decode(UserArray, encoded))
  }
})

// --- Scenario 3: Optimization Check (Bytes vs Array<Uint8>) ---
// This highlights why the `bytes` codec (memcpy) is O(1) overhead vs O(N) loop overhead.
group('Optimization: 50kb Buffer', () => {
  const size = 50_000
  const data = genBytes(size)
  const dataAsArray = Array.from(data) // Convert to standard JS array for the array codec

  // optimized bytes() codec
  const encodedBytes = b.encode(BytesSchema, data)

  // unoptimized array(uint8()) codec
  const encodedArray = b.encode(Uint8ArraySchema, dataAsArray)

  bench('Encode: b.bytes() (Fast)', () => b.encode(BytesSchema, data))
  bench('Encode: b.array(b.uint8()) (Slow)', () => b.encode(Uint8ArraySchema, dataAsArray))
  bench('Decode: b.bytes() (Fast)', () => b.decode(BytesSchema, encodedBytes))
  bench('Decode: b.array(b.uint8()) (Slow)', () => b.decode(Uint8ArraySchema, encodedArray))
})

const format =
  process.env['BENCH_FORMAT'] === 'json'
    ? { json: { samples: false, debug: false } }
    : (process.env['BENCH_FORMAT'] as any)

await run({ format })
