import { ErrorCode, fail } from '../error.js'
import { EncoderOptions } from '../backend.js'
import { WriteCursor } from '../types.js'

export type BufferStrategy = {
  /** Prepare the cursor for a new write. */
  start: () => WriteCursor
  /** Ensure there is space for 'n' more bytes. Resize if necessary. */
  ensure: (c: WriteCursor, additionalBytes: number) => void
  /** Finalize and extract the result. */
  finish: (c: WriteCursor) => Uint8Array
}

export const createStaticStrategy = (size: number): BufferStrategy => ({
  start: () => {
    const buf = new Uint8Array(size)
    return { buf, view: new DataView(buf.buffer, buf.byteOffset, buf.byteLength), pos: 0 }
  },
  ensure: () => {},
  finish: (c) => c.buf,
})

export const createDynamicStrategy = (opts?: EncoderOptions): BufferStrategy => ({
  start: () => {
    const size = opts?.initialBufferSize ?? 512
    const buf = new Uint8Array(size)
    return { buf, view: new DataView(buf.buffer), pos: 0 }
  },

  ensure: (c, needed) => {
    const required = c.pos + needed
    if (required > c.buf.byteLength) {
      // Growth Logic: Double size until it fits
      let newSize = c.buf.byteLength * 2
      while (newSize < required) newSize *= 2

      // Security Cap
      if (opts?.maxBufferSize && newSize > opts.maxBufferSize) {
        return fail(ErrorCode.OVERFLOW, 'Max buffer size exceeded', c.pos)
      }

      // Re-allocate and Copy
      const newBuf = new Uint8Array(newSize)
      newBuf.set(c.buf)

      // Update Cursor References
      c.buf = newBuf
      c.view = new DataView(newBuf.buffer, newBuf.byteOffset, newBuf.byteLength)
    }
  },
  finish: (c) => c.buf.subarray(0, c.pos),
})
