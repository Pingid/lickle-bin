import {
  Reader,
  Writer,
  FixedSize,
  DynamicSize,
  Optional,
  Literal,
  Schema,
  BinCode,
  Infer,
  Compute,
  size,
} from './core.js'
import { ErrorCode, fail, withContext } from './error.js'

type Endian = 'le' | 'be'

/** Generic factory for fixed-size endian-aware number codecs (number) */
const numCodec =
  <S extends number>(
    bytes: S,
    getter: (v: DataView, o: number, le: boolean) => number,
    setter: (v: DataView, o: number, x: number, le: boolean) => void,
  ) =>
  (endian: Endian = 'be'): FixedSize<S, number> => {
    const le = endian === 'le'
    return {
      s: bytes,
      e: (w, v) => {
        setter(w.view, w.pos, v, le)
        w.pos += bytes
      },
      d: (r) => {
        const v = getter(r.view, r.pos, le)
        r.pos += bytes
        return v
      },
    }
  }

/** Generic factory for fixed-size endian-aware bigint codecs (bigint) */
const bigNumCodec =
  <N extends number>(
    bytes: N,
    getter: (v: DataView, o: number, le: boolean) => bigint,
    setter: (v: DataView, o: number, x: bigint, le: boolean) => void,
  ) =>
  (endian: Endian = 'be'): FixedSize<N, bigint> => {
    const le = endian === 'le'
    return {
      s: bytes,
      e: (w, v) => {
        setter(w.view, w.pos, v, le)
        w.pos += bytes
      },
      d: (r) => {
        const v = getter(r.view, r.pos, le)
        r.pos += bytes
        return v
      },
    }
  }

/** Creates a codec for an 8-bit unsigned integer. */
export const uint8 = (): FixedSize<1, number> => ({
  s: 1,
  e: (w, v) => {
    w.view.setUint8(w.pos, v)
    w.pos++
  },
  d: (r) => {
    const v = r.view.getUint8(r.pos)
    r.pos++
    return v
  },
})

/** Codec for a fixed-size 8-bit unsigned integer. */
export const Uint8: FixedSize<1, number> = uint8()

/** Creates a codec for an 8-bit signed integer. */
export const int8 = (): FixedSize<1, number> => ({
  s: 1,
  e: (w, v) => {
    w.view.setInt8(w.pos, v)
    w.pos++
  },
  d: (r) => {
    const v = r.view.getInt8(r.pos)
    r.pos++
    return v
  },
})

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

// --- Optimized String Helpers ---
const ENC = new TextEncoder()
const DEC = new TextDecoder('utf-8', { fatal: true })

// Detect Node.js environment for faster string sizing
const isNode = typeof Buffer !== 'undefined'
const strByteLen = isNode ? (s: string) => Buffer.byteLength(s) : (s: string) => ENC.encode(s).length

/** Codec for a dynamic-sized UTF-8 encoded string with max length of 2^32-1. */
export const Utf8: DynamicSize<string> = {
  s: (v) => Uint32.s + strByteLen(v),
  e: (w, v) => {
    // 1. Write Length Placeholder
    const lenPos = w.pos
    w.pos += 4

    // 2. Write String directly to buffer (EncodeInto is zero-alloc)
    const { written } = ENC.encodeInto(v, w.buf.subarray(w.pos))

    // 3. Go back and write exact length
    w.view.setUint32(lenPos, written!, false) // BE
    w.pos += written!
  },
  d: (r) => {
    const len = r.view.getUint32(r.pos, false) // BE
    r.pos += 4
    return DEC.decode(r.readBytes(len))
  },
}

/** Creates a codec for a dynamic-sized UTF-8 encoded string with max length of 2^32-1. */
export const utf8: {
  (): DynamicSize<string>
  <const O extends string = string>(p?: { maxBytes?: number }): DynamicSize<O>
  <const N extends number = number>(p: { fixed: N }): FixedSize<N, string>
  <const O extends string = string, N extends number = number>(p: { fixed: N }): FixedSize<N, O>
} = (p?: { fixed?: number; maxBytes?: number }) => {
  // 1. Fixed Size Path
  if (typeof p?.fixed === 'number') {
    const size = p.fixed
    const codec: FixedSize<number, string> = {
      s: size,
      e: (w, v) => {
        const { written } = ENC.encodeInto(v, w.buf.subarray(w.pos, w.pos + size))
        // Fill remaining with 0 if string is shorter than fixed size
        if (written! < size) w.buf.fill(0, w.pos + written!, w.pos + size)
        w.pos += size
      },
      d: (r) => DEC.decode(r.readBytes(size)).replace(/\0+$/, ''),
    }
    return codec as any
  }

  // 2. Dynamic Size Path
  const codec: DynamicSize<string> = {
    s: (v) => {
      const len = ENC.encode(v).length
      if (p?.maxBytes != null && len > p.maxBytes) {
        return fail(ErrorCode.SIZE_LIMIT, `String length ${len} exceeds limit ${p.maxBytes}`)
      }
      return Uint32.s + len
    },
    e: (w, v) => Utf8.e(w, v),
    d: (r) => {
      const n = Uint32.d(r)
      if (p?.maxBytes != null && n > p.maxBytes) {
        return fail(ErrorCode.SIZE_LIMIT, `Encoded string length ${n} exceeds limit ${p.maxBytes}`)
      }
      const bytes = r.readBytes(n)
      try {
        return DEC.decode(bytes)
      } catch {
        return fail(ErrorCode.INVALID_UTF8, 'Invalid UTF-8 sequence')
      }
    },
  }
  return codec
}

