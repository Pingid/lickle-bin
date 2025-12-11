import { Writer, Reader, BinCode, Decoder, Encoder, Infer, Result, DynamicSize, size } from './core.js'
import { reader, checkedReader, writer } from './io.js'
import { Uint32, Uint16 } from './codecs.js'
import { BinError, ErrorCode } from './error.js'

export * from './codecs.js'
export * from './core.js'
export * from './io.js'

/** Writes a value to a writer using the provided codec. */
export const write = <E, W extends Writer>(writer: W, codec: Encoder<E>, value: E): W => {
  codec.e(writer, value)
  return writer
}

/** Encodes a value into a Uint8Array using the provided codec. */
export const encode = <T>(bincode: BinCode<T>, value: T): Uint8Array => {
  const encoder = writer(typeof bincode.s === 'number' ? bincode.s : undefined)
  bincode.e(encoder, value)
  return encoder.flush()
}

/** Decodes a value from a Uint8Array using the provided codec. */
export const decode = <T>(bincode: BinCode<T>, value: Uint8Array): T => bincode.d(reader(value)) as T

/** Tries to decode a value from a Uint8Array using the provided codec. */
export const tryDecode = <T>(codec: Decoder<T>, data: Uint8Array): Result<T> => {
  try {
    return { ok: true, value: codec.d(checkedReader(data)) }
  } catch (e: any) {
    if (e instanceof BinError) return { ok: false, error: e }
    return { ok: false, error: new BinError(ErrorCode.UNKNOWN, e?.message ?? String(e)) }
  }
}

/** Reads a sequence of values from a reader using the provided codecs. */
export const read = <const A extends BinCode<any, any>[], R extends Reader>(
  reader: R,
  ...codes: A
): [R, ...{ [K in keyof A]: Infer<A[K]>['decode'] }] => {
  const result: any = []
  for (let i = 0; i < codes.length; i++) {
    result.push(codes[i]!.d(reader))
  }
  return [reader, ...result] as any
}

const HEADER = 0xb1_6e_c0_de >>> 0
const VERSION = 1

/** Creates an envelope for a binary message with header, version, and length prefix. */
export const envelope = <T>(inner: DynamicSize<T>) => {
  return {
    s: (v: T) => Uint32.s + Uint16.s + Uint32.s + size(inner, v),
    e: (w: Writer, v: T) => {
      Uint32.e(w, HEADER)
      Uint16.e(w, VERSION)
      const payload = encode(inner, v)
      Uint32.e(w, payload.length)
      w.write(payload.length, (view, offset) =>
        new Uint8Array(view.buffer, view.byteOffset + offset, payload.length).set(payload),
      )
    },
    d: (r: Reader) => {
      if (Uint32.d(r) !== HEADER) throw new Error('Missing header')
      const ver = Uint16.d(r)
      if (ver !== 1) throw new Error(`unsupported version ${ver}`)
      const len = Uint32.d(r)
      const payload = r.readBytes(len)
      return inner.d(reader(payload))
    },
  } satisfies DynamicSize<T>
}

// Your envelope function serializes the payload twice to calculate the length prefix.

// TypeScript

// // Current
// e: (w: Writer, v: T) => {
//   // ... writes header ...
//   const payload = encode(inner, v) // 1. Allocates a new generic writer + buffer
//   Uint32.e(w, payload.length)
//   w.write(payload.length, (b, o) => b.set(payload, o)) // 2. Copies that buffer into the main writer
// },
// This is inefficient for large payloads.

// The Fix:

// Reserve 4 bytes in the writer.

// Remember the position.

// Write the payload.

// Calculate length (currentPos - startPos).

// Go back and write the length at the reserved spot.

// Note: This requires your Writer to support random access/seeking, which your chunked-list writer currently does not easily support. You might need to change Writer to use a single pre-allocated buffer (growing if needed) to allow seeking.
