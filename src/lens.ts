import { decode, encode, encodeInto } from './rw.js'
import type * as T from './types.js'
import type * as C from './codec.js'

/** Build a lens tree mirroring `codec`'s shape for random-access read/write at fixed offsets. */
export const lens = <X extends T.Codec<any, any>>(codec: X): Lens<X> => {
  const cache = new WeakMap<Uint8Array, Map<number, [unknown, number]>>()
  const getCache = (buf: Uint8Array): Map<number, [unknown, number]> => {
    let m = cache.get(buf)
    if (!m) cache.set(buf, (m = new Map()))
    return m
  }

  /** Decode at `start` → `[value, end]`; unsized decodes are cached per buffer. */
  const read = (c: T.Codec<any, any>, buf: Uint8Array, start: number): [unknown, number] => {
    if (isSized(c)) return decode(c, buf, start) as [unknown, number]
    const m = getCache(buf)
    let entry = m.get(start)
    if (!entry) m.set(start, (entry = decode(c, buf, start) as [unknown, number]))
    return entry
  }

  /** Write `value` at `start`; unsized rewrites must match the existing encoded byte length. */
  const write = (c: T.Codec<any, any>, buf: Uint8Array, start: number, value: unknown): void => {
    if (isSized(c)) {
      encodeInto(c, value, buf, start)
      cache.get(buf)?.clear() // sized write may invalidate composite reads spanning this offset
      return
    }
    const [, oldEnd] = read(c, buf, start)
    const oldLen = oldEnd - start
    const scratch = encode(c, value)
    if (scratch.length !== oldLen) {
      throw new RangeError(
        `lens: cannot resize ${describeCodec(c)} in place (was ${oldLen} bytes, would be ${scratch.length})`,
      )
    }
    buf.set(scratch, start)
    cache.get(buf)?.clear()
  }

  const slice = (c: T.Codec<any, any>, buf: Uint8Array, start: number): Uint8Array => {
    if (isSized(c)) return buf.subarray(start, start + c.s)
    const [, end] = read(c, buf, start)
    return buf.subarray(start, end)
  }

  /** Absolute start position of a field. */
  const startOf = (o: OffsetOf, buf: Uint8Array, base: number): number =>
    o.type === 'resolved' ? base + o.offset : o.fn(buf, base) + o.add

  /** Offset of the field after the one at `o`; sized successors collapse to arithmetic. */
  const advance = (o: OffsetOf, c: T.Codec<any, any>): OffsetOf => {
    if (isSized(c)) return advanceBy(o, c.s)
    const prev = o
    const fn = (buf: Uint8Array, base: number) => read(c, buf, startOf(prev, buf, base))[1]
    return { type: 'unresolved', fn, add: 0 }
  }

  /** Walk an unsized item stream once and return an O(1) index→offset lookup. */
  const makeUnsizedItemStart = (
    buf: Uint8Array,
    item: T.Codec<any, any>,
    length: number,
    dataStart: number,
  ): ((i: number) => number) => {
    const offsets: number[] = new Array(length + 1)
    offsets[0] = dataStart
    for (let i = 0; i < length; i++) offsets[i + 1] = read(item, buf, offsets[i]!)[1]
    return (i) => offsets[i]!
  }

  const buildIterator = (buf: Uint8Array, item: T.Codec<any, any>, length: number, dataStart: number) =>
    function* () {
      if (isSized(item)) {
        for (let i = 0; i < length; i++) yield read(item, buf, dataStart + i * item.s)[0]
      } else {
        let pos = dataStart
        for (let i = 0; i < length; i++) {
          const [v, next] = read(item, buf, pos)
          yield v
          pos = next
        }
      }
    }

  const buildForEach =
    (buf: Uint8Array, item: T.Codec<any, any>, length: number, dataStart: number) =>
    (fn: (v: unknown, i: number) => void) => {
      if (isSized(item)) {
        for (let i = 0; i < length; i++) fn(read(item, buf, dataStart + i * item.s)[0], i)
      } else {
        let pos = dataStart
        for (let i = 0; i < length; i++) {
          const [v, next] = read(item, buf, pos)
          fn(v, i)
          pos = next
        }
      }
    }

  const buildToArray =
    (buf: Uint8Array, item: T.Codec<any, any>, length: number, dataStart: number) =>
    (): unknown[] => {
      const out = new Array(length)
      if (isSized(item)) {
        for (let i = 0; i < length; i++) out[i] = read(item, buf, dataStart + i * item.s)[0]
      } else {
        let pos = dataStart
        for (let i = 0; i < length; i++) {
          const [v, next] = read(item, buf, pos)
          out[i] = v
          pos = next
        }
      }
      return out
    }

  const buildNode = (c: T.Codec<any, any>, o: OffsetOf): any => {
    const node: any = {
      $codec: c,
      $read: (buf: Uint8Array, base = 0) => read(c, buf, startOf(o, buf, base))[0],
      $write: (buf: Uint8Array, v: unknown, base = 0) => write(c, buf, startOf(o, buf, base), v),
      $slice: (buf: Uint8Array, base = 0) => slice(c, buf, startOf(o, buf, base)),
    }
    if (o.type === 'resolved') node.$offset = o.offset
    if (isSized(c)) node.$size = c.s
    return node
  }

  const buildStruct = (node: any, o: OffsetOf, entries: Iterable<[string | number, T.Codec<any, any>]>) => {
    let off = o
    for (const [k, c] of entries) {
      node[k] = build(c, off)
      off = advance(off, c)
    }
  }

  const buildList = (node: any, o: OffsetOf, item: T.Codec<any, any>, len: T.Codec<number>) => {
    node.bind = (buf: Uint8Array, base = 0) => {
      const start = startOf(o, buf, base)
      const [length, dataStart] = read(len, buf, start) as [number, number]
      const itemStart = isSized(item)
        ? (i: number) => dataStart + i * item.s
        : makeUnsizedItemStart(buf, item, length, dataStart)
      const check = (i: number) => {
        if (i < 0 || i >= length) throw new RangeError(`lens: list index ${i} out of bounds [0, ${length})`)
      }
      const at = (i: number) => (check(i), read(item, buf, itemStart(i))[0])
      return {
        length,
        ...(isSized(item) && { size: item.s }),
        at,
        set: (i: number, v: unknown) => (check(i), write(item, buf, itemStart(i), v)),
        forEach: buildForEach(buf, item, length, dataStart),
        toArray: buildToArray(buf, item, length, dataStart),
        *[Symbol.iterator]() {
          for (let i = 0; i < length; i++) yield at(i)
        },
      }
    }
  }

  const buildSet = (node: any, o: OffsetOf, item: T.Codec<any, any>, len: T.Codec<number>) => {
    node.bind = (buf: Uint8Array, base = 0) => {
      const start = startOf(o, buf, base)
      const [length, dataStart] = read(len, buf, start) as [number, number]
      return {
        length,
        ...(isSized(item) && { size: item.s }),
        forEach: buildForEach(buf, item, length, dataStart),
        toArray: buildToArray(buf, item, length, dataStart),
        [Symbol.iterator]: buildIterator(buf, item, length, dataStart),
      }
    }
  }

  /** Dispatch on the codec's structural kind to attach composite accessors. */
  const build = (c: T.Codec<any, any>, o: OffsetOf): any => {
    if (isLazy(c)) return build(c.get(), o)
    const node: any = buildNode(c, o)
    if (!hasKind(c)) return node
    switch (c.kind) {
      case 'struct':
        buildStruct(node, o, Object.entries(c.shape))
        break
      case 'tuple': {
        const entries = c.shape.map((cc, i) => [i, cc] as [number, T.Codec<any, any>])
        buildStruct(node, o, entries)
        node.length = c.shape.length
        break
      }
      case 'array': {
        const { item, size } = c.shape
        const itemSize = isSized(item) ? item.s : 0
        const itemCache: any[] = new Array(size)
        node.length = size
        node.at = (i: number) => {
          if (i < 0 || i >= size) throw new RangeError(`lens: array index ${i} out of bounds [0, ${size})`)
          return itemCache[i] ?? (itemCache[i] = build(item, advanceBy(o, i * itemSize)))
        }
        break
      }
      case 'list':
        buildList(node, o, c.shape.item, c.shape.len)
        break
      case 'set':
        buildSet(node, o, c.shape.item, c.shape.len)
        break
    }
    return node
  }

  return build(codec, { type: 'resolved', offset: 0 }) as Lens<X>
}

