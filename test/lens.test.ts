import { describe, it, expect } from 'vitest'
import * as b from '../src/index.js'

describe('lens: reserved-name disambiguation', () => {
  it('struct fields named like lens accessors do not collide', () => {
    const c = b.struct({
      read: b.uint8(),
      write: b.uint8(),
      slice: b.uint8(),
      size: b.uint8(),
      offset: b.uint8(),
      codec: b.uint8(),
    })
    const L = b.lens(c)
    const buf = b.encode(c, { read: 1, write: 2, slice: 3, size: 4, offset: 5, codec: 6 })
    expect(L.read.$read(buf)).toBe(1)
    expect(L.write.$read(buf)).toBe(2)
    expect(L.slice.$read(buf)).toBe(3)
    expect(L.size.$read(buf)).toBe(4)
    expect(L.offset.$read(buf)).toBe(5)
    expect(L.codec.$read(buf)).toBe(6)
    L.read.$write(buf, 99)
    expect(b.decode(c, buf)[0].read).toBe(99)
  })
})

describe('lens: imap', () => {
  it('does not drill into the underlying struct shape after imap', () => {
    // imap transforms struct → number; lens must not expose `.a` from the inner struct.
    const c = b.imap(
      b.struct({ a: b.uint8() }),
      ({ a }) => a,
      (a) => ({ a }),
    )
    const L = b.lens(c) as any
    expect(L.a).toBeUndefined()
    const buf = b.encode(c, 7)
    expect(L.$read(buf)).toBe(7)
  })
})

describe('lens: scalar leaf', () => {
  const L = b.lens(b.uint16())
  it('reads / writes / exposes offset+size', () => {
    expect(L.$offset).toBe(0)
    expect(L.$size).toBe(2)
    const buf = b.encode(b.uint16(), 0x1234)
    expect(L.$read(buf)).toBe(0x1234)
    L.$write(buf, 0xbeef)
    expect(L.$read(buf)).toBe(0xbeef)
  })
})

describe('lens: struct', () => {
  const c = b.struct({ a: b.uint8(), b: b.uint16(), c: b.int32() })
  const L = b.lens(c)

  it('precomputes offsets / sizes', () => {
    expect(L.a.$offset).toBe(0)
    expect(L.a.$size).toBe(1)
    expect(L.b.$offset).toBe(1)
    expect(L.b.$size).toBe(2)
    expect(L.c.$offset).toBe(3)
    expect(L.c.$size).toBe(4)
    expect(L.$size).toBe(7)
  })

  it('reads scalar fields', () => {
    const buf = b.encode(c, { a: 1, b: 0x1234, c: -42 })
    expect(L.a.$read(buf)).toBe(1)
    expect(L.b.$read(buf)).toBe(0x1234)
    expect(L.c.$read(buf)).toBe(-42)
  })

  it('writes scalar fields', () => {
    const buf = b.encode(c, { a: 1, b: 0x1234, c: -42 })
    L.a.$write(buf, 9)
    L.b.$write(buf, 0xbeef)
    L.c.$write(buf, 7)
    expect(b.decode(c, buf)[0]).toEqual({ a: 9, b: 0xbeef, c: 7 })
  })

  it('whole-struct read and write', () => {
    const buf = b.encode(c, { a: 1, b: 2, c: 3 })
    expect(L.$read(buf)).toEqual({ a: 1, b: 2, c: 3 })
    L.$write(buf, { a: 9, b: 8, c: -7 })
    expect(b.decode(c, buf)[0]).toEqual({ a: 9, b: 8, c: -7 })
  })

  it('honours base offset', () => {
    const buf = new Uint8Array(c.s + 4)
    b.encodeInto(c, { a: 1, b: 0x1234, c: -42 }, buf, 4)
    expect(L.a.$read(buf, 4)).toBe(1)
    expect(L.b.$read(buf, 4)).toBe(0x1234)
  })
})

