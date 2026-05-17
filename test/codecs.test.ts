import { it, describe, expect } from 'vitest'
import * as b from '../src/index.js'

const rt = <T>(c: b.Codec<T>, v: T) => b.decode(c, b.encode(c, v))[0]

describe('numeric boundaries', () => {
  it('uint min/max', () => {
    expect(rt(b.uint8(), 0)).toBe(0)
    expect(rt(b.uint8(), 255)).toBe(255)
    expect(rt(b.uint16(), 0)).toBe(0)
    expect(rt(b.uint16(), 65535)).toBe(65535)
    expect(rt(b.uint32(), 0)).toBe(0)
    expect(rt(b.uint32(), 4294967295)).toBe(4294967295)
  })
  it('int min/max (incl. negatives)', () => {
    expect(rt(b.int8(), -128)).toBe(-128)
    expect(rt(b.int8(), 127)).toBe(127)
    expect(rt(b.int16(), -32768)).toBe(-32768)
    expect(rt(b.int16(), 32767)).toBe(32767)
    expect(rt(b.int32(), -2147483648)).toBe(-2147483648)
    expect(rt(b.int32(), 2147483647)).toBe(2147483647)
  })
  it('bigint min/max', () => {
    expect(rt(b.bigInt64(), -0x8000000000000000n)).toBe(-0x8000000000000000n)
    expect(rt(b.bigInt64(), 0x7fffffffffffffffn)).toBe(0x7fffffffffffffffn)
    expect(rt(b.bigUint64(), 0n)).toBe(0n)
    expect(rt(b.bigUint64(), 0xffffffffffffffffn)).toBe(0xffffffffffffffffn)
  })
  it('floats: special values round-trip', () => {
    expect(rt(b.float64(), Math.PI)).toBe(Math.PI)
    expect(Object.is(rt(b.float64(), -0), -0)).toBe(true)
    expect(rt(b.float64(), Infinity)).toBe(Infinity)
    expect(rt(b.float64(), -Infinity)).toBe(-Infinity)
    expect(Number.isNaN(rt(b.float64(), NaN))).toBe(true)
    expect(rt(b.float32(), 1.5)).toBe(1.5)
  })
})

describe('decode: length-prefix DoS guard', () => {
  // A malicious length prefix should not be allowed to drive an unbounded
  // allocation. The decoder caps the claimed length by the remaining bytes
  // (1 byte minimum per item / pair).

  it('list (unsized item): rejects ln greater than remaining bytes', () => {
    const c = b.list(b.utf8())
    // Hand-craft: varint length 0xFF (1 byte), no payload.
    const buf = new Uint8Array([0xff, 0x01])
    expect(() => b.decode(c, buf)).toThrow(RangeError)
  })

  it('list (sized item): rejects ln * itemSize greater than remaining', () => {
    const c = b.list(b.uint32())
    // Varint 100, then only 4 bytes of payload (would need 400)
    const buf = new Uint8Array([100, 0, 0, 0, 0])
    expect(() => b.decode(c, buf)).toThrow(RangeError)
  })

  it('set (unsized item): rejects ln greater than remaining', () => {
    const c = b.set(b.utf8())
    const buf = new Uint8Array([0xff, 0x01])
    expect(() => b.decode(c, buf)).toThrow(RangeError)
  })

  it('map: rejects len greater than (remaining / minPair)', () => {
    const c = b.map(b.uint8(), b.uint8())
    // Each pair is 2 bytes. ln=200 needs 400 payload bytes.
    const buf = new Uint8Array(11)
    buf[0] = 200
    expect(() => b.decode(c, buf)).toThrow(RangeError)
  })

  it('valid lengths still decode normally', () => {
    const c = b.list(b.uint8())
    const buf = b.encode(c, [1, 2, 3, 4])
    expect(b.decode(c, buf)[0]).toEqual([1, 2, 3, 4])
  })

  it('huge attacker-controlled length is rejected before allocating', () => {
    const c = b.list(b.uint8())
    // 5-byte varint encoding 0xffffffff, no payload.
    const buf = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x0f])
    expect(() => b.decode(c, buf)).toThrow(RangeError)
  })
})

