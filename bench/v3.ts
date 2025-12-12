import { run, bench, group } from 'mitata'

import { createEncoder, createDecoder } from '../src/v3/runtime/index.js'
import * as c from '../src/v3/schema/index.js'

// 1. Define a realistic schema
const UserSchema = c.struct({
  id: c.u32(),
  username: c.str(),
  email: c.str(),
  age: c.u8(),
  isActive: c.bool(),
  roles: c.list(c.str()),
  scores: c.list(c.u16()),
  meta: c.struct({
    created: c.f64(),
    loginCount: c.u32(),
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
const JSON_ENCODED = JSON.stringify(DATA)
const encode = createEncoder(UserSchema, { boundsCheck: false, strictRange: false, initialBufferSize: 111 })
const decode = createDecoder(UserSchema, { boundsCheck: false, strictEOF: false })
const BINARY_ENCODED = encode(DATA)

// 4. Run Benchmarks
group('Encode (Serialization)', () => {
  bench('JSON.stringify', () => JSON.stringify(DATA)).baseline()
  bench('Bin Encode', () => encode(DATA))
})

group('Decode (Deserialization)', () => {
  bench('JSON.parse', () => JSON.parse(JSON_ENCODED)).baseline()
  bench('Bin Decode', () => decode(BINARY_ENCODED))
})

const format =
  process.env['BENCH_FORMAT'] === 'json'
    ? { json: { samples: false, debug: false } }
    : (process.env['BENCH_FORMAT'] as any)

await run({ format })
