import { Writer, Reader, BinCode, Decoder, Encoder, Infer, Result, DynamicSize, size } from './core.js'
import { reader, checkedReader, writer } from './io.js'
import { BinError, ErrorCode } from './error.js'
import { Uint32, Uint16 } from './codecs.js'

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
  const len = size(bincode, value)
  const buf = new Uint8Array(len)
  const w = writer(buf)
  bincode.e(w, value)
  return buf
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
      // 1. Write Header & Version
      Uint32.e(w, HEADER)
      Uint16.e(w, VERSION)

      // 2. Reserve 4 bytes for the length prefix
      const lenPos = w.pos
      w.pos += 4

      // 3. Write payload and track position
      const startPos = w.pos
      inner.e(w, v)
      const endPos = w.pos

      // 4. Calculate actual length (End - Start)
      const length = endPos - startPos

      // 5. Backtrack: Write length at the reserved position
      // Using 'false' for Big Endian to match Uint32 codec defaults
      w.view.setUint32(lenPos, length, false)
    },
    d: (r: Reader) => {
      if (Uint32.d(r) !== HEADER) throw new Error('Missing header')
      const ver = Uint16.d(r)
      if (ver !== 1) throw new Error(`unsupported version ${ver}`)

      const len = Uint32.d(r)

      // Read exact bytes for safety (framing)
      const payload = r.readBytes(len)

      // Decode the isolated payload
      return inner.d(reader(payload))
    },
  } satisfies DynamicSize<T>
}