describe('lens: nested structs', () => {
  const c = b.struct({
    head: b.struct({ a: b.uint8(), b: b.uint8() }),
    tail: b.struct({ x: b.uint16(), y: b.uint16() }),
  })
  const L = b.lens(c)

  it('drills into nested fields', () => {
    const buf = b.encode(c, { head: { a: 1, b: 2 }, tail: { x: 100, y: 200 } })
    expect(L.head.a.$read(buf)).toBe(1)
    expect(L.head.b.$read(buf)).toBe(2)
    expect(L.tail.y.$read(buf)).toBe(200)
  })

  it('writes via nested leaf setter', () => {
    const buf = b.encode(c, { head: { a: 1, b: 2 }, tail: { x: 100, y: 200 } })
    L.head.a.$write(buf, 9)
    L.tail.x.$write(buf, 0xabcd)
    expect(b.decode(c, buf)[0]).toEqual({ head: { a: 9, b: 2 }, tail: { x: 0xabcd, y: 200 } })
  })

  it('reads/writes nested struct as a whole', () => {
    const buf = b.encode(c, { head: { a: 1, b: 2 }, tail: { x: 100, y: 200 } })
    expect(L.head.$read(buf)).toEqual({ a: 1, b: 2 })
    L.tail.$write(buf, { x: 1, y: 2 })
    expect(b.decode(c, buf)[0]).toEqual({ head: { a: 1, b: 2 }, tail: { x: 1, y: 2 } })
  })
})

describe('lens: tuple', () => {
  const c = b.tuple(b.uint8(), b.uint16(), b.int32())
  const L = b.lens(c)

  it('exposes indexed lenses + length', () => {
    expect(L.length).toBe(3)
    expect(L[0]!.$offset).toBe(0)
    expect(L[1]!.$offset).toBe(1)
    expect(L[2]!.$offset).toBe(3)
  })

  it('reads / writes by index', () => {
    const buf = b.encode(c, [1, 2, 3])
    expect(L[0]!.$read(buf)).toBe(1)
    expect(L[1]!.$read(buf)).toBe(2)
    expect(L[2]!.$read(buf)).toBe(3)
    L[1]!.$write(buf, 0x4242)
    expect(b.decode(c, buf)[0]).toEqual([1, 0x4242, 3])
  })
})

describe('lens: array (fixed)', () => {
  const c = b.array(b.uint16(), 4)
  const L = b.lens(c)

  it('exposes per-index lenses with precomputed offsets', () => {
    expect(L.length).toBe(4)
    expect(L.at(0).$offset).toBe(0)
    expect(L.at(2).$offset).toBe(4)
  })

  it('reads / writes by index', () => {
    const buf = b.encode(c, [10, 20, 30, 40])
    expect(L.at(0).$read(buf)).toBe(10)
    expect(L.at(3).$read(buf)).toBe(40)
    L.at(2).$write(buf, 999)
    expect(b.decode(c, buf)[0]).toEqual([10, 20, 999, 40])
  })

  it('throws on out-of-bounds index', () => {
    expect(() => L.at(-1)).toThrow(RangeError)
    expect(() => L.at(4)).toThrow(RangeError)
  })
})

describe('lens: array of structs', () => {
  const item = b.struct({ x: b.uint8(), y: b.uint8() })
  const c = b.array(item, 3)
  const L = b.lens(c)

  it('drills into struct via at(i).<field>', () => {
    const buf = b.encode(c, [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
    ])
    expect(L.at(1).x.$read(buf)).toBe(3)
    expect(L.at(2).y.$read(buf)).toBe(6)
    L.at(1).x.$write(buf, 99)
    expect(b.decode(c, buf)[0]).toEqual([
      { x: 1, y: 2 },
      { x: 99, y: 4 },
      { x: 5, y: 6 },
    ])
  })
})

describe('lens: list of sized', () => {
  const c = b.list(b.uint16())
  const L = b.lens(c)

  it('whole-list read/write', () => {
    const buf = b.encode(c, [10, 20, 30])
    expect(L.$read(buf)).toEqual([10, 20, 30])
    L.$write(buf, [1, 2, 3])
    expect(b.decode(c, buf)[0]).toEqual([1, 2, 3])
  })

  it('rejects whole-list write of different length', () => {
    const buf = b.encode(c, [1, 2, 3])
    expect(() => L.$write(buf, [1, 2])).toThrow(RangeError)
    expect(() => L.$write(buf, [1, 2, 3, 4])).toThrow(RangeError)
  })

  it('bind() returns a per-buffer handle for repeat access', () => {
    const buf = b.encode(c, [10, 20, 30, 40, 50])
    const bound = L.bind(buf)
    expect(bound.length).toBe(5)
    expect(bound.at(0)).toBe(10)
    expect(bound.at(4)).toBe(50)
    bound.set(2, 999)
    expect(b.decode(c, buf)[0]).toEqual([10, 20, 999, 40, 50])
  })

  it('forEach + toArray', () => {
    const buf = b.encode(c, [1, 2, 3])
    const bound = L.bind(buf)
    const seen: number[] = []
    bound.forEach((v, i) => seen.push(v + i))
    expect(seen).toEqual([1, 3, 5])
    expect(bound.toArray()).toEqual([1, 2, 3])
  })

  it('out-of-bounds at()/set() throws', () => {
    const buf = b.encode(c, [1, 2, 3])
    const bound = L.bind(buf)
    expect(() => bound.at(3)).toThrow(RangeError)
    expect(() => bound.set(-1, 0)).toThrow(RangeError)
  })
})

