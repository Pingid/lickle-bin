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
export type FixedSize<S extends number, D, E = D> = Codec<D, E> & { s: S }
/** Codec with dynamic byte size. */
export type DynamicSize<D, E = D> = Codec<D, E> & { s: (s: E) => number }
/** Codec for optional values. */
export type Optional<D, E = D> = DynamicSize<D | undefined, E | undefined> & { optional: true }
/** Codec for a literal value that is not stored in the buffer. */
export type Literal<V> = FixedSize<0, V> & { value: V }
/** Codec with schema metadata. */
export type Schema<S, D, E = D> = DynamicSize<D, E> & { schema: S }

/** Any supported codec type. */
export type BinCode<D, E = D> = FixedSize<number, D, E> | DynamicSize<D, E> | Optional<D, E>

/** Extracts codec's decoded and encoded types. */
export type Infer<T> = T extends Codec<infer D, infer E> ? { decode: D; encode: E } : never

/** Calculates the byte size of a value using its codec. */
const size = <E, N extends number = number>(codec: FixedSize<N, any, E> | DynamicSize<any, E>, value: E) =>
  (typeof codec.s === 'function' ? codec.s(value) : codec.s) as N

type Endian = 'le' | 'be'
const dv = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength)

/** Generic factory for fixed-size endian-aware number codecs (number) */
const numCodec =
  <N extends number>(
    bytes: N,
    getter: (view: DataView, offset: number, littleEndian: boolean) => number,
    setter: (view: DataView, offset: number, value: number, littleEndian: boolean) => void,
  ): FixedCodecGetter<N, number> =>
  (endian: Endian = 'be'): FixedSize<N, number> => ({
    s: bytes,
    e: (w, v) => w.write(bytes, (b, o) => setter(dv(b), o, v, endian === 'le')),
    d: (r) => r.read(bytes, (b, o) => getter(dv(b), o, endian === 'le')),
  })

type FixedCodecGetter<N extends number, V> = {
  /** Defaults to 'be' Big Endian */
  (endian?: Endian): FixedSize<N, V>
  <const O extends V = V>(endian?: Endian): FixedSize<N, O>
}

/** Generic factory for fixed-size endian-aware bigint codecs (bigint) */
const bigNumCodec =
  <N extends number>(
    bytes: N,
    getter: (view: DataView, offset: number, littleEndian: boolean) => bigint,
    setter: (view: DataView, offset: number, value: bigint, littleEndian: boolean) => void,
  ): FixedCodecGetter<N, bigint> =>
  (endian?: Endian): FixedSize<N, bigint> => ({
    s: bytes,
    e: (w, v) => w.write(bytes, (b, o) => setter(dv(b), o, v, endian === 'le')),
    d: (r) => r.read(bytes, (b, o) => getter(dv(b), o, endian === 'le')),
  })

/** Creates a codec for an 8-bit unsigned integer. */
export const uint8: FixedCodecGetter<1, number> = () =>
  numCodec(
    1,
    (v, o) => v.getUint8(o),
    (v, o, x) => v.setUint8(o, x),
  )()

/** Codec for a fixed-size 8-bit unsigned integer. */
export const Uint8: FixedSize<1, number> = uint8()

/** Creates a codec for an 8-bit signed integer. */
export const int8: FixedCodecGetter<1, number> = () =>
  numCodec(
    1,
    (v, o) => v.getInt8(o),
    (v, o, x) => v.setInt8(o, x),
  )()

/** Codec for a fixed-size 8-bit signed integer. */
export const Int8: FixedSize<1, number> = int8()

/** Creates a codec for a 16-bit unsigned integer. */
export const uint16 = numCodec(
  2,
  (v, o, le) => v.getUint16(o, le),
  (v, o, x, le) => v.setUint16(o, x, le),
)

/** Codec for a fixed-size 16-bit unsigned integer. */
export const Uint16 = uint16('be')

/** Creates a codec for a 16-bit unsigned integer. */
export const int16 = numCodec(
  2,
  (v, o, le) => v.getInt16(o, le),
  (v, o, x, le) => v.setInt16(o, x, le),
)

/** Codec for a fixed-size 16-bit unsigned integer. */
export const Int16 = int16('be')

/** Creates a codec for a 32-bit unsigned integer. */
export const uint32 = numCodec(
  4,
  (v, o, le) => v.getUint32(o, le),
  (v, o, x, le) => v.setUint32(o, x, le),
)

