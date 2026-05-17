import * as T from './types.js'
import * as Bin from './bin.js'

import { traceChild } from './rw.js'

/** 1-byte boolean */
export const bool = (): T.Sized<boolean, boolean, 1> => Bin._bool
/** 1-byte unsigned integer */
export const uint8 = (): T.Sized<number, number, 1> => Bin._u8c
/** 1-byte signed integer */
export const int8 = (): T.Sized<number, number, 1> => Bin._i8c
/** 2-byte unsigned integer */
export const uint16 = (le?: boolean): T.Sized<number, number, 2> => (le ? Bin._u16Le : Bin._u16Be)
/** 2-byte signed integer */
export const int16 = (le?: boolean): T.Sized<number, number, 2> => (le ? Bin._i16Le : Bin._i16Be)
/** 4-byte unsigned integer */
export const uint32 = (le?: boolean): T.Sized<number, number, 4> => (le ? Bin._u32Le : Bin._u32Be)
/** 4-byte signed integer */
export const int32 = (le?: boolean): T.Sized<number, number, 4> => (le ? Bin._i32Le : Bin._i32Be)
/** 4-byte float */
export const float32 = (le?: boolean): T.Sized<number, number, 4> => (le ? Bin._f32Le : Bin._f32Be)
/** 8-byte signed integer */
export const bigInt64 = (le?: boolean): T.Sized<bigint, bigint, 8> => (le ? Bin._bi64Le : Bin._bi64Be)
/** 8-byte unsigned integer */
export const bigUint64 = (le?: boolean): T.Sized<bigint, bigint, 8> => (le ? Bin._bu64Le : Bin._bu64Be)
/** 8-byte float */
export const float64 = (le?: boolean): T.Sized<number, number, 8> => (le ? Bin._f64Le : Bin._f64Be)
/** LEB128, 1–5 bytes */
export const varint = (): T.Codec<number> => Bin._varint

type LenOpt = { length?: T.Codec<number> }
/** Length-prefixed bytes; pass `{ size }` for fixed-width, `{ pad: true }` to zero-pad shorter inputs. */
export const bytes: {
  (): T.Codec<Uint8Array>
  <const N extends number = number>(p: { size: N; pad?: boolean }): T.Sized<Uint8Array, Uint8Array, N>
  (p: LenOpt): T.Codec<Uint8Array>
} = (p?: { size?: number; pad?: boolean } & LenOpt) => {
  if (typeof p?.size === 'number') return Bin._sizedBytes(p.size, p.pad)
  return Bin._lpBytes(p?.length ?? varint()) as any
}

/** UTF-8 string codec; pass `{ size }` for fixed-width, `{ pad: true }` to zero-pad shorter inputs. */
export const utf8: {
  (): T.Codec<string>
  <const T extends string = string>(): T.Codec<T>
  <const N extends number = number>(p: { size: N; pad?: boolean }): T.Sized<string, string, N>
  <const T extends string = string, N extends number = number>(p: { size: N; pad?: boolean }): T.Sized<T, T, N>
  (p: LenOpt): T.Codec<string>
} = (p?: { size?: number; pad?: boolean } & LenOpt) => {
  if (typeof p?.size === 'number') return Bin._sizedUtf8(p.size, p.pad)
  return Bin._lpUtf8(p?.length ?? varint()) as any
}

/** Zero-byte codec that always decodes to `value`; useful as a tag in `tagged`. */
export const literal = <const O>(value: O): T.Literal<O> => ({ s: 0, e: Bin.noop, d: () => value, value })

/** Wraps `inner` with a 1-byte presence prefix; missing fields are encoded as 0 and decoded as `undefined`. */
export const optional: {
  <D, E = D>(inner: T.Codec<D, E>): T.Opt & T.Codec<D | undefined, E | undefined>
} = <D, E = D>(inner: T.Codec<D, E>) => {
  const c: any = { optional: true }
  const ins = Bin._sz(inner)
  if (ins > 0) {
    c.e = (w: T.Writer, v: D | undefined) => {
      if (typeof v === 'undefined') return Bin._wu8(w, 0)
      Bin._wPresent(w, ins)
      inner.e(w, v as E)
    }
    c.d = (r: T.Reader) => {
      if (Bin.ru8(r) === 0) return undefined
      r.expected(ins)
      return inner.d(r)
    }
  } else {
    c.e = (w: T.Writer, v: D | undefined) =>
      typeof v === 'undefined' ? Bin._wu8(w, 0) : (Bin._wu8(w, 1), inner.e(w, v as E))
    c.d = (r: T.Reader) => (Bin.ru8(r) === 0 ? undefined : inner.d(r))
  }
  return c
}

