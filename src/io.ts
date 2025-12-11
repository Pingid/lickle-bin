import { Reader, Writer, Cursor } from './core.js'
import { ErrorCode, fail } from './error.js'

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
  view: new DataView(buf.buffer, buf.byteOffset, buf.byteLength),
  pos: offset,
  check(offset: number, bytes: number) {
    if (offset + bytes > this.buf.byteLength)
      fail(ErrorCode.EOF, `Need ${bytes} bytes, found ${this.buf.byteLength - offset}`, offset)
  },
  readBytes(size: number) {
    const start = this.pos
    this.pos += size
    return this.buf.subarray(start, this.pos)
  },
  checkList(count: number) {
    checkList(count, this.buf, this.pos)
  },
})

/** * Creates a safe reader that throws descriptive errors if reading out of bounds.
 * Recommended for decoding data from network or disk.
 */
export const checkedReader = (buf: Uint8Array, offset: number = 0): Reader & Cursor => {
  let pos = offset
  const len = buf.byteLength
  const raw = new DataView(buf.buffer, buf.byteOffset, len)

  const ensure = (n: number) => {
    if (pos + n > len) fail(ErrorCode.EOF, `Need ${n} bytes, found ${len - pos}`, pos)
  }

  // const check = (offset: number, bytes: number) => {
  //   if (offset + bytes > len) fail(ErrorCode.EOF, `Need ${bytes} bytes, found ${len - offset}`, offset)
  // }

  return {
    buf,
    view: raw,
    get pos() {
      return pos
    },
    set pos(n: number) {
      pos = n
    },
    check(offset: number, bytes: number) {
      if (offset + bytes > len) fail(ErrorCode.EOF, `Need ${bytes} bytes, found ${len - offset}`, offset)
    },
    readBytes(size: number) {
      ensure(size)
      const start = pos
      pos += size
      return this.buf.subarray(start, pos)
    },
    checkList(count: number) {
      checkList(count, this.buf, this.pos)
    },
  }
}

/**
 * Creates a writer for assembling binary data.
 * @param size - If provided, allocates a fixed Uint8Array (Fastest). If undefined, uses a dynamic list of chunks (Slower, but flexible).
 */
export const writer = (buf: Uint8Array): Writer => ({
  buf,
  view: new DataView(buf.buffer, buf.byteOffset, buf.byteLength),
  pos: 0,
})
