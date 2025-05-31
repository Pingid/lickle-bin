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

## Usage

Define your data structures using `c.struct` and other provided codec primitives. Then, use `encode` and `decode` to convert between JavaScript objects and `Uint8Array`.

### Defining Schemas

```typescript
import * as c from '@lickle/bin'

const MyDataSchema = c.struct({
  // Basic types
  id: c.uint32(),
  isActive: c.bool(),
  name: c.utf8({ fixed: 20 }), // Fixed-size string
  description: c.optional(c.utf8()), // Optional dynamic string

  // Collections
  tags: c.array(c.utf8()), // Array of dynamic strings
  coordinates: c.tuple(c.float32(), c.float32()), // Fixed-size tuple

  // Advanced unions
  dataType: c.union({
    // Tagged union
    stringData: c.utf8(),
    numberData: c.float64(),
  }),
  message: c.descriminatedUnion('type', [
    // Discriminated union
    c.struct({ type: c.literal('text'), content: c.utf8() }),
    c.struct({ type: c.literal('image'), url: c.utf8(), size: c.uint32() }),
  ]),
})

// Infer the typescript type for the decoded value
type MyDataSchema = c.TypeOf<typeof MyDataSchema>['decode']
```

### Encoding and Decoding

```typescript
import { encode, decode } from '@lickle/bin'

const exampleData = {
  id: 12345,
  isActive: true,
  name: 'Example Item',
  description: 'This is an optional description.',
  tags: ['tag1', 'tag2', 'tag3'],
  coordinates: [10.5, 20.125],
  dataType: ['stringData', 'Hello World'],
  message: { type: 'text', content: 'Simple text message' },
}

// Encode to Uint8Array
const encodedBytes = encode(MyDataSchema, exampleData)
console.log('Encoded Bytes:', encodedBytes)

// Decode back to JavaScript object
const decodedObject = decode(MyDataSchema, encodedBytes)
console.log('Decoded Object:', decodedObject)
```

## Low-Level Utilities

Directly interact with binary buffers using `reader`, `read`, and `write` for fine-grained control:

```typescript
import { read, write, reader, writer, Uint8, Utf8, Bytes } from '@lickle/bin'

// Example for reading
const data: Uint8Array = new Uint8Array([
  1, 0x0b, 0x00, 0x00, 0x00, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x57, 0x6f, 0x72, 0x6c, 0x64, 0x01, 0x02, 0x03,
])

// Read a Uint8 and a Utf8 string
const [remainingReader1, myNumber, myString] = read(reader(data), Uint8, Utf8)
console.log(myNumber, myString) // Output: 1 "Hello World"

// Read a byte array from the remaining buffer
const [remainingReader2, myBytes] = read(remainingReader1, Bytes)
console.log(myBytes) // Output: Uint8Array [ 1, 2, 3 ]

// Example for writing
const myWriter = writer()
write(myWriter, Uint8, 5)
write(myWriter, Utf8, 'Hello')
const encodedData = myWriter.flush()
console.log(encodedData) // Output: Uint8Array [5, 5, 0, 0, 0, 72, 101, 108, 108, 111]
```

## License

This project is licensed under the MIT License.

MIT © [Dan Beaven](https://github.com/Pingid)