/** Wraps `inner` with a 1-byte presence prefix; `null` is encoded as 0. */
export const nullable = <D, E = D>(inner: T.Codec<D, E>): T.Codec<D | null, E | null> => {
  const c: any = {}
  const ins = Bin._sz(inner)
  if (ins > 0) {
    c.e = (w: T.Writer, v: D | E | null) => {
      if (v === null) return Bin._wu8(w, 0)
      Bin._wPresent(w, ins)
      inner.e(w, v as E)
    }
    c.d = (r: T.Reader) => {
      if (Bin.ru8(r) === 0) return null
      r.expected(ins)
      return inner.d(r)
    }
  } else {
    c.e = (w: T.Writer, v: D | E | null) => (v === null ? Bin._wu8(w, 0) : (Bin._wu8(w, 1), inner.e(w, v as E)))
    c.d = (r: T.Reader) => (Bin.ru8(r) === 0 ? null : inner.d(r))
  }
  return c
}

// ---------------- Struct codecs ----------------
type Compute<T> = { [K in keyof T]: T[K] } & {}
type StructFields = Record<string, T.Codec<any>>
type SizedFields = Record<string, T.Sized<any>>
type StructDecoded<S> = Compute<
  { -readonly [K in keyof S as S[K] extends T.Opt ? K : never]?: T.Decoded<S[K]> } & {
    -readonly [K in keyof S as S[K] extends T.Opt ? never : K]: T.Decoded<S[K]>
  }
>
type StructEncodable<S> = Compute<
  { -readonly [K in keyof S as S[K] extends T.Opt ? K : never]?: T.Encodable<S[K]> } & {
    -readonly [K in keyof S as S[K] extends T.Opt ? never : K]: T.Encodable<S[K]>
  }
>

/** Shape descriptor for a struct codec; carries the field map. */
export type StructShape<S extends StructFields = StructFields> = T.Shape<'struct', S>
/** Struct codec with at least one dynamic-size field. */
export type StructCodec<S extends StructFields> = StructShape<S> & T.Codec<StructDecoded<S>, StructEncodable<S>>
/** Struct codec where every field is sized; itself has a static `s`. */
export type StructSizedCodec<S extends SizedFields> = StructShape<S> & T.Sized<StructDecoded<S>, StructEncodable<S>>

/** Encodes fields in declaration order; result is sized when every field is sized. */
export const struct: {
  <const S extends SizedFields>(shape: S): StructSizedCodec<S>
  <const S extends StructFields>(shape: S): StructCodec<S>
} = (shape: StructFields): any => {
  const keys = Object.keys(shape)
  const codecs = keys.map((k) => shape[k]!)
  const n = keys.length

  let s = 0
  let allSized = true
  for (let i = 0; i < n; i++) {
    const c = codecs[i]!
    if (!Bin.isSized(c)) {
      allSized = false
      break
    }
    s += c.s
  }

  const sizes: number[] = codecs.map(Bin._sz) // static size of each field (0 if dynamic)

  if (allSized) {
    // Fully sized: pre-grow / pre-check once, then call children's bare e/d.
    const e: T.Encoder<any>['e'] = (w, v) => {
      Bin._grow(w, s)
      for (let i = 0; i < n; i++) codecs[i]!.e(w, v[keys[i]!])
    }
    const d: T.Decoder<any>['d'] = (r) => {
      const t = r.trace
      const o: any = {}
      if (!t) {
        r.expected(s)
        for (let i = 0; i < n; i++) o[keys[i]!] = codecs[i]!.d(r)
      } else {
        for (let i = 0; i < n; i++) o[keys[i]!] = traceChild(r, t, codecs[i]!, keys[i]!)
      }
      return o
    }
    return { kind: 'struct', shape, s, e, d } as StructSizedCodec<any>
  }

  // Mixed: `cs &&` short-circuit avoids a function call for dynamic fields.
  const e: T.Encoder<any>['e'] = (w, v) => {
    for (let i = 0; i < n; i++) {
      const cs = sizes[i]!
      if (cs) Bin._grow(w, cs)
      codecs[i]!.e(w, v[keys[i]!])
    }
  }
  const d: T.Decoder<any>['d'] = (r) => {
    const t = r.trace
    const o: any = {}
    if (!t) {
      for (let i = 0; i < n; i++) {
        const cs = sizes[i]!
        if (cs) r.expected(cs)
        o[keys[i]!] = codecs[i]!.d(r)
      }
    } else {
      for (let i = 0; i < n; i++) o[keys[i]!] = traceChild(r, t, codecs[i]!, keys[i]!)
    }
    return o
  }
  return { kind: 'struct', shape, e, d } as StructCodec<any>
}