describe('length-prefix overflow', () => {
  it('list: throws when length exceeds length codec range', () => {
    const c = b.list(b.uint8(), { length: b.uint8() })
    const big = new Array(256).fill(0)
    expect(() => b.encode(c, big)).toThrow(RangeError)
  })
  it('bytes: throws when payload length exceeds length codec range', () => {
    const c = b.bytes({ length: b.uint8() })
    expect(() => b.encode(c, new Uint8Array(256))).toThrow(RangeError)
  })
  it('utf8: throws when encoded length exceeds length codec range', () => {
    const c = b.utf8({ length: b.uint8() })
    expect(() => b.encode(c, 'x'.repeat(256))).toThrow(RangeError)
  })
  it('varint: throws on negative or out-of-range values', () => {
    expect(() => b.encode(b.varint(), -1)).toThrow(RangeError)
    expect(() => b.encode(b.varint(), 0x100000000)).toThrow(RangeError)
  })
})

describe('varint', () => {
  it('round-trips boundaries', () => {
    for (const v of [0, 1, 127, 128, 16383, 16384, 0x1fffff, 0x200000, 0xfffffff, 0x10000000, 0xffffffff]) {
      expect(rt(b.varint(), v)).toBe(v)
    }
  })
  it('encodes 150 as 0x96 0x01 (LEB128)', () => {
    expect(b.encode(b.varint(), 150)).toEqual(new Uint8Array([0x96, 0x01]))
  })
})

describe('bool', () => {
  it('round-trips', () => {
    expect(rt(b.bool(), true)).toBe(true)
    expect(rt(b.bool(), false)).toBe(false)
    expect(b.encode(b.bool(), true)).toEqual(new Uint8Array([1]))
    expect(b.encode(b.bool(), false)).toEqual(new Uint8Array([0]))
  })
})

describe('utf8', () => {
  it('empty', () => expect(rt(b.utf8(), '')).toBe(''))
  it('unicode/multi-byte', () => {
    const s = '🦄 héllo 世界 שלום'
    expect(rt(b.utf8(), s)).toBe(s)
  })
  it('fixed: exact length', () => {
    const c = b.utf8({ size: 5 })
    expect(rt(c, 'hello')).toBe('hello')
  })
  it('fixed: strips trailing null padding on decode', () => {
    const c = b.utf8({ size: 5 })
    const buf = new Uint8Array(5)
    buf.set(new TextEncoder().encode('hi'))
    expect(b.decode(c, buf)[0]).toBe('hi')
  })
  it('fixed: throws RangeError when encoded length exceeds size', () => {
    const c = b.utf8({ size: 4 })
    expect(() => b.encode(c, 'toolong')).toThrow(RangeError)
  })
  it('fixed: pads shorter strings with null bytes when pad is set', () => {
    const c = b.utf8({ size: 5, pad: true })
    const buf = new Uint8Array([1, 2, 3, 4, 5])
    b.encodeInto(c, 'hi', buf)
    expect(buf).toEqual(new Uint8Array([0x68, 0x69, 0, 0, 0]))
    expect(b.decode(c, buf)[0]).toBe('hi')
  })
  it('fixed: without pad, leaves trailing bytes of caller buffer untouched', () => {
    const c = b.utf8({ size: 5 })
    const buf = new Uint8Array([1, 2, 3, 4, 5])
    b.encodeInto(c, 'hi', buf)
    expect(buf).toEqual(new Uint8Array([0x68, 0x69, 3, 4, 5]))
  })
})

describe('bytes', () => {
  it('dynamic: empty and non-empty', () => {
    expect(rt(b.bytes(), new Uint8Array())).toEqual(new Uint8Array())
    const v = new Uint8Array([1, 2, 3, 255, 0, 128])
    expect(rt(b.bytes(), v)).toEqual(v)
  })
  it('fixed: exact length', () => {
    const c = b.bytes({ size: 4 })
    const v = new Uint8Array([10, 20, 30, 40])
    expect(rt(c, v)).toEqual(v)
  })
  it('fixed: throws on length mismatch without pad', () => {
    const c = b.bytes({ size: 4 })
    expect(() => b.encode(c, new Uint8Array([1, 2]))).toThrow(RangeError)
    expect(() => b.encode(c, new Uint8Array([1, 2, 3, 4, 5]))).toThrow(RangeError)
  })
  it('fixed: pads shorter input when pad is set', () => {
    const c = b.bytes({ size: 4, pad: true })
    expect(b.encode(c, new Uint8Array([1, 2]))).toEqual(new Uint8Array([1, 2, 0, 0]))
  })
})

describe('literal', () => {
  it('zero-sized, returns fixed value', () => {
    const c = b.literal('hello' as const)
    expect(b.encode(c, 'hello')).toEqual(new Uint8Array(0))
    expect(b.decode(c, new Uint8Array())[0]).toBe('hello')
  })
})

