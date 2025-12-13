import { Backend, DecoderOptions, Kernel, Endian } from '../backend.js'
import { DEFAULT_DECODER_OPTIONS } from '../backend.js'
import { ErrorCode, fail } from '../error.js'
import { ReadCursor } from '../types.js'

interface RuntimeKernel extends Kernel {
  Num: number
  BigNum: bigint
  Str: string
  Bytes: Uint8Array
  Bool: boolean
  Buffer: Uint8Array
}

export const createReader = (userOpts?: DecoderOptions): Backend<ReadCursor, 'read', RuntimeKernel> => {
  const opts = { ...DEFAULT_DECODER_OPTIONS, ...userOpts }
  const check = opts.boundsCheck
  const DEC = new TextDecoder()

  return {
    mode: 'read',
    bool: check ? boolSafe : boolUnsafe,
    i8: check ? i8Safe : i8Unsafe,
    u8: check ? u8Safe : u8Unsafe,

    i16: check ? i16Safe : i16Unsafe,
    u16: check ? u16Safe : u16Unsafe,
    f16: check ? f16Safe : f16Unsafe,

    i32: check ? i32Safe : i32Unsafe,
    u32: check ? u32Safe : u32Unsafe,
    f32: check ? f32Safe : f32Unsafe,

    i64: check ? i64Safe : i64Unsafe,
    u64: check ? u64Safe : u64Unsafe,
    f64: check ? f64Safe : f64Unsafe,

    str: check ? strSafe(DEC, opts.maxStringLength) : strUnsafe(DEC),
    struct: optimizedStruct,
    list: (inner) => {
      const readLen = u32Safe()
      return (c) => {
        const len = readLen(c)
        if (len > opts.maxListLength) {
          fail(ErrorCode.OVERFLOW, `List length ${len} exceeds max ${opts.maxListLength}`, c.pos)
        }
        const arr = new Array(len)
        for (let i = 0; i < len; i++) {
          arr[i] = inner(c)
        }
        return arr
      }
    },

    access: (value: any, key: string | number) => value[key],

    wrap: <T>(internal: (c: ReadCursor) => T) => {
      return (input: Uint8Array) => {
        const c: ReadCursor = {
          buf: input,
          view: new DataView(input.buffer, input.byteOffset, input.byteLength),
          pos: 0,
          boundsCheck: opts.boundsCheck,
        }
        const result = internal(c)

        if (opts.strictEOF && c.pos !== input.byteLength) {
          fail(ErrorCode.TRAILING_DATA, `Trailing data: ${input.byteLength - c.pos} bytes left`, c.pos)
        }

        return result
      }
    },
  }
}

export const createSafe = (opts?: DecoderOptions) => createReader({ ...opts, boundsCheck: true })
export const createFast = (opts?: DecoderOptions) => createReader({ ...opts, boundsCheck: false })

const eof = (c: ReadCursor, n: number) =>
  fail(ErrorCode.EOF, `Need ${n} bytes, found ${c.buf.byteLength - c.pos}`, c.pos)

// ==========================================
// Boolean
// ==========================================

const boolUnsafe = () => (c: ReadCursor) => {
  const v = c.view.getUint8(c.pos)
  c.pos += 1
  return v !== 0
}

const boolSafe = () => (c: ReadCursor) => {
  ensure(c, 1)
  const v = c.view.getUint8(c.pos)
  c.pos += 1
  return v !== 0
}

// ==========================================
// 8-Bit
// ==========================================

const i8Unsafe = () => (c: ReadCursor) => {
  const v = c.view.getInt8(c.pos)
  c.pos += 1
  return v
}

const i8Safe = () => (c: ReadCursor) => {
  ensure(c, 1)
  const v = c.view.getInt8(c.pos)
  c.pos += 1
  return v
}

const u8Unsafe = () => (c: ReadCursor) => {
  const v = c.view.getUint8(c.pos)
  c.pos += 1
  return v
}

