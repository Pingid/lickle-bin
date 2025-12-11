import { Codec, FixedSize, DynamicSize, Optional, Literal, Schema, BinCode, Infer } from '../core.js'
import { JitCodec, JitContext, Jittable } from './core.js'
import * as cd from '../codecs.js'

type Endian = 'le' | 'be'

// Helper for 8-bit types (no endianness needed)
const withJit = <T extends Codec<any, any>>(
  codec: T,
  set: string,
  get: string,
  bytes: number,
): T & JitCodec<Infer<T>['decode'], Infer<T>['encode']> => {
  const c = codec as T & JitCodec<Infer<T>['decode'], Infer<T>['encode']>
  c.je = (ctx, val) => {
    ctx.write(`${ctx.view}.${set}(${ctx.pos}, ${val});`)
    ctx.write(`${ctx.pos} += ${bytes};`)
  }
  c.jd = (ctx) => {
    const v = ctx.var('num')
    ctx.write(`const ${v} = ${ctx.view}.${get}(${ctx.pos});`)
    ctx.write(`${ctx.pos} += ${bytes};`)
    return v
  }
  return c
}

// Helper for endian-aware types
const withJitEndian = <T extends Codec<any, any>>(
  codec: T,
  set: string,
  get: string,
  bytes: number,
  le: boolean,
): T & JitCodec<Infer<T>['decode'], Infer<T>['encode']> => {
  const c = codec as T & JitCodec<Infer<T>['decode'], Infer<T>['encode']>
  c.je = (ctx, val) => {
    ctx.write(`${ctx.view}.${set}(${ctx.pos}, ${val}, ${le});`)
    ctx.write(`${ctx.pos} += ${bytes};`)
  }
  c.jd = (ctx) => {
    const v = ctx.var('num')
    ctx.write(`const ${v} = ${ctx.view}.${get}(${ctx.pos}, ${le});`)
    ctx.write(`${ctx.pos} += ${bytes};`)
    return v
  }
  return c
}

// ==========================================
// 8-bit integers
// ==========================================

/** Creates a codec for an 8-bit unsigned integer. */
export const uint8 = (): FixedSize<1, number> & JitCodec<number> => withJit(cd.uint8(), 'setUint8', 'getUint8', 1)

/** Codec for a fixed-size 8-bit unsigned integer. */
export const Uint8: FixedSize<1, number> & JitCodec<number> = uint8()

/** Creates a codec for an 8-bit signed integer. */
export const int8 = (): FixedSize<1, number> & JitCodec<number> => withJit(cd.int8(), 'setInt8', 'getInt8', 1)

/** Codec for a fixed-size 8-bit signed integer. */
export const Int8: FixedSize<1, number> & JitCodec<number> = int8()

// ==========================================
// 16-bit integers
// ==========================================

/** Creates a codec for a 16-bit unsigned integer. */
export const uint16 = (endian: Endian = 'be'): FixedSize<2, number> & JitCodec<number> =>
  withJitEndian(cd.uint16(endian), 'setUint16', 'getUint16', 2, endian === 'le')

/** Codec for a fixed-size 16-bit unsigned integer. */
export const Uint16: FixedSize<2, number> & JitCodec<number> = uint16('be')

/** Creates a codec for a 16-bit signed integer. */
export const int16 = (endian: Endian = 'be'): FixedSize<2, number> & JitCodec<number> =>
  withJitEndian(cd.int16(endian), 'setInt16', 'getInt16', 2, endian === 'le')

/** Codec for a fixed-size 16-bit signed integer. */
export const Int16: FixedSize<2, number> & JitCodec<number> = int16('be')

// ==========================================
// 32-bit integers
// ==========================================

/** Creates a codec for a 32-bit unsigned integer. */
export const uint32 = (endian: Endian = 'be'): FixedSize<4, number> & JitCodec<number> =>
  withJitEndian(cd.uint32(endian), 'setUint32', 'getUint32', 4, endian === 'le')