type OffsetOf =
  | { type: 'resolved'; offset: number }
  | { type: 'unresolved'; fn: (buf: Uint8Array, base: number) => number; add: number }

/** Add a constant byte amount to an offset without re-walking dynamic predecessors. */
const advanceBy = (o: OffsetOf, n: number): OffsetOf =>
  o.type === 'resolved' ? { type: 'resolved', offset: o.offset + n } : { type: 'unresolved', fn: o.fn, add: o.add + n }

const isSized = (c: unknown): c is { s: number } => typeof c === 'object' && c !== null && 's' in c

type ShapeKinds = C.StructShape | C.TupleShape | C.ArrayShape | C.ListShape | C.SetShape
const hasKind = (c: unknown): c is ShapeKinds => typeof c === 'object' && c !== null && 'kind' in c

const isLazy = (c: unknown): c is { get: () => T.Codec<any, any> } =>
  typeof c === 'object' && c !== null && typeof (c as any).get === 'function'

const describeCodec = (c: T.Codec<any, any>): string => (hasKind(c) ? `${c.kind} codec` : 'codec')

// ---------------- Types ----------------
/** Lens over a codec; composites expose extra field/index accessors via `Extra<X>`. */
export type Lens<X> = LensBase<X> & Extra<X>

type LensBase<X> = {
  /** Static byte offset relative to `base`; absent when a dynamic predecessor makes it unresolvable. */
  readonly $offset?: number
  /** Static byte size; absent for unsized codecs. */
  readonly $size?: number
  /** Underlying codec. */
  readonly $codec: X
  /** Decode the value at this offset. */
  $read(buf: Uint8Array, base?: number): T.Decoded<X>
  /** Write at this offset in place; throws if an unsized rewrite would change byte length. */
  $write(buf: Uint8Array, value: T.Encodable<X>, base?: number): void
  /** Zero-copy `Uint8Array` view covering this lens's bytes within `buf`. */
  $slice(buf: Uint8Array, base?: number): Uint8Array
}

