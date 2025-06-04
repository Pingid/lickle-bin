/** Flattens a type for readability. */
export type Compute<T> = { [K in keyof T]: T[K] } & {}

/** A buffer with a position pointer. */
export type Cursor = { buf: Uint8Array; pos: number }
/** Writes bytes to a buffer. */
export type Writer = { write: (size: number, fn: (buffer: Uint8Array, offset: number) => void) => void }
/** Reads bytes from a buffer. */
export type Reader = { read: <R>(size: number, fn: (buffer: Uint8Array, offset: number, end: number) => R) => R }

/** Encodes a value. */
export type Encoder<E> = { e: (writer: Writer, value: E) => void }
/** Decodes a value. */
export type Decoder<D> = { d: (reader: Reader) => D }

/** Combined encoder/decoder. */
export type Codec<D, E = D> = Decoder<D> & Encoder<E>

/** Codec with fixed byte size. */
export type FizedSize<S extends number, D, E = D> = Codec<D, E> & { s: S }
/** Codec with dynamic byte size. */
export type DynamicSize<D, E = D> = Codec<D, E> & { s: (s: E) => number }
/** Codec for optional values. */
export type Optional<D, E = D> = DynamicSize<D | undefined, E | undefined> & { optional: true }
/** Codec for a literal value that is not stored in the buffer. */
export type Literal<V> = FizedSize<0, V> & { value: V }
/** Codec with schema metadata. */
export type Schema<S, D, E = D> = DynamicSize<D, E> & { schema: S }

/** Any supported codec type. */
export type BinCode<D, E = D> = FizedSize<number, D, E> | DynamicSize<D, E> | Optional<D, E>

/** Extracts codec's decoded and encoded types. */
export type Infer<T> = T extends Codec<infer D, infer E> ? { decode: D; encode: E } : never

/** Calculates the byte size of a value using its codec. */
const size = <E, N extends number = number>(codec: FizedSize<N, any, E> | DynamicSize<any, E>, value: E) =>
  (typeof codec.s === 'function' ? codec.s(value) : codec.s) as N

/** Codec for a fixed-size 8-bit unsigned integer. */
export const Uint8: FizedSize<1, number> = {
  s: 1,
  e: (w, v) => w.write(Uint8.s, (b, o) => new DataView(b.buffer).setUint8(o, v)),
  d: (r) => r.read(Uint8.s, (b, o) => new DataView(b.buffer).getUint8(o)),
}

/** Creates a codec for an 8-bit unsigned integer. */
export const uint8: {
  (): FizedSize<1, number>
  <const O extends number = number>(): FizedSize<1, O>
} = () => Uint8

/** Codec for a fixed-size 16-bit unsigned integer. */
export const Uint16: FizedSize<2, number> = {
  s: 2,
  e: (w, v) => w.write(Uint16.s, (b, o) => new DataView(b.buffer).setUint16(o, v)),
  d: (r) => r.read(Uint16.s, (b, o) => new DataView(b.buffer).getUint16(o)),
}
/** Creates a codec for a 16-bit unsigned integer. */
export const uint16: {
  (): FizedSize<2, number>
  <const O extends number = number>(): FizedSize<2, O>
} = () => Uint16

/** Codec for a fixed-size 32-bit unsigned integer. */
export const Uint32: FizedSize<4, number> = {
  s: 4,
  e: (w, v) => w.write(Uint32.s, (b, o) => new DataView(b.buffer).setUint32(o, v)),
  d: (r) => r.read(Uint32.s, (b, o) => new DataView(b.buffer).getUint32(o)),
}
/** Creates a codec for a 32-bit unsigned integer. */
export const uint32: {
  (): FizedSize<4, number>
  <const O extends number = number>(): FizedSize<4, O>
} = () => Uint32

/** Codec for a fixed-size 8-bit signed integer. */
export const Int8: FizedSize<1, number> = {
  s: 1,
  e: (w, v) => w.write(Int8.s, (b, o) => new DataView(b.buffer).setInt8(o, v)),
  d: (r) => r.read(Int8.s, (b, o) => new DataView(b.buffer).getInt8(o)),
}
/** Creates a codec for an 8-bit signed integer. */
export const int8: {
  (): FizedSize<1, number>
  <const O extends number = number>(): FizedSize<1, O>
} = () => Int8

