import { Reader, Writer, Cursor } from './core.js'
import { BinError, ErrorCode, fail } from './error.js'

// Global safety limit for a single array (e.g., 5 million items)
// Prevents "RangeError: Invalid array length" crashes
const MAX_SAFE_ARRAY_LEN = 5_000_000

const checkList = (count: number, buf: Uint8Array, pos: number) => {
  // 1. Sanity: Is the number negative or absurdly large?
  if (count > MAX_SAFE_ARRAY_LEN) {
    return fail(ErrorCode.SIZE_LIMIT, `List length ${count} exceeds safety limit ${MAX_SAFE_ARRAY_LEN}`, pos)
  }
  // 2. Heuristic: "1 Byte Per Item" Rule.
  // If we have 10 bytes left in the buffer, we shouldn't attempt to read 100 items.
  // Even if items are 0-sized (like nulls), allowing this enables CPU-exhaustion loops.
  const remaining = buf.byteLength - pos
  if (count > remaining) {
    return fail(ErrorCode.SIZE_LIMIT, `List length ${count} exceeds remaining bytes ${remaining}`, pos)
  }
}

/** Creates a reader. */
export const reader = (buf: Uint8Array, offset: number = 0): Reader & Cursor => ({
  buf,
  view: new DataView(buf.buffer, buf.byteOffset, buf.byteLength), // <--- Allocated ONCE
  pos: offset,
  read<T>(size: number, fn: (view: DataView, offset: number) => T) {
    const t = fn(this.view, this.pos) // Pass the shared view
    this.pos += size
    return t
  },
  readBytes(size: number) {
    const start = this.pos
    this.pos += size
    return this.buf.subarray(start, this.pos)
  },
  checkList(count: number) {
    return checkList(count, this.buf, this.pos)
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
      throw new BinError(ErrorCode.EOF, `Need ${n} bytes, found ${len - pos}`, pos)
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
    view: new DataView(buf.buffer, buf.byteOffset, buf.byteLength),
    read<T>(size: number, fn: (view: DataView, offset: number) => T) {
      ensure(size)
      const start = pos
      pos += size
      return fn(this.view, start)
    },
    readBytes(size: number) {
      ensure(size)
      const start = pos
      pos += size
      return this.buf.subarray(start, pos)
    },
    checkList(count: number) {
      return checkList(count, this.buf, this.pos)
    },
  }
}

/**
 * Creates a writer for assembling binary data.
 * @param size - If provided, allocates a fixed Uint8Array (Fastest). If undefined, uses a dynamic list of chunks (Slower, but flexible).
 */
export const writer = (size?: number): Writer & { flush: () => Uint8Array } => {
  // Fast Path: Fixed Size
  if (typeof size === 'number') {
    const buf = new Uint8Array(size)
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength) // <--- Allocated ONCE
    let pos = 0
    return {
      write: (bytes, fn) => {
        fn(view, pos) // Pass the shared view
        pos += bytes
      },
      flush: () => buf,
    }
  }

  // Slow Path: Dynamic Size (Chunks)
  // We cannot share a single DataView easily across chunks, so we create them on demand.
  // Ideally, users should use fixed size writers for heavy number processing.
  const bufs: Uint8Array[] = []
  let totalLen = 0
  return {
    write(bytes, fn) {
      const chunk = new Uint8Array(bytes)
      const chunkView = new DataView(chunk.buffer)
      fn(chunkView, 0)
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
