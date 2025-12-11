import { Reader, Writer, Cursor } from './core.js'

/** * Creates a fast reader.
 * WARNING: Does not perform bounds checking for performance.
 * JS engines will typically return undefined or throw RangeError if you read past the end,
 * but using `checkedReader` is recommended for untrusted input.
 */
export const reader = (buf: Uint8Array, offset: number = 0): Reader & Cursor => ({
  buf,
  pos: offset,
  read<T>(size: number, fn: (buffer: Uint8Array, o: number, e: number) => T) {
    const start = this.pos
    this.pos += size
    return fn(this.buf, start, this.pos)
  },
})

/** * Creates a safe reader that throws descriptive errors if reading out of bounds.
 * Recommended for decoding data from network or disk.
 */
export const checkedReader = (buf: Uint8Array, offset: number = 0): Reader & Cursor => {
  let pos = offset
  const len = buf.byteLength

  const ensure = (n: number) => {
    if (pos + n > len) {
      throw new Error(`Unexpected EOF: need ${n} bytes at offset ${pos}, but only ${len - pos} remain`)
    }
  }

  return {
    buf,
    get pos() {
      return pos
    },
    set pos(n: number) {
      pos = n
    },
    read<T>(size: number, fn: (b: Uint8Array, o: number, e: number) => T) {
      ensure(size)
      const start = pos
      pos += size
      return fn(buf, start, pos)
    },
  }
}

/**
 * Creates a writer for assembling binary data.
 * @param size - If provided, allocates a fixed Uint8Array (Fastest). If undefined, uses a dynamic list of chunks (Slower, but flexible).
 */
export const writer = (size?: number): Writer & { flush: () => Uint8Array } => {
  if (typeof size === 'number') {
    const buf = new Uint8Array(size)
    let pos = 0
    return {
      write: (bytes, fn) => {
        if (pos + bytes > size) throw new Error('Fixed writer overflow')
        fn(buf, pos)
        pos += bytes
      },
      flush: () => buf,
    }
  }

  const bufs: Uint8Array[] = []
  let totalLen = 0

  return {
    write(bytes, fn) {
      const chunk = new Uint8Array(bytes)
      fn(chunk, 0)
      bufs.push(chunk)
      totalLen += bytes
    },
    flush() {
      if (bufs.length === 1) return bufs[0]!
      const out = new Uint8Array(totalLen)
      let offset = 0
      for (const buf of bufs) {
        out.set(buf, offset)
        offset += buf.length
      }
      return out
    },
  }
}

/**
 * Efficiently creates a DataView.
 */
export const dv = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength)