/** Codec for a fixed-size 16-bit signed integer. */
export const Int16: FizedSize<2, number> = {
  s: 2,
  e: (w, v) => w.write(Int16.s, (b, o) => new DataView(b.buffer).setInt16(o, v)),
  d: (r) => r.read(Int16.s, (b, o) => new DataView(b.buffer).getInt16(o)),
}
/** Creates a codec for a 16-bit signed integer. */
export const int16: {
  (): FizedSize<2, number>
  <const O extends number = number>(): FizedSize<2, O>
} = () => Int16

/** Codec for a fixed-size 32-bit signed integer. */
export const Int32: FizedSize<4, number> = {
  s: 4,
  e: (w, v) => w.write(Int32.s, (b, o) => new DataView(b.buffer).setInt32(o, v)),
  d: (r) => r.read(Int32.s, (b, o) => new DataView(b.buffer).getInt32(o)),
}
/** Creates a codec for a 32-bit signed integer. */
export const int32: {
  (): FizedSize<4, number>
  <const O extends number = number>(): FizedSize<4, O>
} = () => Int32

/** Codec for a fixed-size 32-bit float. */
export const Float32: FizedSize<4, number> = {
  s: 4,
  e: (w, v) => w.write(Float32.s, (b, o) => new DataView(b.buffer).setFloat32(o, v)),
  d: (r) => r.read(Float32.s, (b, o) => new DataView(b.buffer).getFloat32(o)),
}
/** Creates a codec for a 32-bit float. */
export const float32: {
  (): FizedSize<4, number>
  <const O extends number = number>(): FizedSize<4, O>
} = () => Float32

/** Codec for a fixed-size 64-bit float. */
export const Float64: FizedSize<8, number> = {
  s: 8,
  e: (w, v) => w.write(Float64.s, (b, o) => new DataView(b.buffer).setFloat64(o, v)),
  d: (r) => r.read(Float64.s, (b, o) => new DataView(b.buffer).getFloat64(o)),
}
/** Creates a codec for a 64-bit float. */
export const float64: {
  (): FizedSize<8, number>
  <const O extends number = number>(): FizedSize<8, O>
} = () => Float64

/** Codec for a fixed-size 64-bit signed BigInt. */
export const BigInt64: FizedSize<8, bigint> = {
  s: 8,
  e: (w, v) => w.write(BigInt64.s, (b, o) => new DataView(b.buffer).setBigInt64(o, v)),
  d: (r) => r.read(BigInt64.s, (b, o) => new DataView(b.buffer).getBigInt64(o)),
}
/** Creates a codec for a 64-bit signed BigInt. */
export const bigInt64: {
  (): FizedSize<8, bigint>
  <const O extends bigint = bigint>(): FizedSize<8, O>
  (p: { cast: 'number' }): FizedSize<8, number>
  <const O extends number>(p: { cast: 'number' }): FizedSize<8, O>
} = (p?: { cast?: 'number' }) => {
  if (p?.cast === 'number') {
    const tp: FizedSize<8, number> = {
      s: 8,
      e: (w, v) => w.write(BigInt64.s, (b, o) => new DataView(b.buffer).setBigInt64(o, BigInt(v))),
      d: (r) => r.read(BigInt64.s, (b, o) => Number(new DataView(b.buffer).getBigInt64(o))),
    }
    return tp as any
  }
  return BigInt64
}

