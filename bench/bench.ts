import { run, bench, group } from 'mitata'

import * as b from '../src/index.js'

// ---------------- fixtures ----------------

const fxd = b.struct({ a: b.uint32(), b: b.uint32(), c: b.float64(), d: b.bool() })
const dyn = b.struct({ id: b.uint32(), name: b.utf8(), tags: b.list(b.utf8()) })
const dynPos = b.struct({ name: b.utf8(), age: b.uint8(), score: b.uint32() })

type Tree = { v: number; ch: Tree[] }
const tree: b.Codec<Tree> = b.lazy(() => b.struct({ v: b.uint32(), ch: b.list(tree) }))

const u8 = b.utf8()
const intList = b.list(b.uint32())
const intArr = b.array(b.uint32(), 1000)
const recList = b.list(dyn)
const strList = b.list(b.utf8())

const ints = Array.from({ length: 1000 }, (_, i) => i) as number[] & { length: 1000 }
const records = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `n${i}`, tags: ['a', 'b'] }))
const txt = '🦄 héllo 世界 שלום'
const strs = ['hi', 'world', 'foo', 'bar', 'baz']
const mk = (d: number, w: number): Tree =>
  d === 0 ? { v: 0, ch: [] } : { v: d, ch: Array.from({ length: w }, () => mk(d - 1, w)) }

const fxdV = { a: 1, b: 2, c: 3.14, d: true }
const dynV = { id: 42, name: 'alice', tags: ['admin', 'user', 'dev'] }
const dynPosV = { name: 'alice', age: 30, score: 1000 }
const treeV = mk(5, 4)

const fxdB = b.encode(fxd, fxdV)
const dynB = b.encode(dyn, dynV)
const dynPosB = b.encode(dynPos, dynPosV)
const intListB = b.encode(intList, ints)
const intArrB = b.encode(intArr, ints)
const recListB = b.encode(recList, records)
const treeB = b.encode(tree, treeV)
const strListB = b.encode(strList, strs)
const txtB = b.encode(u8, txt)

// ---------------- benches ----------------

group('encode', () => {
  bench('utf8', () => b.encode(u8, txt))
  bench('struct', () => b.encode(fxd, fxdV))
  bench('struct+', () => b.encode(dyn, dynV))
  bench('list u32', () => b.encode(intList, ints))
  bench('array u32', () => b.encode(intArr, ints))
  bench('list struct', () => b.encode(recList, records))
  bench('tree', () => b.encode(tree, treeV))
})

group('decode', () => {
  bench('utf8', () => b.decode(u8, txtB))
  bench('struct', () => b.decode(fxd, fxdB))
  bench('struct+', () => b.decode(dyn, dynB))
  bench('list u32', () => b.decode(intList, intListB))
  bench('array u32', () => b.decode(intArr, intArrB))
  bench('list struct', () => b.decode(recList, recListB))
  bench('tree', () => b.decode(tree, treeB))
})

const Lfxd = b.lens(fxd)
const LdynPos = b.lens(dynPos)
const Larr = b.lens(intArr)
const Llist = b.lens(intList)
const Lstr = b.lens(strList)

group('lens read', () => {
  bench('field@static', () => Lfxd.a.$read(fxdB))
  bench('field@dyn', () => LdynPos.score.$read(dynPosB))
  bench('array.at', () => Larr.at(500).$read(intArrB))
  bench('list.bind+at', () => Llist.bind(intListB).at(500))
  bench('list.bind+at*', () => Lstr.bind(strListB).at(2))
})

group('lens write', () => {
  bench('field@static', () => Lfxd.a.$write(fxdB, 7))
  bench('field@dyn', () => LdynPos.score.$write(dynPosB, 7))
  bench('array.at', () => Larr.at(500).$write(intArrB, 7))
})

await run({ format: process.env['BENCH_JSON'] ? { json: { samples: false } } : 'mitata' })
