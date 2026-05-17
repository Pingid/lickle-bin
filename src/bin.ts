import { Codec, Reader, Scalar, Size, Sized, Writer } from './types.js'

export const isSized = <D, E = D, S extends number = number>(c: Codec<D, E>): c is Size<S> & Codec<D, E> => 's' in c
export const noop = () => {}

export const _sz = (c: Codec<any>): number => (isSized(c) ? (c as Sized<any>).s : 0)
export const _grow = (w: Writer, n: number) => w.pos + n > w.buf.length && w.grow(n)

/** Largest non-negative integer a length codec can represent (varint caps at `2^32 − 1`). */
export const _lenMax = (lc: Codec<number>): number => {
  if (!isSized(lc)) return 0xffffffff
  const s = (lc as Sized<any>).s
  return s >= 7 ? Number.MAX_SAFE_INTEGER : 2 ** (s * 8) - 1
}

/** Validate and write a length prefix. Grows the writer for sized length codecs (varint grows itself). */
export const _writeLen = (w: Writer, lc: Codec<number>, n: number) => {
  const max = _lenMax(lc)
  if (n < 0 || n > max) throw new RangeError(`length ${n} out of range [0, ${max}] for length codec`)
  if (isSized(lc)) _grow(w, (lc as Sized<any>).s)
  lc.e(w, n)
}

/** Write a 1-byte "present" marker (`1`) */
export const _wPresent = (w: Writer, ins: number) => {
  if (w.pos + 1 + ins > w.buf.length) w.grow(1 + ins)
  w.dv.setUint8(w.pos, 1)
  w.pos += 1
}

/** Write a 1-byte unsigned integer */
export const _wu8 = (w: Writer, v: number) => {
  if (w.pos + 1 > w.buf.length) w.grow(1)
  w.dv.setUint8(w.pos, v)
  w.pos += 1
}

/** Read a 1-byte unsigned integer */
export const ru8 = (r: Reader): number => {
  const v = r.dv.getUint8(r.pos)
  r.pos += 1
  return v
}

// ---------------- Scalars ----------------

export const _bool: Scalar<1, boolean> = {
  s: 1,
  e: (w, v) => _wu8(w, v ? 1 : 0),
  d: (r) => ru8(r) !== 0,
}

export const _u8c: Scalar<1> = {
  s: 1,
  e: (w, v) => (w.dv.setUint8(w.pos, v), (w.pos += 1)),
  d: (r) => r.dv.getUint8((r.pos += 1) - 1),
}

export const _i8c: Scalar<1> = {
  s: 1,
  e: (w, v) => (w.dv.setInt8(w.pos, v), (w.pos += 1)),
  d: (r) => r.dv.getInt8((r.pos += 1) - 1),
}

export const _u16Be: Scalar<2> = {
  s: 2,
  e: (w, v) => (w.dv.setUint16(w.pos, v, false), (w.pos += 2)),
  d: (r) => r.dv.getUint16((r.pos += 2) - 2, false),
}
export const _u16Le: Scalar<2> = {
  s: 2,
  e: (w, v) => (w.dv.setUint16(w.pos, v, true), (w.pos += 2)),
  d: (r) => r.dv.getUint16((r.pos += 2) - 2, true),
}

export const _i16Be: Scalar<2> = {
  s: 2,
  e: (w, v) => (w.dv.setInt16(w.pos, v, false), (w.pos += 2)),
  d: (r) => r.dv.getInt16((r.pos += 2) - 2, false),
}
export const _i16Le: Scalar<2> = {
  s: 2,
  e: (w, v) => (w.dv.setInt16(w.pos, v, true), (w.pos += 2)),
  d: (r) => r.dv.getInt16((r.pos += 2) - 2, true),
}

export const _u32Be: Scalar<4> = {
  s: 4,
  e: (w, v) => (w.dv.setUint32(w.pos, v, false), (w.pos += 4)),
  d: (r) => r.dv.getUint32((r.pos += 4) - 4, false),
}
export const _u32Le: Scalar<4> = {
  s: 4,
  e: (w, v) => (w.dv.setUint32(w.pos, v, true), (w.pos += 4)),
  d: (r) => r.dv.getUint32((r.pos += 4) - 4, true),
}

export const _i32Be: Scalar<4> = {
  s: 4,
  e: (w, v) => (w.dv.setInt32(w.pos, v, false), (w.pos += 4)),
  d: (r) => r.dv.getInt32((r.pos += 4) - 4, false),
}
export const _i32Le: Scalar<4> = {
  s: 4,
  e: (w, v) => (w.dv.setInt32(w.pos, v, true), (w.pos += 4)),
  d: (r) => r.dv.getInt32((r.pos += 4) - 4, true),
}

export const _f32Be: Scalar<4> = {
  s: 4,
  e: (w, v) => (w.dv.setFloat32(w.pos, v, false), (w.pos += 4)),
  d: (r) => r.dv.getFloat32((r.pos += 4) - 4, false),
}
export const _f32Le: Scalar<4> = {
  s: 4,
  e: (w, v) => (w.dv.setFloat32(w.pos, v, true), (w.pos += 4)),
  d: (r) => r.dv.getFloat32((r.pos += 4) - 4, true),
}

export const _f64Be: Scalar<8> = {
  s: 8,
  e: (w, v) => (w.dv.setFloat64(w.pos, v, false), (w.pos += 8)),
  d: (r) => r.dv.getFloat64((r.pos += 8) - 8, false),
}
export const _f64Le: Scalar<8> = {
  s: 8,
  e: (w, v) => (w.dv.setFloat64(w.pos, v, true), (w.pos += 8)),
  d: (r) => r.dv.getFloat64((r.pos += 8) - 8, true),
}