/** Codec for a fixed-size 64-bit unsigned BigInt. */
export const BigUint64: FizedSize<8, bigint> = {
  s: 8,
  e: (w, v) => w.write(BigUint64.s, (b, o) => new DataView(b.buffer).setBigUint64(o, v)),
  d: (r) => r.read(BigUint64.s, (b, o) => new DataView(b.buffer).getBigUint64(o)),
}
/** Creates a codec for a 64-bit unsigned BigInt. */
export const bigUint64: {
  (): FizedSize<8, bigint>
  <const O extends bigint = bigint>(): FizedSize<8, O>
  (p: { cast: 'number' }): FizedSize<8, number>
  <const O extends number>(p: { cast: 'number' }): FizedSize<8, O>
} = (p?: { cast?: 'number' }) => {
  if (p?.cast === 'number') {
    const tp: FizedSize<8, number> = {
      s: 8,
      e: (w, v) => w.write(BigUint64.s, (b, o) => new DataView(b.buffer).setBigUint64(o, BigInt(v))),
      d: (r) => r.read(BigUint64.s, (b, o) => Number(new DataView(b.buffer).getBigUint64(o))),
    }
    return tp as any
  }
  return BigUint64
}

/** Codec for a boolean value, encoded as a single byte. */
export const Bool: FizedSize<1, boolean> = {
  s: Uint8.s,
  e: (w, v) => Uint8.e(w, v ? 1 : 0),
  d: (r) => Uint8.d(r) === 1,
}
/** Creates a codec for a boolean value. */
export const bool = (): FizedSize<1, boolean> => Bool

/** Codec for a dynamic-sized UTF-8 encoded string with max length of 2^32-1. */
export const Utf8: DynamicSize<string> = {
  s: (v) => new TextEncoder().encode(v).length + Uint32.s,
  e: (w, v) => {
    Uint32.e(w, v.length)
    w.write(v.length, (b, o) => b.set(new TextEncoder().encode(v), o))
  },
  d: (r) => r.read(Uint32.d(r), (b, o, e) => new TextDecoder().decode(b.slice(o, e))),
}

/** Creates a codec for a dynamic-sized UTF-8 encoded string with max length of 2^32-1. */
export const utf8: {
  (): DynamicSize<string>
  <const O extends string = string>(): DynamicSize<O>
  <const N extends number = number>(p: { fixed: N }): FizedSize<N, string>
  <const O extends string = string, N extends number = number>(p: { fixed: N }): FizedSize<N, O>
} = (p?: { fixed?: number }) => {
  if (typeof p?.fixed === 'number') {
    const tp: FizedSize<number, string> = {
      s: p.fixed,
      e: (w, v) => w.write(p.fixed!, (b, o) => b.set(new TextEncoder().encode(v), o)),
      d: (r) => r.read(p.fixed!, (b, o) => new TextDecoder().decode(b.slice(o, o + p.fixed!)).replace(/\0+$/, '')),
    }
    return tp as any
  }
  return Utf8
}

/** Creates a codec for a dynamic-sized JSON encoded string. */
export const json = <T>(): DynamicSize<T, T> => ({
  s: (v) => new TextEncoder().encode(JSON.stringify(v)).length + Uint32.s,
  e: (w, v) => {
    const str = JSON.stringify(v)
    Uint32.e(w, str.length)
    w.write(str.length, (b, o) => b.set(new TextEncoder().encode(str), o))
  },
  d: (r) => r.read(Uint32.d(r), (b, o, e) => JSON.parse(new TextDecoder().decode(b.slice(o, e)))),
})

/** Codec for a dynamic or fixed-size byte array. */
export const Bytes: DynamicSize<Uint8Array> = {
  s: (v) => v.length + Uint32.s,
  e: (w, v) => (Uint32.e(w, v.length), w.write(v.length, (b, o) => b.set(v, o))),
  d: (r) => r.read(Uint32.d(r), (b, o, e) => b.slice(o, e)),
}

/** Creates a codec for a dynamic or fixed-size byte array. */
export const bytes: {
  (): DynamicSize<Uint8Array>
  <const N extends number = number>(p: { fixed: N }): FizedSize<N, Uint8Array>
} = (p?: { fixed?: number }) => {
  if (typeof p?.fixed === 'number') {
    const tp: FizedSize<number, Uint8Array> = {
      s: p.fixed!,
      e: (w, v) => w.write(p.fixed!, (b, o) => b.set(v, o)),
      d: (r) => r.read(p.fixed!, (b, o, e) => b.slice(o, e)),
    }
    return tp as any
  }
  return Bytes
}