/** Codec for a fixed-size 32-bit unsigned integer. */
export const Uint32: FixedSize<4, number> & JitCodec<number> = uint32('be')

/** Creates a codec for a 32-bit signed integer. */
export const int32 = (endian: Endian = 'be'): FixedSize<4, number> & JitCodec<number> =>
  withJitEndian(cd.int32(endian), 'setInt32', 'getInt32', 4, endian === 'le')

/** Codec for a fixed-size 32-bit signed integer. */
export const Int32: FixedSize<4, number> & JitCodec<number> = int32('be')

// ==========================================
// Floats
// ==========================================

/** Creates a codec for a 32-bit float. */
export const float32 = (endian: Endian = 'be'): FixedSize<4, number> & JitCodec<number> =>
  withJitEndian(cd.float32(endian), 'setFloat32', 'getFloat32', 4, endian === 'le')

/** Codec for a fixed-size 32-bit float. */
export const Float32: FixedSize<4, number> & JitCodec<number> = float32('be')

/** Creates a codec for a 64-bit float. */
export const float64 = (endian: Endian = 'be'): FixedSize<8, number> & JitCodec<number> =>
  withJitEndian(cd.float64(endian), 'setFloat64', 'getFloat64', 8, endian === 'le')

/** Codec for a fixed-size 64-bit float. */
export const Float64: FixedSize<8, number> & JitCodec<number> = float64('be')

// ==========================================
// 64-bit BigInts
// ==========================================

/** Creates a codec for a 64-bit unsigned BigInt. */
export const bigUint64 = (endian: Endian = 'be'): FixedSize<8, bigint> & JitCodec<bigint> =>
  withJitEndian(cd.bigUint64(endian), 'setBigUint64', 'getBigUint64', 8, endian === 'le')

/** Codec for a fixed-size 64-bit unsigned BigInt. */
export const BigUint64: FixedSize<8, bigint> & JitCodec<bigint> = bigUint64('be')

/** Creates a codec for a 64-bit signed BigInt. */
export const bigInt64 = (endian: Endian = 'be'): FixedSize<8, bigint> & JitCodec<bigint> =>
  withJitEndian(cd.bigInt64(endian), 'setBigInt64', 'getBigInt64', 8, endian === 'le')

/** Codec for a fixed-size 64-bit signed BigInt. */
export const BigInt64: FixedSize<8, bigint> & JitCodec<bigint> = bigInt64('be')

// ==========================================
// Variable-length integers
// ==========================================

const vuintJit: Jittable = {
  je: (ctx, val) => {
    ctx.write(`while (${val} >= 0x80) {`)
    ctx.write(`  ${ctx.view}.setUint8(${ctx.pos}, (${val} & 0x7f) | 0x80);`)
    ctx.write(`  ${ctx.pos}++;`)
    ctx.write(`  ${val} >>>= 7;`)
    ctx.write(`}`)
    ctx.write(`${ctx.view}.setUint8(${ctx.pos}, ${val});`)
    ctx.write(`${ctx.pos}++;`)
  },
  jd: (ctx) => {
    const val = ctx.var('val')
    const shift = ctx.var('shift')
    const b = ctx.var('b')
    ctx.write(`let ${val} = 0, ${shift} = 0;`)
    ctx.write(`while (true) {`)
    ctx.write(`  const ${b} = ${ctx.view}.getUint8(${ctx.pos});`)
    ctx.write(`  ${ctx.pos}++;`)
    ctx.write(`  ${val} |= (${b} & 0x7f) << ${shift};`)
    ctx.write(`  if ((${b} & 0x80) === 0) break;`)
    ctx.write(`  ${shift} += 7;`)
    ctx.write(`}`)
    return `(${val} >>> 0)`
  },
}