export const _bi64Be: Scalar<8, bigint> = {
  s: 8,
  e: (w, v) => (w.dv.setBigInt64(w.pos, v, false), (w.pos += 8)),
  d: (r) => r.dv.getBigInt64((r.pos += 8) - 8, false),
}
export const _bi64Le: Scalar<8, bigint> = {
  s: 8,
  e: (w, v) => (w.dv.setBigInt64(w.pos, v, true), (w.pos += 8)),
  d: (r) => r.dv.getBigInt64((r.pos += 8) - 8, true),
}

export const _bu64Be: Scalar<8, bigint> = {
  s: 8,
  e: (w, v) => (w.dv.setBigUint64(w.pos, v, false), (w.pos += 8)),
  d: (r) => r.dv.getBigUint64((r.pos += 8) - 8, false),
}
export const _bu64Le: Scalar<8, bigint> = {
  s: 8,
  e: (w, v) => (w.dv.setBigUint64(w.pos, v, true), (w.pos += 8)),
  d: (r) => r.dv.getBigUint64((r.pos += 8) - 8, true),
}

export const _varint: Codec<number> = {
  e: (w, v) => {
    if (v < 0 || v > 0xffffffff) throw new RangeError(`varint: ${v} out of range [0, 0xffffffff]`)
    const s = v < 0x80 ? 1 : v < 0x4000 ? 2 : v < 0x200000 ? 3 : v < 0x10000000 ? 4 : 5
    w.grow(s)
    let o = w.pos
    while (v >= 0x80) {
      w.dv.setUint8(o++, (v & 0x7f) | 0x80)
      v >>>= 7
    }
    w.dv.setUint8(o, v)
    w.pos += s
  },
  d: (r) => {
    let v = 0
    let s = 0
    let b: number
    do {
      b = ru8(r)
      v |= (b & 0x7f) << s
      s += 7
    } while (b & 0x80)
    return v >>> 0
  },
}

// ---------------- Bytes ----------------
export const _lpBytes = (lc: Codec<number>): Codec<Uint8Array> => ({
  e: (w, v) => {
    _writeLen(w, lc, v.length)
    w.grow(v.length)
    w.buf.set(v, w.pos)
    w.pos += v.length
  },
  d: (r) => {
    const n = lc.d(r)
    r.expected(n)
    const v = r.buf.subarray(r.pos, r.pos + n)
    r.pos += n
    return v
  },
})

export const _sizedBytes = (n: number, pad?: boolean): Sized<Uint8Array, Uint8Array, number> => ({
  s: n,
  e: (w, v) => {
    if (v.length > n) throw new RangeError(`bytes(${n}): input length ${v.length} exceeds fixed size`)
    if (!pad && v.length !== n) {
      throw new RangeError(`bytes(${n}): input length ${v.length} ≠ fixed size (pass { pad: true } to allow shorter input)`)
    }
    w.buf.set(v, w.pos)
    if (pad && v.length < n) w.buf.fill(0, w.pos + v.length, w.pos + n)
    w.pos += n
  },
  d: (r) => {
    const v = r.buf.slice(r.pos, r.pos + n)
    r.pos += n
    return v
  },
})

// ---------------- Strings ----------------
let _te: TextEncoder | undefined
let _td: TextDecoder | undefined
const te = () => (_te ??= new TextEncoder())
const td = () => (_td ??= new TextDecoder())

export const _utf8: Codec<string, string> = {
  e: (w, v) => {
    const count = te().encodeInto(v, w.buf.subarray(w.pos))
    w.pos += count.written
  },
  d: (r) => td().decode(r.buf.subarray(r.pos, r.end)),
}

export const _lpUtf8 = (lc: Codec<number>): Codec<string> => {
  const maxLen = isSized(lc) ? lc.s : 5
  const lenCap = _lenMax(lc)
  return {
    e: (w, v) => {
      // Worst case 3 bytes/char + max varint length, encoded straight into writer buf
      const max = v.length * 3
      // Reserve length-prefix slot (worst-case 5) + payload
      w.grow(max + maxLen)
      // Encode payload after a temp gap so we can write the real length once known
      const tmpStart = w.pos + maxLen
      const { written } = te().encodeInto(v, w.buf.subarray(tmpStart))
      if (written > lenCap) {
        throw new RangeError(`utf8: encoded length ${written} exceeds length codec max ${lenCap}`)
      }
      // Emit varint length, then memmove payload tightly behind it
      const startPos = w.pos
      lc.e(w, written)
      const lcBytes = w.pos - startPos
      // If the length prefix is shorter than 5 bytes, slide the payload left
      if (lcBytes !== maxLen) w.buf.copyWithin(w.pos, tmpStart, tmpStart + written)
      w.pos += written
    },
    d: (r) => {
      const n = lc.d(r)
      r.expected(n)
      const v = td().decode(r.buf.subarray(r.pos, r.pos + n))
      r.pos += n
      return v
    },
  }
}

export const _sizedUtf8 = (n: number, pad?: boolean): Sized<string, string, number> => ({
  s: n,
  e: (w, v) => {
    const enc = te().encode(v)
    if (enc.length > n) throw new RangeError(`utf8(${n}): encoded length ${enc.length} exceeds fixed size`)
    w.buf.set(enc, w.pos)
    if (pad && enc.length < n) w.buf.fill(0, w.pos + enc.length, w.pos + n)
    w.pos += n
  },
  d: (r) => {
    const v = td()
      .decode(r.buf.subarray(r.pos, r.pos + n))
      .replace(/\0+$/, '')
    r.pos += n
    return v
  },
})