describe('optional', () => {
  it('present and absent', () => {
    const c = b.optional(b.utf8())
    expect(rt<string | undefined>(c, undefined)).toBe(undefined)
    expect(rt<string | undefined>(c, 'x')).toBe('x')
    expect(b.encode<string | undefined>(c, undefined)).toEqual(new Uint8Array([0]))
    expect(b.encode(c, 'x')[0]).toBe(1)
  })
})

describe('nullable', () => {
  it('null and value', () => {
    const c = b.nullable(b.utf8())
    expect(rt(c, null)).toBe(null)
    expect(rt(c, 'x')).toBe('x')
    expect(b.encode(c, null)).toEqual(new Uint8Array([0]))
  })
})

describe('list', () => {
  it('empty', () => expect(rt(b.list(b.uint16()), [])).toEqual([]))
  it('many items', () => expect(rt(b.list(b.uint16()), [1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]))
  it('nested lists', () => {
    const c = b.list(b.list(b.uint8()))
    expect(rt(c, [[1, 2], [], [3]])).toEqual([[1, 2], [], [3]])
  })
})

describe('array (fixed-length)', () => {
  it('round-trips a fixed-length array of fixed-size items', () => {
    const c = b.array(b.uint8(), 3)
    expect(rt(c, [1, 2, 3])).toEqual([1, 2, 3])
  })
  it('encodes contiguously without a length prefix', () => {
    const c = b.array(b.uint8(), 3)
    expect(b.encode(c, [0xaa, 0xbb, 0xcc])).toEqual(new Uint8Array([0xaa, 0xbb, 0xcc]))
  })
  it('len of 0 yields zero-byte codec', () => {
    const c = b.array(b.uint8(), 0)
    expect(b.encode(c, [])).toEqual(new Uint8Array([]))
    expect(rt(c, [])).toEqual([])
  })
  it('composes inside a struct as a fixed-size field', () => {
    const c = b.struct({ tag: b.uint8(), bytes: b.array(b.uint8(), 4) })
    expect(rt(c, { tag: 1, bytes: [10, 20, 30, 40] })).toEqual({ tag: 1, bytes: [10, 20, 30, 40] })
  })
  it('nested fixed arrays round-trip', () => {
    const c = b.array(b.array(b.uint8(), 3), 2)
    expect(
      rt(c, [
        [1, 2, 3],
        [4, 5, 6],
      ]),
    ).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ])
  })
})

describe('map', () => {
  it('round-trips a Map<string, number>', () => {
    const c = b.map(b.utf8(), b.uint32())
    const v = new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    expect(rt(c, v)).toEqual(v)
  })
  it('empty map encodes to just the length prefix', () => {
    const c = b.map(b.utf8(), b.uint8())
    expect(b.encode(c, new Map())).toEqual(new Uint8Array([0]))
    expect(rt(c, new Map())).toEqual(new Map())
  })
  it('preserves insertion order on round-trip', () => {
    const c = b.map(b.utf8(), b.uint8())
    const v = new Map([
      ['z', 1],
      ['a', 2],
      ['m', 3],
    ])
    expect([...rt(c, v).keys()]).toEqual(['z', 'a', 'm'])
  })
  it('supports custom length codec', () => {
    const c = b.map(b.uint8(), b.uint8(), { length: b.uint8() })
    const v = new Map([
      [1, 10],
      [2, 20],
    ])
    expect(b.encode(c, v)).toEqual(new Uint8Array([2, 1, 10, 2, 20]))
    expect(rt(c, v)).toEqual(v)
  })
  it('handles complex value codecs', () => {
    const c = b.map(b.utf8(), b.struct({ x: b.uint8(), y: b.uint8() }))
    const v = new Map([
      ['p', { x: 1, y: 2 }],
      ['q', { x: 3, y: 4 }],
    ])
    expect(rt(c, v)).toEqual(v)
  })
})