/** Shape descriptor for a list codec; carries the item codec and length-prefix codec. */
export type ListShape<S extends T.Codec<any> = T.Codec<any>> = T.Shape<'list', T.SeqShape<S>>
/** Length-prefixed array codec. */
export type ListCodec<S extends T.Codec<any> = T.Codec<any>> = ListShape<S> & T.Codec<T.Decoded<S>[], T.Encodable<S>[]>

/** Length-prefixed array of `item`; defaults to a `varint` length, override via `{ length }`. */
export const list = <S extends T.Codec<any>>(item: S, p?: { length?: T.Codec<number> }): ListCodec<S> => {
  const len = p?.length ?? varint()
  if (!Bin.isSized(item)) return { kind: 'list', shape: { item, len }, e: _encList(len, item), d: _decList(len, item) }
  return { kind: 'list', shape: { item, len }, e: _encListSized(len, item), d: _decListSized(len, item) }
}

const _encList = (len: T.Codec<number>, item: T.Codec<any>) => (w: T.Writer, v: any[]) => {
  Bin._writeLen(w, len, v.length)
  for (let i = 0; i < v.length; i++) item.e(w, v[i]!)
}
const _decList = (len: T.Codec<number>, item: T.Codec<any>) => (r: T.Reader) => {
  const ln = len.d(r)
  r.expected(ln) // DoS guard: bound ln by remaining bytes (≥1 byte per item; trust mode opts out)
  const out = new Array(ln)
  const t = r.trace
  if (!t) for (let i = 0; i < ln; i++) out[i] = item.d(r)
  else for (let i = 0; i < ln; i++) out[i] = traceChild(r, t, item, i)
  return out
}
const _encListSized = (len: T.Codec<number>, item: T.Sized<any>) => (w: T.Writer, v: any[]) => {
  Bin._writeLen(w, len, v.length)
  Bin._grow(w, v.length * item.s)
  for (let i = 0; i < v.length; i++) item.e(w, v[i]!)
}
const _decListSized = (len: T.Codec<number>, item: T.Sized<any>) => (r: T.Reader) => {
  const ln = len.d(r)
  const t = r.trace
  if (!t) {
    r.expected(ln * (item.s || 1)) // tight bound + DoS guard (1 byte floor for zero-byte items)
    const out = new Array(ln)
    for (let i = 0; i < ln; i++) out[i] = item.d(r)
    return out
  }
  r.expected(ln) // DoS guard only; per-child bounds happen in traceChild
  const out = new Array(ln)
  for (let i = 0; i < ln; i++) out[i] = traceChild(r, t, item, i)
  return out
}

/** Shape descriptor for a fixed-length array codec. */
export type ArrayShape<L extends number = number, S extends T.Sized<any> = T.Sized<any>> = T.Shape<
  'array',
  { item: S; size: L }
>
/** Fixed-length array codec; sized because both `size` and `item` are static. */
export type ArrayCodec<L extends number = number, S extends T.Sized<any> = T.Sized<any>> = ArrayShape<L, S> &
  T.Sized<T.Decoded<S>[] & { length: L }, T.Encodable<S>[] & { length: L }>