/** Creates a zero-sized codec for a literal value that is not stored in the buffer. */
export const literal = <const O>(value: O): Literal<O> => ({
  s: 0,
  e: () => {},
  d: () => value,
  value,
})

/** Wraps a codec to make its value optional, prefixed by a byte indicating presence. */
export const optional = <D, E = D>(inner: BinCode<D, E>): Optional<D, E> => ({
  optional: true,
  e: (w, v) => {
    if (typeof v === 'undefined') return Uint8.e(w, 0)
    Uint8.e(w, 1)
    return inner.e(w, v)
  },
  d: (r) => (Uint8.d(r) === 0 ? undefined : inner.d(r)),
  s: (v) => Uint8.s + (typeof v === 'undefined' ? 0 : size(inner, v)),
})

/** Wraps a codec to make its value nullable, prefixed by a byte indicating presence. */
export const nullable = <D, E = D>(inner: BinCode<D, E>): DynamicSize<D | null, E | null> => ({
  e: (w, v) => {
    if (v === null) return Uint8.e(w, 0)
    Uint8.e(w, 1)
    return inner.e(w, v)
  },
  d: (r) => (Uint8.d(r) === 0 ? null : inner.d(r)!),
  s: (v) => Uint8.s + (v === null ? 0 : size(inner, v)),
})

/** Creates a codec for an array of items, prefixed by the array's length. */
export const array = <D, E = D>(inner: BinCode<D, E>): DynamicSize<D[], E[]> => ({
  s: (v) => Uint32.s + v.reduce((acc, item) => acc + size(inner, item), 0),
  e: (w, v) => {
    Uint32.e(w, v.length)
    for (const item of v) inner.e(w, item)
  },
  d: (r) => {
    const results = new Array(Uint32.d(r))
    for (let i = 0; i < results.length; i++) results[i] = inner.d(r)
    return results
  },
})

type StructDecode<O extends Record<string, BinCode<any>>> = Compute<
  {
    -readonly [K in keyof O as O[K] extends Optional<any> ? K : never]?: Infer<O[K]>['decode']
  } & { -readonly [K in keyof O as O[K] extends Optional<any> ? never : K]: Infer<O[K]>['decode'] }
>
type StructEncode<O extends Record<string, BinCode<any>>> = Compute<
  {
    -readonly [K in keyof O as O[K] extends Optional<any> ? K : never]?: Infer<O[K]>['encode']
  } & { -readonly [K in keyof O as O[K] extends Optional<any> ? never : K]: Infer<O[K]>['encode'] }
>
/** Creates a codec for an object from a shape of codecs. */
export const struct = <const T extends Record<string, BinCode<any>>>(
  shape: T,
): Schema<T, StructDecode<T>, StructEncode<T>> => ({
  schema: shape,
  s: (v) => Object.keys(shape).reduce((acc, key) => acc + size(shape[key as keyof T]!, (v as any)[key]), 0),
  e: (w, v) => {
    for (const key in shape) shape[key as keyof T]!.e(w, (v as any)[key])
  },
  d: (r) => {
    const result: any = {}
    for (const key in shape) result[key] = (shape as any)[key].d(r)
    return result
  },
})

/** Creates a codec for a partial object, where some fields may be missing. */
export const partial = <S extends Record<string, any>, D, E = D>(
  inner: Schema<S, D, E>,
): Schema<
  { [K in keyof S]: BinCode<Infer<S[K]>['encode'] | undefined, Infer<S[K]>['decode'] | undefined> },
  Partial<D>,
  Partial<E>
> => struct(Object.fromEntries(Object.entries(inner.schema).map(([key, value]) => [key, optional(value)]))) as any