describe('set', () => {
  it('round-trips a Set<number>', () => {
    const c = b.set(b.uint16())
    const v = new Set([1, 2, 3])
    expect(rt(c, v)).toEqual(v)
  })
  it('empty set encodes to just the length prefix', () => {
    const c = b.set(b.utf8())
    expect(b.encode(c, new Set())).toEqual(new Uint8Array([0]))
    expect(rt(c, new Set())).toEqual(new Set())
  })
  it('preserves insertion order on round-trip', () => {
    const c = b.set(b.utf8())
    const v = new Set(['z', 'a', 'm'])
    expect([...rt(c, v)]).toEqual(['z', 'a', 'm'])
  })
  it('supports custom length codec', () => {
    const c = b.set(b.uint8(), { length: b.uint8() })
    expect(b.encode(c, new Set([7, 8, 9]))).toEqual(new Uint8Array([3, 7, 8, 9]))
  })
  it('deduplicates on decode', () => {
    const c = b.set(b.uint8())
    const dup = new Uint8Array([4, 1, 2, 1, 2])
    expect(b.decode(c, dup)[0]).toEqual(new Set([1, 2]))
  })
})

describe('tuple', () => {
  it('mixed types', () => {
    const c = b.tuple(b.uint8(), b.utf8(), b.bool())
    expect(rt(c, [1, 'hi', true])).toEqual([1, 'hi', true])
  })
})

describe('struct', () => {
  it('preserves declaration order on encode', () => {
    const c = b.struct({ a: b.uint8(), b: b.uint8() })
    expect(b.encode(c, { a: 1, b: 2 })).toEqual(new Uint8Array([1, 2]))
  })
})

describe('partial', () => {
  it('round-trips with missing fields', () => {
    const c = b.partial(b.struct({ a: b.utf8(), b: b.utf8() }))
    expect(rt(c, {})).toEqual({})
    expect(rt(c, { a: 'x' })).toEqual({ a: 'x' })
    expect(rt(c, { a: 'x', b: 'y' })).toEqual({ a: 'x', b: 'y' })
  })
})

describe('intersection', () => {
  it('combines fields from multiple structs', () => {
    const c = b.intersect(b.struct({ a: b.uint8() }), b.struct({ b: b.utf8() }))
    expect(rt(c, { a: 1, b: 'hi' })).toEqual({ a: 1, b: 'hi' })
  })
})

describe('tagged', () => {
  it('all variants round-trip', () => {
    const c = b.tagged('tag', [
      b.struct({ tag: b.literal('a' as const), v: b.uint8() }),
      b.struct({ tag: b.literal('b' as const), v: b.utf8() }),
    ])
    expect(rt(c, { tag: 'a', v: 5 })).toEqual({ tag: 'a', v: 5 })
    expect(rt(c, { tag: 'b', v: 'hi' })).toEqual({ tag: 'b', v: 'hi' })
  })
  it('supports custom tag codec', () => {
    const c = b.tagged(
      'tag',
      [
        b.struct({ tag: b.literal('a' as const), v: b.uint8() }),
        b.struct({ tag: b.literal('b' as const), v: b.uint8() }),
      ],
      { tag: b.uint16() },
    )
    expect(b.encode(c, { tag: 'b', v: 7 })).toEqual(new Uint8Array([0, 1, 7]))
    expect(rt(c, { tag: 'a', v: 5 })).toEqual({ tag: 'a', v: 5 })
  })
})

describe('json', () => {
  it('round-trips arbitrary structures', () => {
    const c = b.json<{ a: number; b: string[]; c: { d: boolean | null } }>()
    const v = { a: 5, b: ['x', 'y'], c: { d: null } }
    expect(rt(c, v)).toEqual(v)
  })
})

describe('writer/reader', () => {
  it('writer with known size pre-allocates buffer', () => {
    const w = b.writer(5)
    b.uint8().e(w, 1)
    b.uint32().e(w, 0xdeadbeef)
    expect(w.flush()).toEqual(new Uint8Array([1, 0xde, 0xad, 0xbe, 0xef]))
  })
  it('writer(size).flush() returns only the written prefix, not the full preallocated buffer', () => {
    const w = b.writer(10)
    b.uint8().e(w, 0xab)
    b.uint8().e(w, 0xcd)
    expect(w.flush()).toEqual(new Uint8Array([0xab, 0xcd]))
  })
  it('writer with unknown size grows dynamically', () => {
    const w = b.writer()
    b.uint8().e(w, 0xab)
    b.uint16().e(w, 0xcdef)
    expect(w.flush()).toEqual(new Uint8Array([0xab, 0xcd, 0xef]))
  })
  it('reader honours starting offset', () => {
    const buf = new Uint8Array([0xff, 0xff, 1, 2])
    const r = b.reader(buf, 2)
    expect(b.uint8().d(r)).toBe(1)
    expect(b.uint8().d(r)).toBe(2)
  })
})