/** Creates a codec for a dynamic-sized JSON encoded string. */
export const json = <T>(): DynamicSize<T, T> => ({
  s: (v) => Uint32.s + strByteLen(JSON.stringify(v)),
  e: (w, v) => Utf8.e(w, JSON.stringify(v)),
  d: (r) => JSON.parse(Utf8.d(r)) as T,
})

/** Codec for a dynamic or fixed-size byte array. */
export const Bytes: DynamicSize<Uint8Array> = {
  s: (v) => v.length + 4,
  e: (w, v) => {
    w.view.setUint32(w.pos, v.length, false)
    w.pos += 4
    w.buf.set(v, w.pos)
    w.pos += v.length
  },
  d: (r) => {
    const len = r.view.getUint32(r.pos, false)
    r.pos += 4
    return r.readBytes(len)
  },
}

/** Creates a codec for a dynamic or fixed-size byte array. */
export const bytes: {
  (p?: { max: number }): DynamicSize<Uint8Array>
  <const N extends number = number>(p: { fixed: N }): FixedSize<N, Uint8Array>
} = (p?: { fixed?: number; max?: number }) => {
  if (typeof p?.fixed === 'number') {
    const size = p.fixed
    const codec: FixedSize<number, Uint8Array> = {
      s: size,
      e: (w, v) => {
        w.buf.set(v.subarray(0, size), w.pos)
        w.pos += size
      },
      d: (r) => r.readBytes(size),
    }
    return codec as any
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
  s: (v) => 1 + (typeof v === 'undefined' ? 0 : size(inner, v)),
  e: (w, v) => {
    if (typeof v === 'undefined') {
      w.view.setUint8(w.pos, 0)
      w.pos++
    } else {
      w.view.setUint8(w.pos, 1)
      w.pos++
      inner.e(w, v)
    }
  },
  d: (r) => {
    const exists = r.view.getUint8(r.pos) === 1
    r.pos++
    return exists ? inner.d(r) : undefined
  },
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
  return {
    s: (v) => {
      if (typeof max === 'number' && v.length > max) {
        return fail(ErrorCode.SIZE_LIMIT, `Array length ${v.length} exceeds max ${max}`)
      }
      return Uint32.s + v.reduce((a, x) => a + size(inner, x), 0)
    },

    e: (w, v) => {
      if (typeof max === 'number' && v.length > max) {
        return fail(ErrorCode.SIZE_LIMIT, `Array length ${v.length} exceeds max ${max}`)
      }
      Uint32.e(w, v.length)
      for (let i = 0; i < v.length; i++) {
        withContext(`[${i}]`, () => inner.e(w, v[i]!))
      }
    },

    d: (r) => {
      const n = Uint32.d(r)

      // 1. Check Schema constraints (Specific to this field)
      if (typeof max === 'number' && n > max) {
        return fail(ErrorCode.SIZE_LIMIT, `Array len ${n} > max ${max}`)
      }

      // 2. Check Allocation Safety (Global protection)
      r.checkList(n)

      // 3. Safe to allocate
      const out = new Array(n)
      for (let i = 0; i < n; i++) {
        out[i] = withContext(`[${i}]`, () => inner.d(r))
      }
      return out
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
    for (const key in shape) withContext(key, () => shape[key as keyof T]!.e(w, (v as any)[key]))
  },
  d: (r) => {
    const result: any = {}
    for (const key in shape) result[key] = withContext(key, () => (shape as any)[key].d(r))
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
    for (let i = 0; i < shape.length; i++) withContext(`[${i}]`, () => shape[i]!.e(w, v[i]))
  },
  d: (r) => {
    const result: any = []
    for (let i = 0; i < shape.length; i++) result.push(withContext(`[${i}]`, () => shape[i]!.d(r)))
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
      if (idx < 0) return fail(ErrorCode.INVALID_TAG, `bad tag ${String(tag)}`)
      Uint8.e(w, idx)
      shape[tag]!.e(w, value)
    },
    d: (r: Reader) => {
      const idx = Uint8.d(r)
      if (idx < 0 || idx >= keys.length) return fail(ErrorCode.INVALID_TAG, `bad tag index ${idx}`)
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

// ==========================================
// Transformers
// ==========================================

/** Validates a codec using the provided validators. */
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

type MapBin<B, D, E> =
  B extends FixedSize<infer S, any, any>
    ? FixedSize<S, D, E>
    : B extends DynamicSize<any, any>
      ? DynamicSize<D, E>
      : never

/** Maps a codec's input/output to different types. */
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
