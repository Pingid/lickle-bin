// ==========================================
// IO Interfaces
// ==========================================
import { BinError } from './error.js'

/** A buffer with a position pointer and shared DataView. */
export type Cursor = { buf: Uint8Array; view: DataView; pos: number }

/** Writes bytes to a buffer. */
export type Writer = Cursor

/** Reads bytes from a buffer. */
export type Reader = Cursor & {
  /** reads bytes and advances pos */
  readBytes: (size: number) => Uint8Array
  /** checks if the list length is safe */
  checkList: (count: number) => void
}

// ==========================================
// Codec Types
// ==========================================

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

// ==========================================
// Helpers
// ==========================================

/** Calculates the byte size of a value using its codec. */
export const size = <E, N extends number = number>(codec: FixedSize<N, any, E> | DynamicSize<any, E>, value: E): N =>
  (typeof codec.s === 'function' ? codec.s(value) : codec.s) as N

// ==========================================
// Result Types
// ==========================================

export type Ok<T> = { ok: true; value: T }
export type Err<E = BinError> = { ok: false; error: E }
export type Result<T, E = BinError> = Ok<T> | Err<E>

// ==========================================
// Validation Types
// ==========================================

/** Enforce constraints before encode and/or after decode. */
export type Validators<D, E> = {
  /** run before encode */
  pre?: (value: E) => void
  /** run after decode */
  post?: (value: D) => void
}

// ==========================================
// Utilities
// ==========================================

/** Flattens a type for readability. */
export type Compute<T> = { [K in keyof T]: T[K] } & {}

export type Endian = 'le' | 'be'