// Composite-shape type augmentations. Discriminated by kind.
type Extra<X> =
  X extends C.StructShape<infer S>
    ? StructLens<S>
    : X extends C.TupleShape<infer T>
      ? TupleLens<T>
      : X extends C.ArrayShape<infer L, infer I>
        ? ArrayLens<L, I>
        : X extends C.ListShape<infer I>
          ? ListLens<I>
          : X extends C.SetShape<infer I>
            ? SetLens<I>
            : X extends T.Codec<infer D>
              ? Extra<D>
              : X extends Array<infer I>
                ? ListLens<T.Codec<I, I>>
                : X extends Record<string, any>
                  ? { [K in keyof X]: Lens<T.Codec<X[K], X[K]>> }
                  : X

type StructLens<S> = { readonly [K in keyof S]: Lens<S[K]> }
type TupleLens<T> = { [K in keyof T]: Lens<T[K]> } & { readonly length: number }
type ArrayLens<L, I> = { readonly length: L; at(i: number): Lens<I> }
type ListLens<I> = { bind(buf: Uint8Array, base?: number): BoundList<I> }
type SetLens<I> = { bind(buf: Uint8Array, base?: number): BoundSet<I> }

/** Reusable handle for random access into a list, returned by `lens(...).bind(buf)`. */
export interface BoundList<I> {
  readonly length: number
  /** Static item size; absent for unsized items. */
  readonly size?: number
  at(i: number): T.Decoded<I>
  set(i: number, value: T.Encodable<I>): void
  forEach(fn: (v: T.Decoded<I>, i: number) => void): void
  toArray(): T.Decoded<I>[]
  [Symbol.iterator](): IterableIterator<T.Decoded<I>>
}

/** Reusable handle for iterating a set; sets are unordered so there is no `at`/`set`. */
export interface BoundSet<I> {
  readonly length: number
  /** Static item size; absent for unsized items. */
  readonly size?: number
  forEach(fn: (v: T.Decoded<I>, i: number) => void): void
  toArray(): T.Decoded<I>[]
  [Symbol.iterator](): IterableIterator<T.Decoded<I>>
}
