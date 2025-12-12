import { Backend, EncoderOptions, Kernel, Endian } from '../backend.js'
import { DEFAULT_ENCODER_OPTIONS } from '../backend.js'
import { BufferStrategy } from './allocator.js'
import { ErrorCode, fail } from '../error.js'
import { WriteCursor } from '../types.js'

interface RuntimeKernel extends Kernel {
  Num: number
  BigNum: bigint
  Str: string
  Bytes: Uint8Array
  Bool: boolean
  Buffer: Uint8Array<ArrayBufferLike>
}

export const createWriter = (
  strategy: BufferStrategy,
  options?: EncoderOptions,
): Backend<WriteCursor, 'write', RuntimeKernel> => {
  const opts = { ...DEFAULT_ENCODER_OPTIONS, ...options }
  const check = opts.boundsCheck
  const ENC = new TextEncoder()

  return {
    mode: 'write',
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

    str: check ? strSafe(ENC) : strUnsafe(ENC),

    struct: (shape) => {
      const fields = Object.keys(shape).map((key) => [key, shape[key]] as const)
      return (c, value: any) => {
        for (let i = 0; i < fields.length; i++) {
          const field = fields[i]!
          field[1]!(c, value[field[0]!])
        }
      }
    },

    list: (inner) => {
      const writeLength = u32Safe()
      return (c, value: any[]) => {
        const len = value.length
        writeLength(c, len)
        for (let i = 0; i < len; i++) {
          inner(c, value[i])
        }
      }
    },

    access: (value: any, key: string | number) => value[key],
    wrap: <T>(internal: (c: WriteCursor, v: T) => void) => {
      return (val: T) => {
        const cursor = strategy.start()
        internal(cursor, val)
        return strategy.finish(cursor)
      }
    },
  }
}

const eof = (c: WriteCursor, n: number) =>
  fail(ErrorCode.EOF, `Need ${n} bytes, found ${c.buf.byteLength - c.pos}`, c.pos)

// ==========================================
// Boolean
// ==========================================

const boolUnsafe = () => (c: WriteCursor, v: boolean) => {
  c.view.setUint8(c.pos, v ? 1 : 0)
  c.pos += 1
}

const boolSafe = () => (c: WriteCursor, v: boolean) => {
  if (c.pos + 1 > c.buf.byteLength) {
    if (c.ensure) c.ensure(2)
    else return eof(c, 2)
  }
  c.view.setUint8(c.pos, v ? 1 : 0)
  c.pos += 1
}

// ==========================================
// 8-Bit
// ==========================================

const i8Unsafe = () => (c: WriteCursor, v: number) => {
  c.view.setInt8(c.pos, v)
  c.pos += 1
}

const i8Safe = () => (c: WriteCursor, v: number) => {
  if (c.pos + 1 > c.buf.byteLength) {
    if (c.ensure) c.ensure(2)
    else return eof(c, 2)
  }
  c.view.setInt8(c.pos, v)
  c.pos += 1
}

const u8Unsafe = () => (c: WriteCursor, v: number) => {
  c.view.setUint8(c.pos, v)
  c.pos += 1
}

const u8Safe = () => (c: WriteCursor, v: number) => {
  if (c.pos + 1 > c.buf.byteLength) {
    if (c.ensure) c.ensure(2)
    else return eof(c, 2)
  }
  c.view.setUint8(c.pos, v)
  c.pos += 1
}

// ==========================================
// 16-Bit
// ==========================================

const i16Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    c.view.setInt16(c.pos, v, le)
    c.pos += 2
  }
}

const i16Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    if (c.pos + 2 > c.buf.byteLength) {
      if (c.ensure) c.ensure(2)
      else return eof(c, 2)
    }
    c.view.setInt16(c.pos, v, le)
    c.pos += 2
  }
}

const u16Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    c.view.setUint16(c.pos, v, le)
    c.pos += 2
  }
}

const u16Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    if (c.pos + 2 > c.buf.byteLength) {
      if (c.ensure) c.ensure(2)
      else return eof(c, 2)
    }
    c.view.setUint16(c.pos, v, le)
    c.pos += 2
  }
}

const f16Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    c.view.setFloat16(c.pos, v, le)
    c.pos += 2
  }
}

const f16Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    if (c.pos + 2 > c.buf.byteLength) {
      if (c.ensure) c.ensure(2)
      else return eof(c, 2)
    }
    c.view.setFloat16(c.pos, v, le)
    c.pos += 2
  }
}

// ==========================================
// 32-Bit
// ==========================================

const i32Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    c.view.setInt32(c.pos, v, le)
    c.pos += 4
  }
}

const i32Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    if (c.pos + 4 > c.buf.byteLength) {
      if (c.ensure) c.ensure(4)
      else return eof(c, 4)
    }
    c.view.setInt32(c.pos, v, le)
    c.pos += 4
  }
}

const u32Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    c.view.setUint32(c.pos, v, le)
    c.pos += 4
  }
}

const u32Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    if (c.pos + 4 > c.buf.byteLength) {
      if (c.ensure) c.ensure(4)
      else return eof(c, 4)
    }
    c.view.setUint32(c.pos, v, le)
    c.pos += 4
  }
}

const f32Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    c.view.setFloat32(c.pos, v, le)
    c.pos += 4
  }
}

const f32Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    if (c.pos + 4 > c.buf.byteLength) {
      if (c.ensure) c.ensure(4)
      else return eof(c, 4)
    }
    c.view.setFloat32(c.pos, v, le)
    c.pos += 4
  }
}

// ==========================================
// 64-Bit
// ==========================================

const i64Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: bigint) => {
    c.view.setBigInt64(c.pos, v, le)
    c.pos += 8
  }
}

const i64Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: bigint) => {
    if (c.pos + 8 > c.buf.byteLength) {
      if (c.ensure) c.ensure(8)
      else return eof(c, 8)
    }
    c.view.setBigInt64(c.pos, v, le)
    c.pos += 8
  }
}

const u64Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: bigint) => {
    c.view.setBigUint64(c.pos, v, le)
    c.pos += 8
  }
}

const u64Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: bigint) => {
    if (c.pos + 8 > c.buf.byteLength) {
      if (c.ensure) c.ensure(8)
      else return eof(c, 8)
    }
    c.view.setBigUint64(c.pos, v, le)
    c.pos += 8
  }
}

const f64Unsafe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    c.view.setFloat64(c.pos, v, le)
    c.pos += 8
  }
}

const f64Safe = (endian?: Endian) => {
  const le = endian === 'le'
  return (c: WriteCursor, v: number) => {
    if (c.pos + 8 > c.buf.byteLength) {
      if (c.ensure) c.ensure(8)
      else return eof(c, 8)
    }
    c.view.setFloat64(c.pos, v, le)
    c.pos += 8
  }
}
// ==========================================
// String
// ==========================================

const strUnsafe = (encoder: TextEncoder) => () => (c: WriteCursor, v: string) => {
  const start = c.pos
  c.pos += 4
  const result = encoder.encodeInto(v, c.buf.subarray(c.pos))
  c.view.setUint32(start, result.written, false) // BE
  c.pos += result.written
}

const strSafe = (encoder: TextEncoder) => () => (c: WriteCursor, v: string) => {
  const encoded = encoder.encode(v)
  const needed = 4 + encoded.length
  if (c.pos + needed > c.buf.byteLength) {
    if (c.ensure) c.ensure(needed)
    else return eof(c, needed)
  }
  c.view.setUint32(c.pos, encoded.length, false) // BE
  c.pos += 4
  c.buf.set(encoded, c.pos)
  c.pos += encoded.length
}
