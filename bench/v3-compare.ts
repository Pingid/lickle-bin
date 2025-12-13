import { run, bench, group } from 'mitata'

import { compileDecoder, compileEncoder } from '../src/jit/io.js'
import * as Runtime from '../src/v3/runtime/index.js'
import * as JIT from '../src/v3/jitt/index.js'
import * as v3 from '../src/v3/schema/index.js'
import * as c from '../src/jit/index.js'
import * as old from '../src/index.js'

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

const decoderOpts = {
  boundsCheck: true,
  // maxStringLength: Infinity, // Important: Disables the 'if > max' check
  // maxListLength: Infinity, // Important: Disables the 'if > max' check
}
const encoderOpts = {
  boundsCheck: true,
  strictRange: true,
  // initialBufferSize: 111,
}

// 3. Prepare buffers for decode tests
const runtimeEncode = Runtime.createEncoder(V3UserSchema, encoderOpts)
const jitEncode = JIT.createEncoder(V3UserSchema, encoderOpts)
const runtimeDecode = Runtime.createDecoder(V3UserSchema, decoderOpts)
const jitDecode = JIT.createDecoder(V3UserSchema, decoderOpts)
const NEW_BINARY_ENCODED = runtimeEncode(DATA)
const OLD_BINARY_ENCODED = old.encode(UserSchema, DATA)

const oldJitEncode = compileEncoder(UserSchema)
const oldJitDecode = compileDecoder(UserSchema)

group('Encode', () => {
  bench('Previous Runtime Encode', () => old.encode(UserSchema, DATA))
  bench('New Runtime Encode', () => runtimeEncode(DATA))
  bench('Previous JIT Runtime Encode', () => oldJitEncode(DATA))
  bench('New JIT Runtime Encode', () => jitEncode(DATA))
})

group('Decode', () => {
  bench('Previous Runtime Decode', () => old.decode(UserSchema, OLD_BINARY_ENCODED))
  bench('New Runtime Decode', () => runtimeDecode(NEW_BINARY_ENCODED))
  bench('Previous JIT Runtime Decode', () => oldJitDecode(OLD_BINARY_ENCODED))
  bench('New JIT Runtime Decode', () => jitDecode(NEW_BINARY_ENCODED))
})

const format =
  process.env['BENCH_FORMAT'] === 'json'
    ? { json: { samples: false, debug: false } }
    : (process.env['BENCH_FORMAT'] as any)

await run({ format })