const u8Safe = () => (c: ReadCursor) => {
  ensure(c, 1)
  const v = c.view.getUint8(c.pos)
  c.pos += 1
  return v
}

// ==========================================
// 16-Bit
// ==========================================

const i16Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    const v = c.view.getInt16(c.pos, le)
    c.pos += 2
    return v
  }
}

const i16Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    ensure(c, 2)
    const v = c.view.getInt16(c.pos, le)
    c.pos += 2
    return v
  }
}

const u16Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    const v = c.view.getUint16(c.pos, le)
    c.pos += 2
    return v
  }
}

const u16Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    ensure(c, 2)
    const v = c.view.getUint16(c.pos, le)
    c.pos += 2
    return v
  }
}

const f16Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    const v = c.view.getFloat16(c.pos, le)
    c.pos += 2
    return v
  }
}

const f16Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    ensure(c, 2)
    const v = c.view.getFloat16(c.pos, le)
    c.pos += 2
    return v
  }
}

// ==========================================
// 32-Bit
// ==========================================

const i32Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    const v = c.view.getInt32(c.pos, le)
    c.pos += 4
    return v
  }
}

const i32Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    ensure(c, 4)
    const v = c.view.getInt32(c.pos, le)
    c.pos += 4
    return v
  }
}

const u32Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    const v = c.view.getUint32(c.pos, le)
    c.pos += 4
    return v
  }
}

const u32Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    ensure(c, 4)
    const v = c.view.getUint32(c.pos, le)
    c.pos += 4
    return v
  }
}

const f32Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    const v = c.view.getFloat32(c.pos, le)
    c.pos += 4
    return v
  }
}

const f32Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    ensure(c, 4)
    const v = c.view.getFloat32(c.pos, le)
    c.pos += 4
    return v
  }
}

// ==========================================
// 64-Bit
// ==========================================

const i64Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    const v = c.view.getBigInt64(c.pos, le)
    c.pos += 8
    return v
  }
}

const i64Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    ensure(c, 8)
    const v = c.view.getBigInt64(c.pos, le)
    c.pos += 8
    return v
  }
}

const u64Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    const v = c.view.getBigUint64(c.pos, le)
    c.pos += 8
    return v
  }
}

const u64Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    ensure(c, 8)
    const v = c.view.getBigUint64(c.pos, le)
    c.pos += 8
    return v
  }
}

const f64Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    const v = c.view.getFloat64(c.pos, le)
    c.pos += 8
    return v
  }
}

const f64Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: ReadCursor) => {
    ensure(c, 8)
    const v = c.view.getFloat64(c.pos, le)
    c.pos += 8
    return v
  }
}
// ==========================================
// String
// ==========================================

const strUnsafe = (dec: TextDecoder) => () => (c: ReadCursor) => {
  const len = c.view.getUint32(c.pos, false) // BE
  c.pos += 4
  const v = dec.decode(c.buf.subarray(c.pos, c.pos + len))
  c.pos += len
  return v
}

const strSafe = (dec: TextDecoder, maxLen: number) => () => (c: ReadCursor) => {
  ensure(c, 4)
  const len = c.view.getUint32(c.pos, false) // BE
  c.pos += 4

  // Security Check: DoS Prevention
  if (len > maxLen) {
    fail(ErrorCode.OVERFLOW, `String length ${len} exceeds max ${maxLen}`, c.pos)
  }

  // Bounds Check: Payload
  if (c.pos + len > c.buf.byteLength) return eof(c, len)

  const v = dec.decode(c.buf.subarray(c.pos, c.pos + len))
  c.pos += len
  return v
}

// ==========================================
// Struct
// ==========================================