/** Creates a codec for a variable-length unsigned integer (32-bit). */
export const vuint = (): DynamicSize<number> & JitCodec<number> =>
  Object.assign({}, cd.vuint(), vuintJit) as DynamicSize<number> & JitCodec<number>

/** Codec for a variable-length unsigned integer (32-bit). */
export const Vuint: DynamicSize<number> & JitCodec<number> = vuint()

const vintJit: Jittable = {
  je: (ctx, val) => {
    const zigzag = ctx.var('zz')
    ctx.write(`let ${zigzag} = (${val} << 1) ^ (${val} >> 31);`)
    vuintJit.je(ctx, zigzag)
  },
  jd: (ctx) => {
    const n = vuintJit.jd(ctx)
    const result = ctx.var('vint')
    ctx.write(`const ${result} = (${n} >>> 1) ^ -(${n} & 1);`)
    return result
  },
}

/** Creates a codec for a variable-length signed integer (32-bit). */
export const vint = (): DynamicSize<number> & JitCodec<number> =>
  Object.assign({}, cd.vint(), vintJit) as DynamicSize<number> & JitCodec<number>

/** Codec for a variable-length signed integer (32-bit). */
export const Vint: DynamicSize<number> & JitCodec<number> = vint()

// ==========================================
// Boolean
// ==========================================

const boolJit: Jittable = {
  je: (ctx, val) => {
    ctx.write(`${ctx.view}.setUint8(${ctx.pos}, ${val} ? 1 : 0);`)
    ctx.write(`${ctx.pos}++;`)
  },
  jd: (ctx) => {
    const v = ctx.var('bool')
    ctx.write(`const ${v} = ${ctx.view}.getUint8(${ctx.pos}) === 1;`)
    ctx.write(`${ctx.pos}++;`)
    return v
  },
}

/** Codec for a boolean value. */
export const Bool: FixedSize<1, boolean> & JitCodec<boolean> = Object.assign({}, cd.Bool, boolJit) as FixedSize<
  1,
  boolean
> &
  JitCodec<boolean>

/** Creates a codec for a boolean value. */
export const bool = (): FixedSize<1, boolean> & JitCodec<boolean> => Bool

// ==========================================
// Strings
// ==========================================

const ENC = new TextEncoder()
const DEC = new TextDecoder('utf-8', { fatal: true })

/** Codec for a dynamic-sized UTF-8 encoded string with max length of 2^32-1. */
export const Utf8: DynamicSize<string> & JitCodec<string> = (() => {
  const codec = { ...cd.Utf8 } as DynamicSize<string> & JitCodec<string>
  codec.je = (ctx, val) => {
    const enc = ctx.import('ENC', ENC)
    const lenPos = ctx.var('lenPos')
    const written = ctx.var('written')
    ctx.write(`const ${lenPos} = ${ctx.pos};`)
    ctx.write(`${ctx.pos} += 4;`)
    ctx.write(`const { written: ${written} } = ${enc}.encodeInto(${val}, ${ctx.buf}.subarray(${ctx.pos}));`)
    ctx.write(`${ctx.view}.setUint32(${lenPos}, ${written}, false);`)
    ctx.write(`${ctx.pos} += ${written};`)
  }
  codec.jd = (ctx) => {
    const dec = ctx.import('DEC', DEC)
    const len = ctx.var('len')
    const str = ctx.var('str')
    ctx.write(`const ${len} = ${ctx.view}.getUint32(${ctx.pos}, false);`)
    ctx.write(`${ctx.pos} += 4;`)
    ctx.write(`const ${str} = ${dec}.decode(${ctx.buf}.subarray(${ctx.pos}, ${ctx.pos} + ${len}));`)
    ctx.write(`${ctx.pos} += ${len};`)
    return str
  }
  return codec
})()

