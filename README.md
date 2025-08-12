# @lickle/bin

A tiny, efficient utility for defining binary data schemas and performing encoding/decoding of JavaScript objects to and from `Uint8Array`.

[![Build Status](https://img.shields.io/github/actions/workflow/status/Pingid/lickle-bin/test.yml?branch=main&style=flat&colorA=000000&colorB=000000)](https://github.com/Pingid/lickle-bin/actions?query=workflow:Test)
[![Build Size](https://img.shields.io/bundlephobia/minzip/@lickle/bin?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=@lickle/bin)
[![Version](https://img.shields.io/npm/v/@lickle/bin?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@lickle/bin)
[![Downloads](https://img.shields.io/npm/dt/@lickle/bin.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@lickle/bin)

## Install

Install the `@lickle/bin` library using your preferred package manager:

```bash
npm install @lickle/bin
```

## 🚀 Quick Start

```ts
import * as c from '@lickle/bin'

// 1️⃣ Define your schema
const UserSchema = c.struct({
  id: c.uint32(),
  active: c.bool(),
  name: c.utf8({ fixed: 20 }), // fixed-size string
  bio: c.optional(c.utf8()), // optional string
  scores: c.array(c.float32()), // array of numbers
})

// 2️⃣ Encode JS object -> Uint8Array
const encoded = c.encode(UserSchema, {
  id: 42,
  active: true,
  name: 'Alice',
  bio: 'Loves cats',
  scores: [9.5, 8.75],
})

// 3️⃣ Decode Uint8Array -> JS object
const decoded = c.decode(UserSchema, encoded)
console.log(decoded)
```

---

## 🛠 Built-in Codecs

| Type         | Example Usage                                     | Notes                       |
| ------------ | ------------------------------------------------- | --------------------------- |
| **Numbers**  | `c.uint8()`, `c.int16()`, `c.float64()`           | Big/little endian supported |
| **Strings**  | `c.utf8()`, `c.utf8({ fixed: 32 })`               | Dynamic or fixed length     |
| **Booleans** | `c.bool()`                                        | Stored as `0`/`1` byte      |
| **Arrays**   | `c.array(c.uint16())`                             | Length-prefixed             |
| **Tuples**   | `c.tuple(c.uint8(), c.float32())`                 | Fixed element count/types   |
| **Optional** | `c.optional(c.utf8())`                            | 1-byte flag + value         |
| **Literal**  | `c.literal('ok')`                                 | Stored as zero bytes        |
| **Bytes**    | `c.bytes({ fixed: 16 })`                          | Raw binary data             |
| **JSON**     | `c.json<MyType>()`                                | UTF-8 JSON string           |
| **Structs**  | `c.struct({ ... })`                               | Named fields                |
| **Unions**   | `c.taggedUnion(...)`, `c.discriminatedUnion(...)` | Variant types               |

---

## 📚 Example: Complex Schema

```ts
const MessageSchema = c.struct({
  type: c.literal('message'),
  senderId: c.uint32(),
  content: c.utf8(),
  metadata: c.optional(c.json<Record<string, any>>()),
})

const ChatSchema = c.struct({
  id: c.uint32(),
  messages: c.array(MessageSchema, { maxLength: 100 }),
})
```

---

## ⚡ Low-Level API

You can also manually read/write without defining a schema:

```ts
import { reader, read, writer, write, Uint8, Utf8 } from '@lickle/bin'

// Writing
const w = writer()
write(w, Uint8, 42)
write(w, Utf8, 'Hello')
const buf = w.flush()

// Reading
const [r1, num, text] = read(reader(buf), Uint8, Utf8)
console.log(num, text) // 42 "Hello"
```

---

## 📄 License

MIT © [Dan Beaven](https://github.com/Pingid)
