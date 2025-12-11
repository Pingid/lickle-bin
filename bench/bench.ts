import { run, bench, group } from "mitata";

import { compileEncoder, compileDecoder } from "../src/jit/index.js";
import { encode, decode } from "../src/index.js";
import * as c from "../src/jit/codec.js";

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
});

// 2. Create the data object
const DATA = {
  id: 123456,
  username: "super_developer_2024",
  email: "dev@example.com",
  age: 28,
  isActive: true,
  roles: ["admin", "editor", "contributor"],
  scores: [100, 2550, 300, 42],
  meta: {
    created: Date.now(),
    loginCount: 4200,
  },
};

// 3. Prepare buffers for decode tests
const JSON_ENCODED = JSON.stringify(DATA);
const BINARY_ENCODED = encode(UserSchema, DATA);
const jitEncode = compileEncoder(UserSchema);
const jitDecode = compileDecoder(UserSchema);

// 4. Run Benchmarks
group("Encode (Serialization)", () => {
  bench("JSON.stringify", () => JSON.stringify(DATA)).baseline();
  bench("Bin Encode", () => encode(UserSchema, DATA));
  bench("JIT Encode", () => jitEncode(DATA));
});

group("Decode (Deserialization)", () => {
  bench("JSON.parse", () => JSON.parse(JSON_ENCODED)).baseline();
  bench("Bin Decode", () => decode(UserSchema, BINARY_ENCODED));
  bench("JIT Decode", () => jitDecode(BINARY_ENCODED));
});

const format =
  process.env["BENCH_FORMAT"] === "json"
    ? { json: { samples: false, debug: false } }
    : (process.env["BENCH_FORMAT"] as any);

await run({ format });