/** Creates a codec for a dynamic or fixed-size UTF-8 encoded string. */
export const utf8: {
  (): DynamicSize<string> & JitCodec<string>
  <const N extends number>(p: { fixed: N }): FixedSize<N, string> & JitCodec<string>
} = (p?: { fixed?: number }): any => {
  if (typeof p?.fixed === 'number') {
    const size = p.fixed
    const codec = cd.utf8({ fixed: size }) as unknown as FixedSize<number, string> & JitCodec<string>
    codec.je = (ctx, val) => {
      const enc = ctx.import('ENC', ENC)
      const written = ctx.var('written')
      ctx.write(
        `const { written: ${written} } = ${enc}.encodeInto(${val}, ${ctx.buf}.subarray(${ctx.pos}, ${ctx.pos} + ${size}));`,
      )
      ctx.write(`if (${written} < ${size}) ${ctx.buf}.fill(0, ${ctx.pos} + ${written}, ${ctx.pos} + ${size});`)
      ctx.write(`${ctx.pos} += ${size};`)
    }
    codec.jd = (ctx) => {
      const dec = ctx.import('DEC', DEC)
      const str = ctx.var('str')
      ctx.write(
        `const ${str} = ${dec}.decode(${ctx.buf}.subarray(${ctx.pos}, ${ctx.pos} + ${size})).replace(/\\0+$/, '');`,
      )
      ctx.write(`${ctx.pos} += ${size};`)
      return str
    }
    return codec
  }
  return Utf8
}

/** Creates a codec for a dynamic-sized JSON encoded value. */
export const json = <T>(): DynamicSize<T, T> & JitCodec<T, T> => {
  const codec = cd.json<T>() as DynamicSize<T, T> & JitCodec<T, T>
  codec.je = (ctx, val) => {
    const enc = ctx.import('ENC', ENC)
    const jsonStr = ctx.var('json')
    const lenPos = ctx.var('lenPos')
    const written = ctx.var('written')
    ctx.write(`const ${jsonStr} = JSON.stringify(${val});`)
    ctx.write(`const ${lenPos} = ${ctx.pos};`)
    ctx.write(`${ctx.pos} += 4;`)
    ctx.write(`const { written: ${written} } = ${enc}.encodeInto(${jsonStr}, ${ctx.buf}.subarray(${ctx.pos}));`)
    ctx.write(`${ctx.view}.setUint32(${lenPos}, ${written}, false);`)
    ctx.write(`${ctx.pos} += ${written};`)
  }
  codec.jd = (ctx) => {
    const dec = ctx.import('DEC', DEC)
    const len = ctx.var('len')
    const str = ctx.var('str')
    const result = ctx.var('json')
    ctx.write(`const ${len} = ${ctx.view}.getUint32(${ctx.pos}, false);`)
    ctx.write(`${ctx.pos} += 4;`)
    ctx.write(`const ${str} = ${dec}.decode(${ctx.buf}.subarray(${ctx.pos}, ${ctx.pos} + ${len}));`)
    ctx.write(`${ctx.pos} += ${len};`)
    ctx.write(`const ${result} = JSON.parse(${str});`)
    return result
  }
  return codec
}

// ==========================================
// Bytes
// ==========================================

/** Codec for a dynamic-sized byte array. */
export const Bytes: DynamicSize<Uint8Array> & JitCodec<Uint8Array> = (() => {
  const codec = { ...cd.Bytes } as DynamicSize<Uint8Array> & JitCodec<Uint8Array>
  codec.je = (ctx, val) => {
    ctx.write(`${ctx.view}.setUint32(${ctx.pos}, ${val}.length, false);`)
    ctx.write(`${ctx.pos} += 4;`)
    ctx.write(`${ctx.buf}.set(${val}, ${ctx.pos});`)
    ctx.write(`${ctx.pos} += ${val}.length;`)
  }
  codec.jd = (ctx) => {
    const len = ctx.var('len')
    const bytes = ctx.var('bytes')
    ctx.write(`const ${len} = ${ctx.view}.getUint32(${ctx.pos}, false);`)
    ctx.write(`${ctx.pos} += 4;`)
    ctx.write(`const ${bytes} = ${ctx.buf}.slice(${ctx.pos}, ${ctx.pos} + ${len});`)
    ctx.write(`${ctx.pos} += ${len};`)
    return bytes
  }
  return codec
})()

