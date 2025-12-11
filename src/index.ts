import { Writer, Reader, BinCode, Decoder, Encoder, Infer, Result, DynamicSize, size } from './core.js'
import { reader, checkedReader, writer } from './io.js'
import { Uint32, Uint16 } from './codecs.js'

export * from './core.js'
export * from './io.js'
export * from './codecs.js'

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
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) }
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
      w.write(payload.length, (b, o) => b.set(payload, o))
    },
    d: (r: Reader) => {
      if (Uint32.d(r) !== HEADER) throw new Error('Missing header')
      const ver = Uint16.d(r)
      if (ver !== 1) throw new Error(`unsupported version ${ver}`)
      const n = Uint32.d(r)
      // We must use a new reader window for the payload to ensure safety
      return inner.d(reader(r.read(n, (b, o, e) => b.subarray(o, e))))
    },
  } satisfies DynamicSize<T>
}
