// ==========================================
// IO Context Types
// ==========================================

/** A buffer with a position pointer and shared DataView. */
export type Cursor = { buf: Uint8Array; view: DataView; pos: number }

/** Writes bytes to a buffer. */
export type WriteCursor = Cursor & { ensure?: (bytes: number) => void }

/** Reads bytes from a buffer. */
export type ReadCursor = Cursor

// ==========================================
// Codec Types
// ==========================================

/** Encodes a value. */
export type Encoder<In> = { write: (writer: WriteCursor, value: In) => void }

/** Decodes a value. */
export type Decoder<Out> = { read: (reader: ReadCursor) => Out }

/** Combined encoder/decoder. */
export type Codec<Out, In = Out> = Decoder<Out> & Encoder<In>

/** Codec with fixed byte size. */
export type FixedCodec<S extends number, Out, E = Out> = Codec<Out, E> & { readonly byteLength: S }

/** Codec with dynamic byte size. */
export type VariableCodec<Out, In = Out> = Codec<Out, In> & { measure: (s: In) => number }

/** Codec for optional values. */
export type Optional<Out, In = Out> = VariableCodec<Out | undefined, In | undefined> & { optional: true }

/** Codec for a literal value that is not stored in the buffer. */
export type Literal<Out> = FixedCodec<0, Out> & { value: Out }

/** Codec with schema metadata. */
export type Schema<Shape, Out, In = Out> = VariableCodec<Out, In> & { schema: Shape }

/** Any supported codec type. */
export type BinCodec<Out, In = Out> = FixedCodec<number, Out, In> | VariableCodec<Out, In> | Optional<Out, In>

/** Extracts codec's decoded and encoded types. */
export type Infer<T> = T extends Codec<infer Out, infer In> ? { out: Out; in: In } : never