/** Creates a codec for a fixed-size byte array. */
export const bytes = <const N extends number>(p: { fixed: N }): FixedSize<N, Uint8Array> & JitCodec<Uint8Array> => {
  const size = p.fixed
  const codec = cd.bytes(p) as FixedSize<N, Uint8Array> & JitCodec<Uint8Array>
  codec.je = (ctx, val) => {
    ctx.write(`${ctx.buf}.set(${val}.subarray(0, ${size}), ${ctx.pos});`)
    ctx.write(`${ctx.pos} += ${size};`)
  }
  codec.jd = (ctx) => {
    const bytes = ctx.var('bytes')
    ctx.write(`const ${bytes} = ${ctx.buf}.slice(${ctx.pos}, ${ctx.pos} + ${size});`)
    ctx.write(`${ctx.pos} += ${size};`)
    return bytes
  }
  return codec
}

// ==========================================
// Literal
// ==========================================

/** Creates a zero-sized codec for a literal value. */
export const literal = <const O>(value: O): Literal<O> & JitCodec<O> => {
  const codec = cd.literal(value) as Literal<O> & JitCodec<O>
  codec.je = () => {} // No-op, literal values aren't encoded
  codec.jd = (ctx) => {
    // For primitives, inline the JS literal directly
    if (typeof value === 'string') return JSON.stringify(value)
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (value === null) return 'null'
    // For complex values, use a unique import name
    const name = ctx.var('lit')
    return ctx.import(name, value)
  }
  return codec
}

// ==========================================
// Optional & Nullable
// ==========================================

/** Wraps a codec to make its value optional. */
export const optional = <D, E = D>(
  inner: BinCode<D, E> & Jittable,
): Optional<D, E> & JitCodec<D | undefined, E | undefined> => {
  const codec = cd.optional(inner) as Optional<D, E> & JitCodec<D | undefined, E | undefined>
  codec.je = (ctx, val) => {
    ctx.write(`if (${val} === undefined) {`)
    ctx.write(`  ${ctx.view}.setUint8(${ctx.pos}, 0);`)
    ctx.write(`  ${ctx.pos}++;`)
    ctx.write(`} else {`)
    ctx.write(`  ${ctx.view}.setUint8(${ctx.pos}, 1);`)
    ctx.write(`  ${ctx.pos}++;`)
    inner.je(ctx, val)
    ctx.write(`}`)
  }
  codec.jd = (ctx) => {
    const exists = ctx.var('exists')
    const result = ctx.var('opt')
    ctx.write(`const ${exists} = ${ctx.view}.getUint8(${ctx.pos}) === 1;`)
    ctx.write(`${ctx.pos}++;`)
    ctx.write(`let ${result};`)
    ctx.write(`if (${exists}) {`)
    const innerVal = inner.jd(ctx)
    ctx.write(`  ${result} = ${innerVal};`)
    ctx.write(`} else {`)
    ctx.write(`  ${result} = undefined;`)
    ctx.write(`}`)
    return result
  }
  return codec
}

