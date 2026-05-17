/** Buffered writer state; `pos` is the next write offset, `grow(n)` ensures capacity. */
export type Writer = { dv: DataView; buf: Uint8Array; pos: number; grow(n: number): void }

/** Path stack on a `{ trace: true }` reader; composites push/pop segments around child decodes. */
export type Trace = { path: (string | number)[] }

/** Buffered reader state; `pos` is the next read offset and `end` is the exclusive upper bound. */
export type Reader = {
  dv: DataView
  buf: Uint8Array
  pos: number
  end: number
  /** Bounds-check; throws `RangeError` (or `DecodeError` in trace mode) when fewer than `n` bytes remain. */
  expected(n: number): void
  /** Present only on trace readers; holds the live path stack used to tag failures. */
  trace?: Trace
}

/** Half-codec that writes values of type `E` to a `Writer`. */
export type Encoder<E> = { e: (w: Writer, v: E) => void }
/** Half-codec that reads values of type `D` from a `Reader`. */
export type Decoder<D> = { d: (r: Reader) => D }
/** Bidirectional codec for value type `D`, with optional separate input type `E` for encoding. */
export type Codec<D, E = D> = Decoder<D> & Encoder<E>
/** Extracts the decoded value type from a `Codec`. */
export type Decoded<T> = T extends Codec<infer D, any> ? D : never
/** Extracts the encodable input type from a `Codec`. */
export type Encodable<T> = T extends Codec<any, infer E> ? E : never

/** Marker for codecs whose encoded length is statically known (`s` bytes). */
export type Size<S extends number = number> = { s: S }
/** Marker for struct fields that may be omitted on encode (produced by `optional`). */
export type Opt = { optional: true }

/** Codec with a statically-known byte size `S`. */
export type Sized<D, E = D, S extends number = number> = Size<S> & Codec<D, E>
/** Zero-byte codec that always decodes to a fixed value. */
export type Literal<V> = { value: V } & Sized<V, V, 0>
/** Fixed-size primitive codec (numbers by default). */
export type Scalar<S extends number = number, D = number, E = D> = Sized<D, E, S>
/** Codec deferred until first use; `get()` memoises. Used for recursive schemas. */
export type Lazy<D, E = D> = Codec<D, E> & { get: () => Codec<D, E> }

/** Tagged composite shape descriptor; `kind` identifies the family, `shape` carries its details. */
export type Shape<K extends string, S> = { kind: K; shape: S }
/** Composite codec carrying a `Shape` for introspection (used by `lens`). */
export type ShapeCodec<K extends string, S, D, E = D> = Shape<K, S> & Codec<D, E>
/** Sized composite codec carrying a `Shape`. */
export type ShapeSized<K extends string, S, D, E = D> = Shape<K, S> & Sized<D, E>
/** Shape of a sequence codec (list/set): an item codec plus its length-prefix codec. */
export type SeqShape<S> = { item: S; len: Codec<number> }