/** Fixed-length array of `size` items; no length prefix on the wire. */
export const array = <S extends T.Sized<any, any>, L extends number>(item: S, size: L): ArrayCodec<L, S> => {
  const total = size * item.s
  return {
    kind: 'array',
    shape: { item, size },
    s: total,
    e: (w, v) => {
      Bin._grow(w, total)
      for (let i = 0; i < size; i++) item.e(w, v[i]!)
    },
    d: (r) => {
      const t = r.trace
      const out = new Array(size)
      if (!t) {
        r.expected(total)
        for (let i = 0; i < size; i++) out[i] = item.d(r)
      } else {
        for (let i = 0; i < size; i++) out[i] = traceChild(r, t, item, i)
      }
      return out as any
    },
  }
}

/** Merge two struct shapes; `b`'s fields win on overlap (both at the type level and on the wire). */
export const intersect: {
  <const A extends StructShape<SizedFields>, const B extends StructShape<SizedFields>>(
    a: A,
    b: B,
  ): StructSizedCodec<Compute<Omit<A['shape'], keyof B['shape']> & B['shape']>>
  <const A extends StructShape<StructFields>, const B extends StructShape<StructFields>>(
    a: A,
    b: B,
  ): StructCodec<Compute<Omit<A['shape'], keyof B['shape']> & B['shape']>>
} = (a: StructShape<any>, b: StructShape<any>): any => struct({ ...a.shape, ...b.shape })

/** Wraps every field of a struct in `optional`; all keys become optional on the decoded type. */
export const partial = <S extends StructFields>(str: StructShape<S>): StructCodec<{ [K in keyof S]: T.Opt & S[K] }> =>
  struct(Object.fromEntries(Object.entries(str.shape).map(([k, v]) => [k, optional(v)]))) as any

/** Shape descriptor for a tuple codec; carries the positional element codecs. */
export type TupleShape<T extends T.Codec<any>[] = T.Codec<any>[]> = T.Shape<'tuple', T>
/** Positional tuple codec; produces a fixed-length array. */
export type TupleCodec<T extends T.Codec<any>[]> = TupleShape<T> &
  T.Codec<{ [K in keyof T]: T.Decoded<T[K]> }, { [K in keyof T]: T.Encodable<T[K]> }>
/** Tuple codec where every element is sized. */
export type TupleSizedCodec<T extends T.Sized<any>[]> = TupleShape<T> &
  T.Sized<{ [K in keyof T]: T.Decoded<T[K]> }, { [K in keyof T]: T.Encodable<T[K]> }>

/** Positional tuple of codecs; the result is sized when every element is sized. */
export const tuple: {
  <const T extends T.Sized<any, any>[]>(...shape: T): TupleSizedCodec<T>
  <const T extends T.Codec<any>[]>(...shape: T): TupleCodec<T>
} = (...shape: T.Codec<any>[]): any => {
  const n = shape.length
  let s = 0
  let allSized = true
  for (const c of shape) {
    if (!Bin.isSized(c)) {
      allSized = false
      break
    }
    s += c.s
  }
  const sizes = shape.map(Bin._sz)
  if (allSized) {
    const e: T.Encoder<any>['e'] = (w, v) => {
      Bin._grow(w, s)
      for (let i = 0; i < n; i++) shape[i]!.e(w, v[i])
    }
    const d: T.Decoder<any>['d'] = (r) => {
      const t = r.trace
      const out: any = new Array(n)
      if (!t) {
        r.expected(s)
        for (let i = 0; i < n; i++) out[i] = shape[i]!.d(r)
      } else {
        for (let i = 0; i < n; i++) out[i] = traceChild(r, t, shape[i]!, i)
      }
      return out
    }
    return { kind: 'tuple', shape, s, e, d } as TupleSizedCodec<any>
  }
  const e: T.Encoder<any>['e'] = (w, v) => {
    for (let i = 0; i < n; i++) {
      const cs = sizes[i]!
      if (cs) Bin._grow(w, cs)
      shape[i]!.e(w, v[i])
    }
  }
  const d: T.Decoder<any>['d'] = (r) => {
    const t = r.trace
    const out: any = new Array(n)
    if (!t) {
      for (let i = 0; i < n; i++) {
        const cs = sizes[i]!
        if (cs) r.expected(cs)
        out[i] = shape[i]!.d(r)
      }
    } else {
      for (let i = 0; i < n; i++) out[i] = traceChild(r, t, shape[i]!, i)
    }
    return out
  }
  return { kind: 'tuple', shape, e, d } as TupleCodec<any>
}