describe('lens: list of structs', () => {
  const item = b.struct({ k: b.uint8(), v: b.uint16() })
  const c = b.list(item)
  const L = b.lens(c)

  it('bound.at returns decoded struct', () => {
    const buf = b.encode(c, [
      { k: 1, v: 10 },
      { k: 2, v: 20 },
    ])
    const bound = L.bind(buf)
    expect(bound.at(0)).toEqual({ k: 1, v: 10 })
    expect(bound.at(1)).toEqual({ k: 2, v: 20 })
  })

  it('bound.set writes whole struct at index', () => {
    const buf = b.encode(c, [
      { k: 1, v: 10 },
      { k: 2, v: 20 },
    ])
    L.bind(buf).set(1, { k: 9, v: 99 })
    expect(b.decode(c, buf)[0]).toEqual([
      { k: 1, v: 10 },
      { k: 9, v: 99 },
    ])
  })
})

describe('lens: set of sized', () => {
  const c = b.set(b.uint16())
  const L = b.lens(c)

  it('reads as Set, writes same cardinality', () => {
    const buf = b.encode(c, new Set([1, 2, 3]))
    expect([...L.$read(buf)]).toEqual([1, 2, 3])
    L.$write(buf, new Set([10, 20, 30]))
    expect([...b.decode(c, buf)[0]]).toEqual([10, 20, 30])
  })

  it('rejects set write of different cardinality', () => {
    const buf = b.encode(c, new Set([1, 2, 3]))
    expect(() => L.$write(buf, new Set([1, 2]))).toThrow(RangeError)
  })
})

describe('lens: dynamic-position fields', () => {
  // Struct with utf8 in the middle — `age` and `score` live at offsets that
  // depend on the encoded length of `name`.
  const c = b.struct({ name: b.utf8(), age: b.uint8(), score: b.uint32() })
  const L = b.lens(c)

  it('reads each field correctly', () => {
    const buf = b.encode(c, { name: 'alice', age: 30, score: 1000 })
    expect(L.name.$read(buf)).toBe('alice')
    expect(L.age.$read(buf)).toBe(30)
    expect(L.score.$read(buf)).toBe(1000)
  })

  it('does not expose `offset` for dynamic-position fields', () => {
    expect(L.name.$offset).toBe(0)
    expect(L.age.$offset).toBeUndefined()
    expect(L.score.$offset).toBeUndefined()
  })

  it('writes a sized field at a dynamic position', () => {
    const buf = b.encode(c, { name: 'alice', age: 30, score: 1000 })
    L.age.$write(buf, 99)
    L.score.$write(buf, 0xdeadbeef)
    expect(b.decode(c, buf)[0]).toEqual({ name: 'alice', age: 99, score: 0xdeadbeef })
  })

  it('accepts unsized write of identical encoded length', () => {
    const buf = b.encode(c, { name: 'alice', age: 30, score: 1000 })
    L.name.$write(buf, 'becca') // also 5 bytes UTF-8
    expect(b.decode(c, buf)[0]).toEqual({ name: 'becca', age: 30, score: 1000 })
  })

  it('rejects unsized write with different encoded length', () => {
    const buf = b.encode(c, { name: 'alice', age: 30, score: 1000 })
    expect(() => L.name.$write(buf, 'bob')).toThrow(RangeError)
    expect(() => L.name.$write(buf, 'alexandra')).toThrow(RangeError)
    // and the buffer is unchanged
    expect(L.name.$read(buf)).toBe('alice')
    expect(L.age.$read(buf)).toBe(30)
    expect(L.score.$read(buf)).toBe(1000)
  })
})

