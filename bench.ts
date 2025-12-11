import { run, bench, group } from 'mitata'
import * as b from './src/index.js'

// 1. Define a realistic schema
const UserSchema = b.struct({
  id: b.uint32(),
  username: b.utf8(),
  email: b.utf8(),
  age: b.uint8(),
  isActive: b.bool(),
  roles: b.array(b.utf8()),
  scores: b.array(b.uint16()),
  meta: b.struct({
    created: b.float64(),
    loginCount: b.uint32(),
  }),
})

// 2. Create the data object
const DATA = {
  id: 123456,
  username: 'super_developer_2024',
  email: 'dev@example.com',
  age: 28,
  isActive: true,
  roles: ['admin', 'editor', 'contributor'],
  scores: [100, 2550, 300, 42],
  meta: {
    created: Date.now(),
    loginCount: 4200,
  },
}

// 3. Prepare buffers for decode tests
const BINARY_ENCODED = b.encode(UserSchema, DATA)
const JSON_ENCODED = JSON.stringify(DATA)

// 4. Run Benchmarks
group('Encode (Serialization)', () => {
  bench('JSON.stringify', () => JSON.stringify(DATA)).baseline()
  bench('Bin Encode', () => b.encode(UserSchema, DATA))
})

group('Decode (Deserialization)', () => {
  bench('JSON.parse', () => JSON.parse(JSON_ENCODED)).baseline()
  bench('Bin Decode', () => b.decode(UserSchema, BINARY_ENCODED))
})

const format =
  process.env['BENCH_FORMAT'] === 'json'
    ? { json: { debug: false, samples: false } }
    : (process.env['BENCH_FORMAT'] as any)

await run({ format })