describe('read/write helpers', () => {
  it('write multiple, read multiple', () => {
    const w = b.writer()
    b.write(w, b.uint8(), 7)
    b.write(w, b.utf8(), 'hi')
    b.write(w, b.bool(), true)
    const [n, s, flag] = b.read(b.reader(w.flush()), b.uint8(), b.utf8(), b.bool())
    expect(n).toBe(7)
    expect(s).toBe('hi')
    expect(flag).toBe(true)
  })
})

describe('lazy', () => {
  it('round-trips a recursive tree', () => {
    type Tree = { v: number; c: Tree[] }
    const tree: b.Codec<Tree> = b.lazy(() => b.struct({ v: b.uint32(), c: b.list(tree) }))
    const v: Tree = {
      v: 1,
      c: [
        { v: 2, c: [{ v: 3, c: [] }] },
        { v: 4, c: [] },
      ],
    }
    expect(rt(tree, v)).toEqual(v)
  })
  it('supports mutually recursive schemas', () => {
    type A = { tag: 'a'; b?: B | undefined }
    type B = { tag: 'b'; a?: A | undefined }
    const a: b.Codec<A> = b.lazy(() => b.struct({ tag: b.literal('a' as const), b: b.optional(bRef) }))
    const bRef: b.Codec<B> = b.lazy(() => b.struct({ tag: b.literal('b' as const), a: b.optional(a) }))
    const v: A = { tag: 'a', b: { tag: 'b', a: { tag: 'a' } } }
    expect(rt(a, v)).toEqual(v)
  })
})

describe('transform', () => {
  const date = b.imap(
    b.float64(),
    (n) => new Date(n),
    (d) => d.getTime(),
  )
  // const buf = new Uint8Array(4)
  // const s = b.encodeInto(b.uint16(), 10, buf)
  // console.log(b.decode(b.uint32(), buf, 0)[0])

  it('round-trips Date through float64', () => {
    const v = new Date('2026-05-09T15:30:00Z')
    expect(rt(date, v)).toEqual(v)
  })
  it('preserves fixed size when wrapping a fixed codec', () => {
    expect(b.encode(date, new Date()).length).toBe(8)
  })
  it('produces dynamic size when wrapping a dynamic codec', () => {
    const set = b.imap(
      b.list(b.utf8()),
      (a) => new Set(a),
      (s: Set<string>) => [...s],
    )

    const v = new Set(['x', 'y', 'z'])
    expect(rt(set, v)).toEqual(v)
  })
  it('composes inside a struct', () => {
    const c = b.struct({ id: b.uint32(), at: date })
    const v = { id: 1, at: new Date('2026-01-01T00:00:00Z') }
    expect(rt(c, v)).toEqual(v)
  })
})

describe('flexibility extras', () => {
  it('decode honours offset', () => {
    const c = b.struct({ a: b.uint8(), b: b.uint16() })
    const enc = b.encode(c, { a: 7, b: 0x1234 })
    const padded = new Uint8Array(enc.length + 5)
    padded.set(enc, 5)
    expect(b.decode(c, padded, 5)[0]).toEqual({ a: 7, b: 0x1234 })
  })
  it('encode accepts an optional writer', () => {
    const c = b.struct({ a: b.uint8(), b: b.uint16() })
    const w = b.writer(c.s)
    const out = b.encode(c, { a: 0xff, b: 0xabcd }, w)
    expect(out).toEqual(new Uint8Array([0xff, 0xab, 0xcd]))
  })
  it('encode auto-preallocates buffer for fixed-size codecs', () => {
    const c = b.struct({ a: b.uint8(), b: b.uint16() })
    const out = b.encode(c, { a: 1, b: 2 })
    expect(out.length).toBe(c.s)
    expect(rt(c, { a: 1, b: 2 })).toEqual({ a: 1, b: 2 })
  })
  it('array supports custom length codec', () => {
    const c = b.list(b.uint8(), { length: b.uint8() })
    const out = b.encode(c, [1, 2, 3])
    expect(out).toEqual(new Uint8Array([3, 1, 2, 3]))
    expect(b.decode(c, out)[0]).toEqual([1, 2, 3])
  })
  it('bytes supports custom length codec', () => {
    const c = b.bytes({ length: b.uint16() })
    const v = new Uint8Array([0xaa, 0xbb])
    const out = b.encode(c, v)
    expect(out).toEqual(new Uint8Array([0, 2, 0xaa, 0xbb]))
    expect(b.decode(c, out)[0]).toEqual(v)
  })
  it('utf8 supports custom length codec', () => {
    const c = b.utf8({ length: b.uint8() })
    const out = b.encode(c, 'hi')
    expect(out).toEqual(new Uint8Array([2, 0x68, 0x69]))
    expect(b.decode(c, out)[0]).toBe('hi')
  })
})

