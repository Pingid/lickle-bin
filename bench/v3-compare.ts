import { run, bench, group } from 'mitata'

import { createEncoder, createDecoder } from '../src/v3/runtime/index.js'
import * as v3 from '../src/v3/schema/index.js'
import * as c from '../src/index.js'

// 1. Define a realistic schema
const UserSchema = c.struct({
  id: c.uint32(),
  username: c.utf8(),
  email: c.utf8(),
  age: c.uint8(),
  isActive: c.bool(),
  roles: c.array(c.utf8()),
  scores: c.array(c.uint16()),
  meta: c.struct({
    created: c.float64(),
    loginCount: c.uint32(),
  }),
})

// 1. Define a realistic schema
const V3UserSchema = v3.struct({
  id: v3.u32(),
  username: v3.str(),
  email: v3.str(),
  age: v3.u8(),
  isActive: v3.bool(),
  roles: v3.list(v3.str()),
  scores: v3.list(v3.u16()),
  meta: v3.struct({
    created: v3.f64(),
    loginCount: v3.u32(),
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
const encode = createEncoder(V3UserSchema, { boundsCheck: false, strictRange: false, initialBufferSize: 111 })
const decode = createDecoder(V3UserSchema, { boundsCheck: false, strictEOF: false })
const BINARY_ENCODED = encode(DATA)

// 4. Run Benchmarks
group('Encode', () => {
  bench('Previous Encode', () => c.encode(UserSchema, DATA)).baseline()
  bench('New Encode', () => encode(DATA))
})

group('Decode', () => {
  bench('Previous Decode', () => c.decode(UserSchema, BINARY_ENCODED)).baseline()
  bench('New Decode', () => decode(BINARY_ENCODED))
})

const format =
  process.env['BENCH_FORMAT'] === 'json'
    ? { json: { samples: false, debug: false } }
    : (process.env['BENCH_FORMAT'] as any)

await run({ format })