/** Wraps a codec to make its value nullable. */
export const nullable = <D, E = D>(
  inner: BinCode<D, E> & Jittable,
): DynamicSize<D | null, E | null> & JitCodec<D | null, E | null> => {
  const codec = cd.nullable(inner) as DynamicSize<D | null, E | null> & JitCodec<D | null, E | null>
  codec.je = (ctx, val) => {
    ctx.write(`if (${val} === null) {`)
    ctx.write(`  ${ctx.view}.setUint8(${ctx.pos}, 0);`)
    ctx.write(`  ${ctx.pos}++;`)
    ctx.write(`} else {`)
    ctx.write(`  ${ctx.view}.setUint8(${ctx.pos}, 1);`)
    ctx.write(`  ${ctx.pos}++;`)
    inner.je(ctx, val)
    ctx.write(`}`)
  }
  codec.jd = (ctx) => {
    const exists = ctx.var('exists')
    const result = ctx.var('nullable')
    ctx.write(`const ${exists} = ${ctx.view}.getUint8(${ctx.pos}) === 1;`)
    ctx.write(`${ctx.pos}++;`)
    ctx.write(`let ${result};`)
    ctx.write(`if (${exists}) {`)
    const innerVal = inner.jd(ctx)
    ctx.write(`  ${result} = ${innerVal};`)
    ctx.write(`} else {`)
    ctx.write(`  ${result} = null;`)
    ctx.write(`}`)
    return result
  }
  return codec
}

// ==========================================
// Array
// ==========================================

/** Creates a codec for an array of items. */
export const array = <D, E = D>(inner: BinCode<D, E> & Jittable): DynamicSize<D[], E[]> & JitCodec<D[], E[]> => {
  const codec = cd.array(inner) as DynamicSize<D[], E[]> & JitCodec<D[], E[]>
  codec.je = (ctx, val) => {
    // Encode length as vuint
    vuintJit.je(ctx, `${val}.length`)
    // Encode each element
    const i = ctx.var('i')
    ctx.write(`for (let ${i} = 0; ${i} < ${val}.length; ${i}++) {`)
    inner.je(ctx, `${val}[${i}]`)
    ctx.write(`}`)
  }
  codec.jd = (ctx) => {
    const len = vuintJit.jd(ctx)
    const arr = ctx.var('arr')
    const i = ctx.var('i')
    ctx.write(`const ${arr} = new Array(${len});`)
    ctx.write(`for (let ${i} = 0; ${i} < ${len}; ${i}++) {`)
    const item = inner.jd(ctx)
    ctx.write(`  ${arr}[${i}] = ${item};`)
    ctx.write(`}`)
    return arr
  }
  return codec
}

// ==========================================
// Struct
// ==========================================

type StructDecode<O> = {
  -readonly [K in keyof O as O[K] extends Optional<any> ? K : never]?: Infer<O[K]>['decode']
} & { -readonly [K in keyof O as O[K] extends Optional<any> ? never : K]: Infer<O[K]>['decode'] }

type StructEncode<O> = {
  -readonly [K in keyof O as O[K] extends Optional<any> ? K : never]?: Infer<O[K]>['encode']
} & { -readonly [K in keyof O as O[K] extends Optional<any> ? never : K]: Infer<O[K]>['encode'] }

/** Creates a codec for an object from a shape of codecs. */
export const struct = <const T extends Record<string, BinCode<any> & Jittable>>(
  shape: T,
): Schema<T, StructDecode<T>, StructEncode<T>> & JitCodec<StructDecode<T>, StructEncode<T>> => {
  const codec = cd.struct(shape) as unknown as Schema<T, StructDecode<T>, StructEncode<T>> &
    JitCodec<StructDecode<T>, StructEncode<T>>
  codec.je = (ctx, val) => {
    for (const key in shape) {
      shape[key]!.je(ctx, `${val}.${key}`)
    }
  }
  codec.jd = (ctx) => {
    const obj = ctx.var('obj')
    ctx.write(`const ${obj} = {};`)
    for (const key in shape) {
      const fieldVal = shape[key]!.jd(ctx)
      ctx.write(`${obj}.${key} = ${fieldVal};`)
    }
    return obj
  }
  return codec
}

type Compute<T> = { [K in keyof T]: T[K] } & {}
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never

/** Creates a codec for a partial object, where all fields are optional. */
export const partial = <S extends Record<string, BinCode<any> & Jittable>, D, E = D>(
  inner: Schema<S, D, E> & Jittable,
): Schema<
  { [K in keyof S]: Optional<Infer<S[K]>['decode'], Infer<S[K]>['encode']> & Jittable },
  Partial<D>,
  Partial<E>
