# @lickle/bin

Binary codecs for JavaScript. Define a schema, encode/decode `Uint8Array`.

[![Build Status](https://img.shields.io/github/actions/workflow/status/Pingid/lickle-bin/test.yml?branch=main&style=flat&colorA=000000&colorB=000000)](https://github.com/Pingid/lickle-bin/actions?query=workflow:Test)
[![Build Size](https://img.shields.io/bundlephobia/minzip/@lickle/bin?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=@lickle/bin)
[![Version](https://img.shields.io/npm/v/@lickle/bin?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@lickle/bin)
[![Downloads](https://img.shields.io/npm/dt/@lickle/bin.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@lickle/bin)

## Install

```bash
npm install @lickle/bin
```

## Encode / decode

```ts
import * as b from '@lickle/bin'

const User = b.struct({
  id: b.uint32(),
  name: b.utf8(),
  active: b.bool(),
})

const bytes = b.encode(User, { id: 1, name: 'ada', active: true })
const [user, pos] = b.decode(User, bytes)
```

Infer types:

```ts
type User = b.Decoded<typeof User>     // decode output
type UserIn = b.Encodable<typeof User> // encode input (may be wider, e.g. optional fields)
```

`measure(codec, value)` returns the encoded byte length without retaining the bytes.
`encodeInto(codec, value, buf, offset?)` writes into an existing `Uint8Array` and returns the new write position.

## Primitives

```ts
b.bool()
b.uint8()    b.int8()
b.uint16()   b.int16()    // pass `true` for little-endian
b.uint32()   b.int32()
b.float32()  b.float64()
b.bigUint64() b.bigInt64()
b.varint()                       // LEB128 unsigned, 1–5 bytes, range [0, 2^32 − 1]
b.utf8()                         // varint length-prefixed
b.utf8({ size: 20 })             // fixed-width, throws when encoded length ≠ size
b.utf8({ size: 20, pad: true })  // fixed-width, zero-pads short strings
b.bytes()                        // varint length-prefixed Uint8Array
b.bytes({ size: 16 })            // fixed-width, throws when input length ≠ size
b.bytes({ size: 16, pad: true }) // fixed-width, zero-pads short inputs
b.literal('v1')                  // zero-byte constant
```

## Composites

```ts
b.struct({ x: b.uint8(), y: b.uint8() })

b.tuple(b.uint8(), b.utf8())

b.array(b.uint16(), 4)  // fixed-length, no length prefix
b.list(b.utf8())        // varint length
b.list(b.utf8(), { length: b.uint8() })

b.map(b.utf8(), b.uint32()) // Map<K, V>
b.set(b.uint16())           // Set<T>

b.optional(b.utf8()) // value | undefined
b.nullable(b.utf8()) // value | null
```

Tagged unions (discriminated by a struct field):

```ts
const Msg = b.tagged('type', [
  b.struct({ type: b.literal('text'), body: b.utf8() }),
  b.struct({ type: b.literal('img'), url: b.utf8(), w: b.uint16() }),
])
```

Recursive schemas:

```ts
type Tree = { v: number; c: Tree[] }
const Tree: b.Codec<Tree> = b.lazy(() =>
  b.struct({
    v: b.uint32(),
    c: b.list(Tree),
  }),
)
```

`intersect(a, b)` merges two struct shapes; on key collision, `b`'s field wins both at the type level and on the wire.
`partial(struct)` wraps every field in `optional`.

## Length-prefix overflow

Custom length codecs cap the maximum collection size. Encoding a value whose length exceeds the codec's range throws `RangeError`:

```ts
const c = b.list(b.uint8(), { length: b.uint8() })
b.encode(c, new Array(300)) // throws: length 300 out of range [0, 255]
```

On decode, `list` / `set` / `map` bound the claimed length by the remaining bytes (1-byte minimum per item) before allocating, so an attacker-controlled length prefix cannot trigger a runaway allocation. `reader(buf, { trust: true })` opts out of this guard along with all other bounds checks.

## Transformations

```ts
b.imap(
  b.uint32(),
  (n) => new Date(n * 1000),
  (d) => d.getTime() / 1000,
)
b.fallback(b.uint8(), 0) // returns default if decode throws
b.json<{ a: number }>()  // utf8 + JSON.parse/stringify
```

`imap` strips composite shape metadata, so a lens built over an imap'd codec does not drill into the underlying struct/tuple/array — only `read`/`write`/`slice` are exposed.

## Lens — random access without full decode

```ts
const L = b.lens(User)
const buf = b.encode(User, { id: 1, name: 'ada', active: true })

L.id.$read(buf) // 1
L.active.$write(buf, false)
L.$read(buf) // { id: 1, name: 'ada', active: false }
```

Lens base accessors are `$`-prefixed (`$read`, `$write`, `$slice`, `$codec`, `$offset`, `$size`) so they never collide with struct field names like `read`/`write`/`size`.

Arrays and lists:

```ts
const Pts = b.array(b.struct({ x: b.uint8(), y: b.uint8() }), 8)
const LP = b.lens(Pts)
LP.at(3).x.$read(buf)
LP.at(3).x.$write(buf, 42)

const Names = b.list(b.utf8())
const bound = b.lens(Names).bind(buf)
bound.at(0)
bound.toArray()
```

**In-place writes must preserve byte length.** Writing a sized field at a known offset always works. Writing an unsized field (e.g. `utf8`) or a whole composite throws `RangeError` if the new value would have a different encoded length than the existing bytes — anything else would shift downstream data. Use `encode` for resizing rewrites.

## Reader / writer

```ts
const w = b.writer()
b.write(w, b.uint8(), 7)
b.write(w, b.utf8(), 'hi')
const bytes = w.flush()

const r = b.reader(bytes)
const [n, s] = b.read(r, b.uint8(), b.utf8())
```

`b.writer(size)` preallocates a buffer of exactly `size` bytes; `flush()` returns only the written prefix.

Bounds-checking modes:

```ts
b.reader(bytes, { trust: true }) // skip bounds checks (only for buffers you produced)
b.reader(bytes, { trace: true }) // throw DecodeError with path + offset on failure
```

`DecodeError` exposes `path: (string | number)[]`, `offset: number`, and `cause: unknown` for programmatic inspection. Trace mode adds per-field bookkeeping — use it for diagnostics, not the hot path.

## Wire format

| Codec                       | Bytes                                                                    |
| --------------------------- | ------------------------------------------------------------------------ |
| `bool`                      | 1 byte (`0` = false, non-zero = true on decode)                          |
| `uint8` / `int8`            | 1 byte                                                                   |
| `uint16` / `int16`          | 2 bytes, big-endian (little-endian if `le = true`)                       |
| `uint32` / `int32`          | 4 bytes, big-endian                                                      |
| `float32` / `float64`       | 4 / 8 bytes, IEEE 754, big-endian                                        |
| `bigUint64` / `bigInt64`    | 8 bytes, big-endian                                                      |
| `varint`                    | LEB128 unsigned, 1–5 bytes (range `[0, 2^32 − 1]`)                       |
| `literal(v)`                | 0 bytes                                                                  |
| `utf8()`                    | varint length, then UTF-8 bytes                                          |
| `utf8({ size: N })`         | exactly N bytes; decode strips trailing null bytes                       |
| `bytes()`                   | varint length, then raw bytes                                            |
| `bytes({ size: N })`        | exactly N bytes                                                          |
| `optional(c)`               | 1-byte flag (`0` = absent), then `c` if present                          |
| `nullable(c)`               | 1-byte flag (`0` = null), then `c` if present                            |
| `array(c, N)`               | N × `c` concatenated, no length prefix                                   |
| `list(c)` / `set(c)`        | varint length, then N × `c` (insertion order for `set`)                  |
| `tuple(c1, …)`              | each element in order                                                    |
| `struct({ k: c, … })`       | each field in declaration order                                          |
| `tagged(t, variants)`       | 1-byte variant index (configurable via `{ tag }`), then variant struct   |
| `map(k, v)`                 | varint length, then N × (`k`, `v`) pairs in insertion order              |

`bytes()` decoded values are zero-copy views into the source buffer — mutating either aliases the other. Treat decoded `Uint8Array` as read-only or copy before mutating.

## License

MIT © [Dan Beaven](https://github.com/Pingid)