/** Codec for a fixed-size 32-bit unsigned integer. */
export const Uint32 = uint32('be')

/** Creates a codec for a 32-bit signed integer. */
export const int32 = numCodec(
  4,
  (v, o, le) => v.getInt32(o, le),
  (v, o, x, le) => v.setInt32(o, x, le),
)

/** Codec for a fixed-size 32-bit signed integer. */
export const Int32 = int32('be')

/** Creates a codec for a 32-bit signed integer. */
export const float32 = numCodec(
  4,
  (v, o, le) => v.getFloat32(o, le),
  (v, o, x, le) => v.setFloat32(o, x, le),
)

/** Codec for a fixed-size 32-bit signed integer. */
export const Float32 = float32('be')

/** Creates a codec for a 32-bit signed integer. */
export const float64 = numCodec(
  8,
  (v, o, le) => v.getFloat64(o, le),
  (v, o, x, le) => v.setFloat64(o, x, le),
)

/** Codec for a fixed-size 32-bit signed integer. */
export const Float64 = float64('be')

/** Creates a codec for a 64-bit signed BigInt. */
export const bigUint64 = bigNumCodec(
  8,
  (v, o, le) => v.getBigUint64(o, le),
  (v, o, x, le) => v.setBigUint64(o, x, le),
)

/** Codec for a fixed-size 64-bit unsigned BigInt. */
export const BigUint64 = bigUint64('be')

/** Creates a codec for a 64-bit signed BigInt. */
export const bigInt64 = bigNumCodec(
  8,
  (v, o, le) => v.getBigInt64(o, le),
  (v, o, x, le) => v.setBigInt64(o, x, le),
)

/** Creates a codec for a 64-bit unsigned BigInt. */
export const BigInt64 = bigInt64('be')

/** Codec for a boolean value, encoded as a single byte. */
export const Bool: FixedSize<1, boolean> = {
  s: Uint8.s,
  e: (w, v) => Uint8.e(w, v ? 1 : 0),
  d: (r) => Uint8.d(r) === 1,
}
/** Creates a codec for a boolean value. */
export const bool = (): FixedSize<1, boolean> => Bool

const ENC = new TextEncoder()
const DEC = new TextDecoder('utf-8', { fatal: true })

/** Codec for a dynamic-sized UTF-8 encoded string with max length of 2^32-1. */
export const Utf8: DynamicSize<string> = {
  s: (v) => ENC.encode(v).length + Uint32.s,
  e: (w, v) => {
    const enc = ENC.encode(v)
    Uint32.e(w, enc.length)
    w.write(enc.length, (b, o) => b.set(enc, o))
  },
  d: (r) => r.read(Uint32.d(r), (b, o, e) => DEC.decode(b.slice(o, e))),
}

/** Creates a codec for a dynamic-sized UTF-8 encoded string with max length of 2^32-1. */
export const utf8: {
  (): DynamicSize<string>
  <const O extends string = string>(p?: { maxBytes?: number }): DynamicSize<O>
  <const N extends number = number>(p: { fixed: N }): FixedSize<N, string>
  <const O extends string = string, N extends number = number>(p: { fixed: N }): FixedSize<N, O>
} = (p?: { fixed?: number; maxBytes?: number }) => {
  if (typeof p?.fixed === 'number') {
    const tp: FixedSize<number, string> = {
      s: p.fixed,
      e: (w, v) => w.write(p.fixed!, (b, o) => b.set(ENC.encode(v), o)),
      d: (r) => r.read(p.fixed!, (b, o) => DEC.decode(b.slice(o, o + p.fixed!)).replace(/\0+$/, '')),
    }
    return tp as any
  }
  const codec: DynamicSize<string> = {
    s: (v) => {
      const enc = ENC.encode(v)
      if (p?.maxBytes != null && enc.length > p.maxBytes) throw new Error(`utf8 too long: ${enc.length}`)
      return Uint32.s + enc.length
    },
    e: (w, v) => {
      const enc = ENC.encode(v)
      if (p?.maxBytes != null && enc.length > p.maxBytes) throw new Error(`utf8 too long: ${enc.length}`)
      Uint32.e(w, enc.length)
      w.write(enc.length, (b, o) => b.set(enc, o))
    },
    d: (r) => {
      const n = Uint32.d(r)
      if (p?.maxBytes != null && n > p.maxBytes) throw new Error(`utf8 length ${n} > max ${p.maxBytes}`)
      return r.read(n, (b, o, e) => new TextDecoder('utf-8', { fatal: true }).decode(b.slice(o, e)))
    },
  }
  return codec
}