> &
  JitCodec<Partial<D>, Partial<E>> =>
  struct(Object.fromEntries(Object.entries(inner.schema).map(([key, value]) => [key, optional(value)])) as any) as any

/** Creates a codec for the intersection of multiple struct schemas. */
export const intersection = <T extends (Schema<Record<string, BinCode<any> & Jittable>, any, any> & Jittable)[]>(
  schemas: T,
): Schema<
  Compute<UnionToIntersection<T[number]['schema']>>,
  StructDecode<Compute<UnionToIntersection<T[number]['schema']>>>,
  StructEncode<Compute<UnionToIntersection<T[number]['schema']>>>
> &
  JitCodec<
    StructDecode<Compute<UnionToIntersection<T[number]['schema']>>>,
    StructEncode<Compute<UnionToIntersection<T[number]['schema']>>>
  > => struct(Object.fromEntries(schemas.map((s) => Object.entries(s.schema)).flat()) as any) as any

// ==========================================
// Tuple
// ==========================================

/** Creates a codec for a fixed-length array with elements of specific types. */
export const tuple = <const T extends (BinCode<any> & Jittable)[]>(
  ...shape: T
): Schema<T, { [K in keyof T]: Infer<T[K]>['decode'] }, { [K in keyof T]: Infer<T[K]>['encode'] }> &
  JitCodec<{ [K in keyof T]: Infer<T[K]>['decode'] }, { [K in keyof T]: Infer<T[K]>['encode'] }> => {
  const codec = cd.tuple(...shape) as Schema<
    T,
    { [K in keyof T]: Infer<T[K]>['decode'] },
    { [K in keyof T]: Infer<T[K]>['encode'] }
  > &
    JitCodec<{ [K in keyof T]: Infer<T[K]>['decode'] }, { [K in keyof T]: Infer<T[K]>['encode'] }>
  codec.je = (ctx, val) => {
    for (let i = 0; i < shape.length; i++) {
      shape[i]!.je(ctx, `${val}[${i}]`)
    }
  }
  codec.jd = (ctx) => {
    const arr = ctx.var('tuple')
    ctx.write(`const ${arr} = [];`)
    for (let i = 0; i < shape.length; i++) {
      const itemVal = shape[i]!.jd(ctx)
      ctx.write(`${arr}.push(${itemVal});`)
    }
    return arr
  }
  return codec
}

// ==========================================
// Tagged Union
// ==========================================

/** Creates a codec for a tagged union. */
export function taggedUnion<const T extends Record<string, BinCode<any> & Jittable>>(
  shape: T,
): Schema<
  T,
  { [K in keyof T]: [K, Infer<T[K]>['decode']] }[keyof T],
  { [K in keyof T]: [K, Infer<T[K]>['encode']] }[keyof T]
> &
  JitCodec<
    { [K in keyof T]: [K, Infer<T[K]>['decode']] }[keyof T],
    { [K in keyof T]: [K, Infer<T[K]>['encode']] }[keyof T]
  > {
  const keys = Object.keys(shape) as (keyof T)[]
  const codec = cd.taggedUnion(shape) as any
  codec.je = (ctx: JitContext, val: string) => {
    const keysName = ctx.var('keys')
    const keysVar = ctx.import(keysName, keys)
    const idx = ctx.var('idx')
    ctx.write(`const ${idx} = ${keysVar}.indexOf(${val}[0]);`)
    ctx.write(`${ctx.view}.setUint8(${ctx.pos}, ${idx});`)
    ctx.write(`${ctx.pos}++;`)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!
      ctx.write(`${i === 0 ? 'if' : 'else if'} (${val}[0] === ${JSON.stringify(key)}) {`)
      shape[key]!.je(ctx, `${val}[1]`)
      ctx.write(`}`)
    }
  }
  codec.jd = (ctx: JitContext) => {
    const keysName = ctx.var('keys')
    const keysVar = ctx.import(keysName, keys)
    const idx = ctx.var('idx')
    const result = ctx.var('tagged')
    ctx.write(`const ${idx} = ${ctx.view}.getUint8(${ctx.pos});`)
    ctx.write(`${ctx.pos}++;`)
    ctx.write(`let ${result};`)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!
      ctx.write(`${i === 0 ? 'if' : 'else if'} (${idx} === ${i}) {`)
      const innerVal = shape[key]!.jd(ctx)
      ctx.write(`  ${result} = [${keysVar}[${i}], ${innerVal}];`)
      ctx.write(`}`)
    }
    return result
  }
  return codec
}