// This creates distinct code paths so V8 can inline the decoders.
const optimizedStruct = (shape: Record<string, (c: ReadCursor) => any>): ((c: ReadCursor) => any) => {
  const fields = Object.keys(shape).map((key) => ({ key, fn: shape[key] }))
  const len = fields.length

  if (len === 1) {
    const f0 = fields[0]!
    return (c) => {
      const r: any = {}
      r[f0.key] = f0.fn!(c)
      return r
    }
  }

  if (len === 2) {
    const [f0, f1] = fields
    return (c) => {
      const r: any = {}
      r[f0!.key] = f0!.fn!(c)
      r[f1!.key] = f1!.fn!(c)
      return r
    }
  }

  if (len === 3) {
    const [f0, f1, f2] = fields
    return (c) => {
      const r: any = {}
      r[f0!.key] = f0!.fn!(c)
      r[f1!.key] = f1!.fn!(c)
      r[f2!.key] = f2!.fn!(c)
      return r
    }
  }

  if (len === 4) {
    const [f0, f1, f2, f3] = fields
    return (c) => {
      const r: any = {}
      r[f0!.key] = f0!.fn!(c)
      r[f1!.key] = f1!.fn!(c)
      r[f2!.key] = f2!.fn!(c)
      r[f3!.key] = f3!.fn!(c)
      return r
    }
  }

  if (len === 5) {
    const [f0, f1, f2, f3, f4] = fields
    return (c) => {
      const r: any = {}
      r[f0!.key] = f0!.fn!(c)
      r[f1!.key] = f1!.fn!(c)
      r[f2!.key] = f2!.fn!(c)
      r[f3!.key] = f3!.fn!(c)
      r[f4!.key] = f4!.fn!(c)
      return r
    }
  }

  if (len === 6) {
    const [f0, f1, f2, f3, f4, f5] = fields
    return (c) => {
      const r: any = {}
      r[f0!.key] = f0!.fn!(c)
      r[f1!.key] = f1!.fn!(c)
      r[f2!.key] = f2!.fn!(c)
      r[f3!.key] = f3!.fn!(c)
      r[f4!.key] = f4!.fn!(c)
      r[f5!.key] = f5!.fn!(c)
      return r
    }
  }

  if (len === 7) {
    const [f0, f1, f2, f3, f4, f5, f6] = fields
    return (c) => {
      const r: any = {}
      r[f0!.key] = f0!.fn!(c)
      r[f1!.key] = f1!.fn!(c)
      r[f2!.key] = f2!.fn!(c)
      r[f3!.key] = f3!.fn!(c)
      r[f4!.key] = f4!.fn!(c)
      r[f5!.key] = f5!.fn!(c)
      r[f6!.key] = f6!.fn!(c)
      return r
    }
  }

  if (len === 8) {
    const [f0, f1, f2, f3, f4, f5, f6, f7] = fields
    return (c) => {
      const r: any = {}
      r[f0!.key] = f0!.fn!(c)
      r[f1!.key] = f1!.fn!(c)
      r[f2!.key] = f2!.fn!(c)
      r[f3!.key] = f3!.fn!(c)
      r[f4!.key] = f4!.fn!(c)
      r[f5!.key] = f5!.fn!(c)
      r[f6!.key] = f6!.fn!(c)
      r[f7!.key] = f7!.fn!(c)
      return r
    }
  }

  if (len === 9) {
    const [f0, f1, f2, f3, f4, f5, f6, f7, f8] = fields
    return (c) => {
      const r: any = {}
      r[f0!.key] = f0!.fn!(c)
      r[f1!.key] = f1!.fn!(c)
      r[f2!.key] = f2!.fn!(c)
      r[f3!.key] = f3!.fn!(c)
      r[f4!.key] = f4!.fn!(c)
      r[f5!.key] = f5!.fn!(c)
      r[f6!.key] = f6!.fn!(c)
      r[f7!.key] = f7!.fn!(c)
      r[f8!.key] = f8!.fn!(c)
      return r
    }
  }

  return (c) => {
    const result: any = {}
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]!
      result[field.key] = field.fn!(c)
    }
    return result
  }
}

const ensure = (c: ReadCursor, bytes: number) => {
  if (c.boundsCheck && c.pos + bytes > c.buf.byteLength) eof(c, bytes)
}