/** Creates a codec for a dynamic-sized JSON encoded string. */
export const json = <T>(): DynamicSize<T, T> => ({
  s: (v) => ENC.encode(JSON.stringify(v)).length + Uint32.s,
  e: (w, v) => Utf8.e(w, JSON.stringify(v)),
  d: (r) => JSON.parse(Utf8.d(r)) as T,
})

/** Codec for a dynamic or fixed-size byte array. */
export const Bytes: DynamicSize<Uint8Array> = {
  s: (v) => v.length + Uint32.s,
  e: (w, v) => (Uint32.e(w, v.length), w.write(v.length, (b, o) => b.set(v, o))),
  d: (r) => r.read(Uint32.d(r), (b, o, e) => b.slice(o, e)),
}

/** Creates a codec for a dynamic or fixed-size byte array. */
export const bytes: {
  (p?: { max: number }): DynamicSize<Uint8Array>
  <const N extends number = number>(p: { fixed: N }): FixedSize<N, Uint8Array>
} = (p?: { fixed?: number; max?: number }) => {
  if (typeof p?.fixed === 'number') {
    const tp: FixedSize<number, Uint8Array> = {
      s: p.fixed!,
      e: (w, v) => w.write(p.fixed!, (b, o) => b.set(v, o)),
      d: (r) => r.read(p.fixed!, (b, o, e) => b.slice(o, e)),
    }
    return tp as any
  }
  const max = p?.max
  if (typeof max !== 'number') return Bytes
  const codec: DynamicSize<Uint8Array> = {
    s: (v) => {
      if (v.length > max) throw new Error(`bytes too long`)
      return Uint32.s + v.length
    },
    e: (w, v) => {
      if (v.length > max) throw new Error(`bytes too long`)
      Uint32.e(w, v.length)
      w.write(v.length, (b, o) => b.set(v, o))
    },
    d: (r) => {
      const n = Uint32.d(r)
      if (n > max!) throw new Error(`bytes length ${n} > max ${max!}`)
      return r.read(n, (b, o, e) => b.slice(o, e))
    },
  }
  return codec
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
export const array = <D, E = D>(inner: BinCode<D, E>, options?: { maxLength?: number }): DynamicSize<D[], E[]> => {
  const max = options?.maxLength
  if (typeof max === 'number') {
    return {
      s: (v) => {
        if (v.length > max) throw new Error('array too long')
        return Uint32.s + v.reduce((a, x) => a + size(inner, x), 0)
      },
      e: (w, v) => {
        if (v.length > max) throw new Error('array too long')
        Uint32.e(w, v.length)
        for (const x of v) inner.e(w, x)
      },
      d: (r) => {
        const n = Uint32.d(r)
        if (n > max) throw new Error(`array len ${n} > ${max}`)
        const out = new Array(n)
        for (let i = 0; i < n; i++) out[i] = inner.d(r)
        return out
      },
    }
  }
  return {
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
  }
}

type StructDecode<O> = Compute<
  {
    -readonly [K in keyof O as O[K] extends Optional<any> ? K : never]?: Infer<O[K]>['decode']
  } & { -readonly [K in keyof O as O[K] extends Optional<any> ? never : K]: Infer<O[K]>['decode'] }
>
type StructEncode<O> = Compute<
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
): Schema<{ [K in keyof S]: Optional<Infer<S[K]>['encode'], Infer<S[K]>['decode']> }, Partial<D>, Partial<E>> =>
  struct(Object.fromEntries(Object.entries(inner.schema).map(([key, value]) => [key, optional(value)]))) as any

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never

/** Creates a codec for the intersection of multiple struct schemas. */
export const intersection = <T extends Schema<Record<string, any>, any, any>[]>(
  schemas: T,
): Schema<
  Compute<UnionToIntersection<T[number]['schema']>>,
  StructDecode<Compute<UnionToIntersection<T[number]['schema']>>>,
  StructEncode<Compute<UnionToIntersection<T[number]['schema']>>>