type DiscriminatedStruct<T extends string> = StructShape<{ [K in T]: T.Literal<any> }>
/** Shape descriptor for a tagged-union codec; carries the variant tag codec and variants. */
export type TaggedShape<T extends string, S extends DiscriminatedStruct<T>[]> = T.Shape<
  'tagged',
  { tag: T.Codec<number>; shape: S }
>
/** Discriminated-union codec; decodes to the union of its variants. */
export type TaggedCodec<T extends string, S extends DiscriminatedStruct<T>[]> = TaggedShape<T, S> &
  T.Codec<{ [K in keyof S]: T.Decoded<S[K]> }[number], { [K in keyof S]: T.Encodable<S[K]> }[number]>

/** Discriminated union of structs keyed by a shared literal field; tag defaults to `uint8`. */
export const tagged = <T extends string, const S extends DiscriminatedStruct<T>[]>(
  tag: T,
  shape: S,
  p?: { tag?: T.Codec<number> },
): TaggedCodec<T, S> => {
  const tc = p?.tag ?? uint8()
  const idxm = Object.fromEntries(shape.map((s, i) => [s.shape[tag].value, i]))
  const tagVal = shape.map((s) => s.shape[tag].value as string | number) // path segment in trace mode
  const tcS = Bin._sz(tc) // 0 if tag codec is dynamic; _grow / expected become no-ops
  return {
    kind: 'tagged',
    shape: { tag: tc, shape },
    e: (w, v) => {
      const idx = idxm[(v as any)[tag]]
      Bin._grow(w, tcS)
      tc.e(w, idx)
      ;(shape[idx] as any).e(w, v)
    },
    d: (r) => {
      r.expected(tcS) // tag byte; tcS=0 if dynamic tag → no-op
      const idx = tc.d(r)
      const t = r.trace
      return t ? traceChild(r, t, shape[idx]! as any, tagVal[idx]!) : (shape[idx] as any).d(r)
    },
  }
}

/** Shape descriptor for a `Map` codec; carries the key and value codecs. */
export type MapShape<K extends T.Codec<any>, V extends T.Codec<any>> = T.Shape<'map', { key: K; value: V }>
/** Length-prefixed `Map` codec. */
export type MapCodec<K extends T.Codec<any>, V extends T.Codec<any>> = MapShape<K, V> &
  T.Codec<Map<T.Decoded<K>, T.Decoded<V>>, Map<T.Encodable<K>, T.Encodable<V>>>

/** Length-prefixed `Map<K, V>`; defaults to a `varint` length, override via `{ length }`. */
export const map = <K extends T.Codec<any>, V extends T.Codec<any>>(key: K, value: V, p?: LenOpt): MapCodec<K, V> => {
  const length = p?.length ?? varint()
  const kSize = Bin._sz(key)
  const vSize = Bin._sz(value)
  // Bulk pre-grow is `pairSize` per pair only when *both* sides are sized.
  const bulkPair = kSize > 0 && vSize > 0 ? kSize + vSize : 0
  const minPair = (kSize || 1) + (vSize || 1) // decode-side DoS guard; dynamic sides count as 1 byte
  return {
    kind: 'map',
    shape: { key, value },
    e: (w, v) => {
      Bin._writeLen(w, length, v.size)
      Bin._grow(w, v.size * bulkPair) // 0 if either side is dynamic → no-op
      for (const [k, val] of v) {
        Bin._grow(w, kSize)
        key.e(w, k as any)
        Bin._grow(w, vSize)
        value.e(w, val as any)
      }
    },
    d: (r) => {
      const len = length.d(r)
      const t = r.trace
      if (!t) {
        // Tight bound when both sides sized; also bounds `len` for the DoS guard.
        r.expected(len * minPair)
        const out = new Map<any, any>()
        for (let i = 0; i < len; i++) {
          if (kSize) r.expected(kSize)
          const k = key.d(r)
          if (vSize) r.expected(vSize)
          out.set(k, value.d(r))
        }
        return out
      }
      r.expected(len * 2) // DoS guard: ≥1 byte for each of key + value
      const out = new Map<any, any>()
      for (let i = 0; i < len; i++) {
        const k = traceChild(r, t, key, i)
        out.set(k, traceChild(r, t, value, i))
      }
      return out
    },
  }
}