describe('decode error context', () => {
  const expectDecodeError = (fn: () => unknown, path: string, offset: number) => {
    try {
      fn()
      throw new Error('expected decode to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(b.DecodeError)
      const de = e as b.DecodeError
      expect(de.message).toContain(`failed decoding '${path}'`)
      expect(de.message).toContain(`at offset ${offset}`)
      expect(de.path).toEqual(
        path
          .split(/(\[\d+\]|\.)/)
          .filter((s) => s && s !== '.')
          .map((s) => (s.startsWith('[') ? Number(s.slice(1, -1)) : s)),
      )
      expect(de.offset).toBe(offset)
      expect(de.cause).toBeInstanceOf(Error)
    }
  }

  it('fast path: throws plain RangeError without trace', () => {
    const c = b.struct({ a: b.uint32() })
    expect(() => b.decode(c, new Uint8Array(2))).toThrow(RangeError)
    expect(() => b.decode(c, new Uint8Array(2))).not.toThrow(b.DecodeError)
  })

  it('struct: reports field path on truncated buffer', () => {
    const c = b.struct({ a: b.uint8(), b: b.uint32() })
    const buf = b.encode(c, { a: 1, b: 2 }).slice(0, 3)
    expectDecodeError(() => b.decode(c, buf, { trace: true }), 'b', 1)
  })

  it('nested struct: reports dotted field path', () => {
    const c = b.struct({ outer: b.struct({ inner: b.uint32() }) })
    expectDecodeError(() => b.decode(c, new Uint8Array(2), { trace: true }), 'outer.inner', 0)
  })

  it('list of struct: reports index and field', () => {
    const c = b.list(b.struct({ id: b.uint32() }))
    const buf = b.encode(c, [{ id: 1 }, { id: 2 }]).slice(0, 7)
    expectDecodeError(() => b.decode(c, buf, { trace: true }), '[1].id', 5)
  })

  it('tuple: reports element index', () => {
    const c = b.tuple(b.uint8(), b.uint32())
    expectDecodeError(() => b.decode(c, new Uint8Array(3), { trace: true }), '[1]', 1)
  })

  it('array: reports element index', () => {
    const c = b.array(b.uint32(), 3)
    expectDecodeError(() => b.decode(c, new Uint8Array(10), { trace: true }), '[2]', 8)
  })

  it('set: reports element index', () => {
    const c = b.set(b.uint32())
    const buf = b.encode(c, new Set([1, 2])).slice(0, 6)
    expectDecodeError(() => b.decode(c, buf, { trace: true }), '[1]', 5)
  })

  it('tagged: reports variant tag value', () => {
    const c = b.tagged('kind', [
      b.struct({ kind: b.literal('a' as const), n: b.uint8() }),
      b.struct({ kind: b.literal('b' as const), n: b.uint32() }),
    ])
    const buf = new Uint8Array([1, 0, 0])
    expectDecodeError(() => b.decode(c, buf, { trace: true }), 'b.n', 1)
  })

  it('preserves original cause', () => {
    const c = b.struct({ a: b.uint32() })
    try {
      b.decode(c, new Uint8Array(2), { trace: true })
    } catch (e) {
      expect(e).toBeInstanceOf(b.DecodeError)
      expect((e as b.DecodeError).cause).toBeInstanceOf(RangeError)
    }
  })

  it('fallback restores trace path on inner failure (does not leak into siblings)', () => {
    // fallback over a composite: the inner traceChild pushes its segment onto the
    // path stack and only pops on success. Without the fix, the segment stays on
    // the stack after fallback catches, polluting paths of later siblings.
    const c = b.struct({
      a: b.fallback(b.struct({ inner: b.uint32() }), { inner: 0 }),
      b: b.uint32(),
    })
    try {
      b.decode(c, new Uint8Array([0, 0]), { trace: true })
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(b.DecodeError)
      expect((e as b.DecodeError).path).toEqual(['b'])
    }
  })

  it('honours offset in options object', () => {
    const c = b.uint32()
    const buf = new Uint8Array([0, 0, 0, 0, 0, 1, 2, 3])
    expect(b.decode(c, buf, { offset: 4 })[0]).toBe(0x00010203)
    expect(b.decode(c, buf, { offset: 4, trace: true })[0]).toBe(0x00010203)
  })
})