/** Creates a codec for a fixed-length array with elements of specific types. */
export const tuple = <const T extends BinCode<any>[]>(
  ...shape: T
): Schema<T, { [K in keyof T]: Infer<T[K]>['decode'] }, { [K in keyof T]: Infer<T[K]>['encode'] }> => ({
  schema: shape,
  s: (v) => v.reduce((acc, item, i) => acc + size(shape[i]!, item), 0),
  e: (w, v) => {
    for (let i = 0; i < shape.length; i++) shape[i]!.e(w, v[i])
  },
  d: (r) => {
    const result: any = []
    for (let i = 0; i < shape.length; i++) result.push(shape[i]!.d(r))
    return result
  },
})

/** Creates a codec for a tagged union, prefixed by a byte indicating the type. */
export function taggedUnion<const T extends Record<string, BinCode<any>>>(
  shape: T,
): Schema<
  T,
  { [K in keyof T]: [K, Infer<T[K]>['decode']] }[keyof T],
  { [K in keyof T]: [K, Infer<T[K]>['encode']] }[keyof T]
> {
  const keys = Object.keys(shape) as (keyof T)[]
  return {
    schema: shape,
    s: (v) => Uint8.s + size(shape[v[0] as keyof T]!, v[1]),
    e: (w, [tag, value]) => {
      Uint8.e(w, keys.indexOf(tag as keyof T))
      shape[tag as keyof T]!.e(w, value)
    },
    d: (r) => {
      const tag = Uint8.d(r)
      return [keys[tag]!, shape[keys[tag]!]!.d(r)]
    },
  }
}

/** Creates a codec for a discriminated union, prefixed by a byte indicating the type. */
export const descriminatedUnion = <T extends string, S extends Schema<{ [K in T]: Literal<any> }, any, any>[]>(
  tag: T,
  schema: S,
): Schema<S, Infer<S[number]>['decode'], Infer<S[number]>['encode']> => {
  const keys = schema.map((s) => s.schema[tag].value)
  return {
    schema,
    s: (v) => {
      const idx = keys.indexOf((v as any)[tag])
      return Uint8.s + size(schema[idx]!, v)
    },
    e: (w, v) => {
      const idx = keys.indexOf((v as any)[tag])
      Uint8.e(w, idx)
      schema[idx]!.e(w, v)
    },
    d: (r) => schema[Uint8.d(r)]!.d(r),
  }
}

/** Creates a writer for assembling binary data, either fixed-size or dynamic. */
export const writer = (size?: number): Writer & { flush: () => Uint8Array } => {
  if (typeof size === 'number') {
    let buf = new Uint8Array(size)
    let pos = 0
    return {
      write: (size, fn: (buffer: Uint8Array, o: number, e: number) => void) => {
        fn(buf, pos, pos + size)
        pos += size
      },
      flush: () => buf,
    }
  }
  const bufs: Uint8Array[] = []
  let len = 0
  return {
    write(size, fn: (buffer: Uint8Array, o: number, e: number) => void) {
      const chunk = new Uint8Array(size)
      fn(chunk, 0, size)
      bufs.push(chunk)
      len += size
    },
    flush() {
      const out = new Uint8Array(len)
      let offset = 0
      for (const buf of bufs) {
        out.set(buf, offset)
        offset += buf.length
      }
      return out
    },
  }
}

/** Creates a reader for parsing binary data from a Uint8Array. */
export const reader = (buf: Uint8Array, offset: number = 0): Reader & Cursor => ({
  buf,
  pos: offset,
  read<T>(size: number, fn: (buffer: Uint8Array, o: number, e: number) => T) {
    const t = fn(this.buf, this.pos, this.pos + size)
    this.pos += size
    return t
  },
})

/** Encodes a value into a Uint8Array using the provided codec. */
export const encode = <T>(bincode: BinCode<T>, value: T): Uint8Array => {
  const encoder = writer()
  bincode.e(encoder, value)
  return encoder.flush()
}

/** Decodes a value from a Uint8Array using the provided codec. */
export const decode = <T>(bincode: BinCode<T>, value: Uint8Array): T => bincode.d(reader(value)) as T

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

/** Writes a value to a writer using the provided codec. */
export const write = <E, W extends Writer>(writer: W, codec: Encoder<E>, value: E): W => {
  codec.e(writer, value)
  return writer
}