> => {
  return struct(Object.fromEntries(schemas.map((s) => Object.entries(s.schema)).flat())) as any
}

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
    s: (v: any) => Uint8.s + size(shape[v[0] as keyof T]!, v[1]),
    e: (w: Writer, [tag, value]: [keyof T, any]) => {
      const idx = keys.indexOf(tag)
      if (idx < 0) throw new Error(`bad tag ${String(tag)}`)
      Uint8.e(w, idx)
      shape[tag]!.e(w, value)
    },
    d: (r: Reader) => {
      const idx = Uint8.d(r)
      if (idx < 0 || idx >= keys.length) throw new Error(`bad tag index ${idx}`)
      const key = keys[idx]!
      return [key, (shape as any)[key].d(r)]
    },
  }
}

/** Creates a codec for a discriminated union, prefixed by a byte indicating the type. */
export const discriminatedUnion = <T extends string, S extends Schema<{ [K in T]: Literal<any> }, any, any>[]>(
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

const HEADER = 0xb1_6e_c0_de >>> 0
const VERSION = 1
/** Creates an envelope for a binary message. */
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
      return inner.d(reader(r.read(n, (b, o, e) => b.slice(o, e))))
    },
  } satisfies DynamicSize<T>
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

/** Creates reader that first checks that there are enough bytes for parsing binary data from a Uint8Array. */
export const checkedReader = (buf: Uint8Array, offset = 0) => {
  let pos = offset
  const ensure = (n: number) => {
    if (pos + n > buf.length) throw new Error(`Out of bounds: need ${n} at ${pos}, len=${buf.length}`)
  }
  const r: Reader & Cursor = {
    buf,
    pos,
    read<T>(size: number, fn: (b: Uint8Array, o: number, e: number) => T) {
      ensure(size)
      const out = fn(buf, pos, pos + size)
      pos += size
      r.pos = pos
      return out
    },
  }
  return r
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

/** Decodes a value from a Uint8Array using the provided codec. */
export const decode = <T>(bincode: BinCode<T>, value: Uint8Array): T => bincode.d(reader(value)) as T

/** Tries to decode a value from a Uint8Array using the provided codec. */
export const tryDecode = <T>(codec: Decoder<T>, data: Uint8Array): Result<T> => {
  try {
    return { ok: true, value: codec.d(checkedReader(data)) }
  } catch (e: any) {
    return err(e?.message ?? String(e))
  }
}

export type Ok<T> = { ok: true; value: T }
export type Err = { ok: false; error: Error }
export type Result<T> = Ok<T> | Err
const err = (m: string): Err => ({ ok: false, error: new Error(m) })

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

/** Writes a value to a writer using the provided codec. */
export const write = <E, W extends Writer>(writer: W, codec: Encoder<E>, value: E): W => {
  codec.e(writer, value)
  return writer
}

/** Encodes a value into a Uint8Array using the provided codec. */
export const encode = <T>(bincode: BinCode<T>, value: T): Uint8Array => {
  const encoder = writer()
  bincode.e(encoder, value)
  return encoder.flush()
}

/** Enforce constraints before encode and/or after decode. */
export type Validators<D, E> = {
  /** run before encode */
  pre?: (value: E) => void
  /** run after decode */
  post?: (value: D) => void
}

/** Validates a codec using the provided validators.
 * @example
 * const NonEmptyUtf8 = validate(
 *   utf8(),
 *   (s) => { if (!s.length) throw new Error('empty string') },
 *   (s) => { if (!s.length) throw new Error('decoded empty string') },
 * )
 */
export const validate = <B extends BinCode<any, any>>(
  codec: B,
  pre?: (value: Infer<B>['encode']) => void,
  post?: (value: Infer<B>['decode']) => void,
): B => ({
  ...codec,
  e: (w, value) => {
    if (pre) pre(value)
    codec.e(w, value)
  },
  d: (r) => {
    const out = codec.d(r)
    if (post) post(out)
    return out
  },
})

/** Validates a codec using the provided validators.
 * @example
 * const UserJson = map(Utf8, (v: User) => JSON.stringify(v), (v) => UserSchema.parse(JSON.parse(v)))
 */
export const map = <D, E, B extends BinCode<any, any>>(
  codec: B,
  encode: (value: E) => Infer<B>['encode'],
  decode: (value: Infer<B>['decode']) => D,
): MapBin<B, D, E> =>
  ({
    ...codec,
    e: (w, value) => codec.e(w, encode(value)),
    d: (r) => decode(codec.d(r)),
  }) as BinCode<any, any> as any

type MapBin<B, D, E> =
  B extends FixedSize<infer S, any, any>
    ? FixedSize<S, D, E>
    : B extends DynamicSize<any, any>
      ? DynamicSize<D, E>
      : never
