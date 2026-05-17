import { Codec, Decoded, Encoder, Reader, Sized, Trace, Writer } from './types.js'
import { isSized } from './bin.js'

/** Writer that owns its buffer and exposes `flush()` to return the written bytes. */
export type FlushWriter = Writer & { flush: () => Uint8Array }

/** Returns the encoded byte length of `value` without retaining the encoded bytes. */
export const measure = <T>(codec: Codec<T>, value: T): number => {
  if ('s' in codec) return (codec as Sized<number, any, any>).s
  const w = writer()
  codec.e(w, value)
  return w.pos
}

/** Encodes `value` and returns the bytes; reuses `w` when given, otherwise allocates. */
export const encode = <T>(codec: Codec<T>, value: T, w?: FlushWriter): Uint8Array => {
  if (w) {
    codec.e(w, value)
    return w.flush()
  }
  if (isSized(codec)) {
    const s = (codec as Sized<any>).s
    const buf = new Uint8Array(s)
    const wr: FlushWriter = {
      buf,
      dv: new DataView(buf.buffer),
      pos: 0,
      grow() {},
      flush() {
        return this.buf
      },
    }
    codec.e(wr, value)
    return buf
  }
  const wr = writer()
  codec.e(wr, value)
  return wr.flush()
}

/** Encodes `value` into `buf` at `offset`; returns the new write position. The buffer is not resized. */
export const encodeInto = <T>(codec: Codec<T>, value: T, buf: Uint8Array, offset = 0): number => {
  const w: Writer = {
    buf,
    dv: new DataView(buf.buffer, buf.byteOffset, buf.byteLength),
    pos: offset,
    grow() {},
  }
  codec.e(w, value)
  return w.pos
}

/** Writes `value` to an existing writer using `codec`; useful for stitching multiple codecs into one buffer. */
export const write = <E, W extends Writer>(w: W, codec: Encoder<E>, value: E): void => codec.e(w, value)

/** Creates a `FlushWriter`. Pass `size` to preallocate exactly; otherwise the buffer doubles on demand. */
export const writer = (size?: number): FlushWriter => {
  if (typeof size === 'number') {
    const buf = new Uint8Array(size)
    return {
      buf,
      dv: new DataView(buf.buffer),
      pos: 0,
      grow() {},
      flush() {
        return this.buf.subarray(0, this.pos)
      },
    }
  }
  const w: FlushWriter = {
    buf: new Uint8Array(256),
    dv: undefined as any,
    pos: 0,
    grow(n) {
      if (this.pos + n <= this.buf.length) return
      let cap = this.buf.length
      while (this.pos + n > cap) cap *= 2
      const next = new Uint8Array(cap)
      next.set(this.buf.subarray(0, this.pos))
      this.buf = next
      this.dv = new DataView(next.buffer)
    },
    flush() {
      return this.buf.slice(0, this.pos)
    },
  }
  w.dv = new DataView(w.buf.buffer)
  return w
}

/** Decodes one value from `bytes` and returns `[value, bytesRead]`; pass an offset or `ReaderOptions`. */
export const decode = <T>(codec: Codec<T>, value: Uint8Array, opts: ReaderOptions | number = 0): [T, number] => {
  const r = reader(value, opts)
  return [codec.d(r), r.pos]
}

/** Decodes a sequence of codecs from an existing reader; returns a tuple of their values. */
export const read = <const A extends Codec<any, any>[]>(
  r: Reader,
  ...codes: A
): { [K in keyof A]: Decoded<A[K]> } => codes.map((c) => c.d(r)) as any

/** Options accepted by `reader` / `decode`. */
export type ReaderOptions = {
  /** Byte offset to start reading from. */
  offset?: number
  /** Skip bounds checks for a small speedup; only safe for bytes you produced yourself. */
  trust?: boolean
  /** Track the field path so failures throw a `DecodeError` with location info. */
  trace?: boolean
}

/** Creates a `Reader` over `buf`. Pass a number as a shorthand for `{ offset }`. */
export const reader = (buf: Uint8Array, opts: ReaderOptions | number = 0): Reader => {
  const o = typeof opts === 'number' ? { offset: opts } : opts
  const r: Reader = {
    buf,
    dv: new DataView(buf.buffer, buf.byteOffset, buf.byteLength),
    pos: o.offset ?? 0,
    end: buf.byteLength,
    expected: o.trace ? _traceExpected : o.trust ? _noopExpected : _checkExpected,
  }
  if (o.trace) r.trace = { path: [] }
  return r
}

const _checkExpected = function (this: Reader, n: number) {
  if (this.pos + n > this.end) throw new RangeError(`Expected ${this.pos + n} bytes, got ${this.end}`)
}
const _noopExpected = () => {}

// Trace mode: throw a path-tagged DecodeError instead of a bare RangeError.
const _traceExpected = function (this: Reader, n: number) {
  if (this.pos + n > this.end) {
    throw new DecodeError(
      this.trace!.path.slice(),
      this.pos,
      new RangeError(`Expected ${this.pos + n} bytes, got ${this.end}`),
    )
  }
}

/** Trace-mode child decode: pushes `seg` on the path, runs `c.d(r)`, attaches it to any thrown error. */
export const traceChild = <T>(r: Reader, t: Trace, c: { d: (r: Reader) => T }, seg: string | number): T => {
  t.path.push(seg)
  const start = r.pos
  try {
    const v = c.d(r)
    t.path.pop()
    return v
  } catch (e) {
    if (e instanceof DecodeError) throw e
    throw new DecodeError(t.path.slice(), start, e)
  }
}

/** Error thrown when a trace-mode decode fails; `path` and `offset` locate the failure. */
export class DecodeError extends Error {
  constructor(
    public path: (string | number)[],
    public offset: number,
    cause: unknown,
  ) {
    super('', { cause })
    this.name = 'DecodeError'
    this._fmt()
  }
  /** @internal */
  _fmt() {
    const p = this.path.map((s, i) => (typeof s === 'number' ? `[${s}]` : i === 0 ? s : `.${s}`)).join('')
    const c = this.cause instanceof Error ? this.cause.message : String(this.cause)
    this.message = `failed decoding '${p}' at offset ${this.offset}: ${c}`
  }
}