/** Shape descriptor for a `Set` codec; carries the item codec and length-prefix codec. */
export type SetShape<S extends T.Codec<any> = T.Codec<any>> = T.Shape<'set', T.SeqShape<S>>
/** Length-prefixed `Set` codec. */
export type SetCodec<S extends T.Codec<any> = T.Codec<any>> = SetShape<S> &
  T.Codec<Set<T.Decoded<S>>, Set<T.Encodable<S>>>

/** Length-prefixed `Set<T>`; defaults to a `varint` length, override via `{ length }`. */
export const set = <S extends T.Codec<any>>(item: S, p?: LenOpt): SetCodec<S> => {
  const lc = p?.length ?? varint()
  const is = Bin._sz(item) // 0 if item is dynamic → bulk grow / check are no-ops
  return {
    kind: 'set',
    shape: { item, len: lc },
    e: (w, v) => {
      Bin._writeLen(w, lc, v.size)
      Bin._grow(w, v.size * is)
      for (const it of v) item.e(w, it as any)
    },
    d: (r) => {
      const len = lc.d(r)
      const t = r.trace
      if (!t) {
        // `is || 1` keeps the bound a valid DoS guard for dynamic items.
        r.expected(len * (is || 1))
        const out = new Set<any>()
        for (let i = 0; i < len; i++) out.add(item.d(r) as any)
        return out
      }
      r.expected(len) // DoS guard only; per-item bounds happen in traceChild
      const out = new Set<any>()
      for (let i = 0; i < len; i++) out.add(traceChild(r, t, item, i) as any)
      return out
    },
  }
}

/** Defers construction for recursive schemas; `get()` memoises on first call. */
export const lazy = <D, E = D>(fn: () => T.Codec<D, E>): T.Lazy<D, E> => {
  let inner: T.Codec<D, E> | undefined
  const get = () => (inner ??= fn())
  return {
    get,
    e: (w, v) => {
      const c = get()
      Bin._grow(w, Bin._sz(c))
      c.e(w, v)
    },
    d: (r) => {
      const c = get()
      r.expected(Bin._sz(c))
      return c.d(r) as D
    },
  }
}

/** Length-prefixed UTF-8 codec carrying `JSON.parse`/`JSON.stringify`-able values. */
export const json = <T>(): T.Codec<T, T> => imap(utf8(), JSON.parse, JSON.stringify) as any

/** Bijective map over `inner`; preserves `s` but strips `kind`/`shape`/`value` so lenses don't drill. */
export const imap = <B extends T.Codec<any>, D>(
  inner: B,
  d: (v: T.Decoded<B>) => D,
  e: (v: D) => NoInfer<T.Encodable<B>>,
): Compute<Omit<B, 'd' | 'e' | 'kind' | 'shape' | 'value'> & T.Codec<D>> => {
  const c: any = { e: (w: T.Writer, v: D) => inner.e(w, e(v)), d: (r: T.Reader) => d(inner.d(r)) }
  if (Bin.isSized(inner)) c.s = (inner as T.Sized<any>).s
  return c
}

/** Returns `value` (and rewinds the reader) when `inner.d` throws. */
export const fallback = <B extends T.Codec<any>>(inner: B, value: T.Decoded<B>): B => ({
  ...inner,
  d: (r) => {
    const pos = r.pos
    const depth = r.trace ? r.trace.path.length : 0
    try {
      return inner.d(r)
    } catch {
      r.pos = pos
      if (r.trace) r.trace.path.length = depth
      return value
    }
  },
})