describe('lens: list of unsized item', () => {
  const c = b.list(b.utf8())
  const L = b.lens(c)

  it('bound iterates and reads via cached offsets', () => {
    const buf = b.encode(c, ['hi', 'world', 'foo'])
    const bound = L.bind(buf)
    expect(bound.length).toBe(3)
    expect(bound.at(0)).toBe('hi')
    expect(bound.at(2)).toBe('foo')
    expect([...bound]).toEqual(['hi', 'world', 'foo'])
    expect(bound.toArray()).toEqual(['hi', 'world', 'foo'])
  })

  it('rejects per-index set with different encoded length', () => {
    const buf = b.encode(c, ['hi', 'world', 'foo'])
    const bound = L.bind(buf)
    expect(() => bound.set(1, 'morelongstring')).toThrow(RangeError)
  })
})

describe('lens: slice() returns zero-copy view', () => {
  it('sized leaf returns subarray of correct length', () => {
    const c = b.struct({ a: b.uint8(), b: b.uint32(), c: b.uint8() })
    const L = b.lens(c)
    const buf = b.encode(c, { a: 1, b: 0x01020304, c: 9 })
    const slice = L.b.$slice(buf)
    expect(slice).toBeInstanceOf(Uint8Array)
    expect(slice.length).toBe(4)
    expect(slice.buffer).toBe(buf.buffer) // zero-copy
  })

  it('unsized leaf returns subarray covering encoded form', () => {
    const c = b.struct({ id: b.uint8(), name: b.utf8() })
    const L = b.lens(c)
    const buf = b.encode(c, { id: 7, name: 'hello' })
    const slice = L.name.$slice(buf)
    // 1 byte varint length + 5 bytes 'hello' = 6 bytes
    expect(slice.length).toBe(6)
    expect(slice[0]).toBe(5) // varint length
  })
})

describe('lens: Symbol.iterator on bound', () => {
  it('list spread / for-of', () => {
    const c = b.list(b.uint16())
    const L = b.lens(c)
    const buf = b.encode(c, [10, 20, 30])
    const bound = L.bind(buf)
    expect([...bound]).toEqual([10, 20, 30])
    let sum = 0
    for (const x of bound) sum += x
    expect(sum).toBe(60)
  })

  it('set spread / for-of', () => {
    const c = b.set(b.uint16())
    const L = b.lens(c)
    const buf = b.encode(c, new Set([1, 2, 3]))
    const bound = L.bind(buf)
    expect([...bound]).toEqual([1, 2, 3])
  })
})

describe('lens: lazy / recursive types', () => {
  type Tree = { value: number; children: Tree[] }
  const l: b.Lazy<Tree, Tree> = b.lazy(() => b.struct({ value: b.uint32(), children: b.list(l) }))

  const sample: Tree = {
    value: 1,
    children: [
      { value: 2, children: [{ value: 4, children: [] }] },
      { value: 3, children: [] },
    ],
  }

  it('codec round-trips a recursive tree', () => {
    expect(b.decode(l, b.encode(l, sample))[0]).toEqual(sample)
  })

  it('lens resolves through lazy and exposes struct fields', () => {
    const buf = b.encode(l, sample)
    const L = b.lens(l)

    expect(L.value.$read(buf)).toBe(1)
    expect(L.value.$size).toBe(4)
  })

  it('lens.children.bind(buf) iterates child subtrees', () => {
    const buf = b.encode(l, sample)
    const L = b.lens(l)
    const children = L.children.bind(buf)
    expect(children.length).toBe(2)
    expect(children.at(0)).toEqual(sample.children[0])
    expect(children.at(1)).toEqual(sample.children[1])
    expect(children.toArray()).toEqual(sample.children)
    expect([...children]).toEqual(sample.children)
  })

  it('writes to a sized field at the root work in place', () => {
    const buf = b.encode(l, sample)
    const L = b.lens(l)
    L.value.$write(buf, 99)
    expect(b.decode(l, buf)[0].value).toBe(99)
    // children unaffected
    expect(b.decode(l, buf)[0].children).toEqual(sample.children)
  })

  it('handles deeper recursion (3+ levels) without infinite build', () => {
    const deep: Tree = {
      value: 0,
      children: [{ value: 1, children: [{ value: 2, children: [{ value: 3, children: [] }] }] }],
    }
    const buf = b.encode(l, deep)
    const L = b.lens(l)
    expect(L.value.$read(buf)).toBe(0)
    const c0 = L.children.bind(buf).at(0)
    expect(c0).toEqual(deep.children[0])
  })
})