/** Creates a codec for a discriminated union. */
export const discriminatedUnion = <
  T extends string,
  S extends (Schema<{ [K in T]: Literal<any> }, any, any> & Jittable)[],
>(
  tag: T,
  schemas: S,
): Schema<S, Infer<S[number]>['decode'], Infer<S[number]>['encode']> &
  JitCodec<Infer<S[number]>['decode'], Infer<S[number]>['encode']> => {
  const keys = schemas.map((s) => s.schema[tag].value)
  const codec = cd.discriminatedUnion(tag, schemas) as unknown as Schema<
    S,
    Infer<S[number]>['decode'],
    Infer<S[number]>['encode']
  > &
    JitCodec<Infer<S[number]>['decode'], Infer<S[number]>['encode']>
  codec.je = (ctx: JitContext, val: string) => {
    const keysName = ctx.var('keys')
    const keysVar = ctx.import(keysName, keys)
    const idx = ctx.var('idx')
    ctx.write(`const ${idx} = ${keysVar}.indexOf(${val}.${tag});`)
    ctx.write(`${ctx.view}.setUint8(${ctx.pos}, ${idx});`)
    ctx.write(`${ctx.pos}++;`)
    for (let i = 0; i < schemas.length; i++) {
      ctx.write(`${i === 0 ? 'if' : 'else if'} (${idx} === ${i}) {`)
      schemas[i]!.je!(ctx, val)
      ctx.write(`}`)
    }
  }
  codec.jd = (ctx: JitContext) => {
    const idx = ctx.var('idx')
    const result = ctx.var('union')
    ctx.write(`const ${idx} = ${ctx.view}.getUint8(${ctx.pos});`)
    ctx.write(`${ctx.pos}++;`)
    ctx.write(`let ${result};`)
    for (let i = 0; i < schemas.length; i++) {
      ctx.write(`${i === 0 ? 'if' : 'else if'} (${idx} === ${i}) {`)
      const innerVal = schemas[i]!.jd!(ctx)
      ctx.write(`  ${result} = ${innerVal};`)
      ctx.write(`}`)
    }
    return result
  }
  return codec
}

// ==========================================
// Transformers
// ==========================================

/** Maps a codec's input/output to different types. */
export const map = <D, E, B extends BinCode<any, any> & Jittable>(
  codec: B,
  encode: (value: E) => Infer<B>['encode'],
  decode: (value: Infer<B>['decode']) => D,
): B & JitCodec<D, E> => {
  const c = cd.map(codec, encode, decode) as unknown as B & JitCodec<D, E>
  c.je = (ctx, val) => {
    const encFn = ctx.import('mapEnc', encode)
    const mapped = ctx.var('mapped')
    ctx.write(`const ${mapped} = ${encFn}(${val});`)
    codec.je(ctx, mapped)
  }
  c.jd = (ctx) => {
    const decFn = ctx.import('mapDec', decode)
    const inner = codec.jd(ctx)
    const result = ctx.var('mapResult')
    ctx.write(`const ${result} = ${decFn}(${inner});`)
    return result
  }
  return c
}
