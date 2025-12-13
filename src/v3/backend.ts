export type Endian = 'le' | 'be'

export interface Kernel {
  Num: unknown
  BigNum: unknown
  Str: unknown
  Bytes: unknown
  Bool: unknown
  Buffer: unknown
}

export interface Backend<Ctx, M extends Mode, K extends Kernel> {
  readonly mode: M
  // Booleans
  bool(): (c: Ctx, v: K['Bool']) => void

  // Numbers
  i8(): (c: Ctx, v: K['Num']) => void
  u8(): (c: Ctx, v: K['Num']) => void

  i16(endian?: Endian): (c: Ctx, v: K['Num']) => void
  u16(endian?: Endian): (c: Ctx, v: K['Num']) => void
  f16(endian?: Endian): (c: Ctx, v: K['Num']) => void

  i32(endian?: Endian): (c: Ctx, v: K['Num']) => void
  u32(endian?: Endian): (c: Ctx, v: K['Num']) => void
  f32(endian?: Endian): (c: Ctx, v: K['Num']) => void

  i64(endian?: Endian): (c: Ctx, v: K['BigNum']) => void
  u64(endian?: Endian): (c: Ctx, v: K['BigNum']) => void
  f64(endian?: Endian): (c: Ctx, v: K['Num']) => void

  str(): (c: Ctx, v: K['Str']) => void

  struct(shape: Record<string, Op<M, Ctx, any>>): Op<M, Ctx, any>
  list(inner: Op<M, Ctx, any>): Op<M, Ctx, any>

  wrap<T>(internal: Op<M, Ctx, T>): Wrap<M, T>
}

export type Mode = 'read' | 'write'

export type Op<M extends Mode, Ctx, T> = M extends 'read' ? (c: Ctx) => T : (c: Ctx, v: T) => void

export type Wrap<M extends Mode, T> = M extends 'read' ? (buf: Uint8Array) => T : (val: T) => Uint8Array

export type DecoderOptions = {
  /**
   * SAFETY: Check bounds before every read?
   * Disable for ~15-20% speedup on trusted data.
   * @default true
   */
  boundsCheck?: boolean

  /**
   * SECURITY: Max allowed elements in Arrays/Maps.
   * Prevents "Allocation failed" crashes.
   * @default 1_000_000
   */
  maxListLength?: number

  /**
   * SECURITY: Max allowed bytes for a single String.
   * @default 10 * 1024 * 1024 (10MB)
   */
  maxStringLength?: number

  /**
   * STRICTNESS: Throw if there are bytes left over after decoding?
   * @default false
   */
  strictEOF?: boolean
}

export const DEFAULT_DECODER_OPTIONS: Required<DecoderOptions> = {
  boundsCheck: true,
  maxListLength: 1_000_000,
  maxStringLength: 10 * 1024 * 1024,
  strictEOF: false,
}

export type EncoderOptions = {
  /**
   * MEMORY: How many bytes to allocate initially?
   * Setting this close to your average message size improves perf.
   * @default 512
   */
  initialBufferSize?: number

  /**
   * SAFETY: Max bytes the buffer is allowed to grow to.
   * @default 10 * 1024 * 1024 (10MB)
   */
  maxBufferSize?: number

  /**
   * INTEGRITY: Throw if a number doesn't fit in the target type?
   * e.g. writing 300 to a uint8.
   * - false: Silently wraps (300 -> 44) (Fastest)
   * - true: Throws Error (Safe)
   * @default false
   */
  strictRange?: boolean

  /**
   * EXECUTION: Check bounds before writing?
   * - Fixed Buffer: Throws Error
   * - Dynamic Buffer: Triggers Resize
   * @default true
   */
  boundsCheck?: boolean
}

export const DEFAULT_ENCODER_OPTIONS: Required<EncoderOptions> = {
  initialBufferSize: 512,
  maxBufferSize: 10 * 1024 * 1024,
  boundsCheck: true,
  strictRange: false,
}
