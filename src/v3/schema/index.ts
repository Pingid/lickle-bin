type BaseType<I, T extends string = string> = { $infer: I; tag: T }
type Sized<I, S extends number = number, T extends string = string> = BaseType<I, T> & { size: S }

export const isSized = <T extends Schema<any>>(type: T): type is T & { size: number } => 'size' in type

const type =
  <T extends string>(tag: T) =>
  <I>() =>
    ({ tag, $infer: null as I }) as BaseType<I, T>

const sized = <T extends string, S extends number, I = number>(tag: T, size: S) =>
  ({ tag, $infer: null as unknown as number, size }) as Sized<I, S, T>

// ==========================================
// Primitive Types
// ==========================================
export type Bool = Sized<boolean, 1, 'bool'>
export const bool = (): Bool => sized('bool', 1)

// ==========================================
// 8-Bit
// ==========================================

export type I8 = Sized<number, 1, 'i8'>
export const i8 = (): I8 => sized('i8', 1)

export type U8 = Sized<number, 1, 'u8'>
export const u8 = (): U8 => sized('u8', 1)

// ==========================================
// 16-Bit
// ==========================================

export type I16 = Sized<number, 2, 'i16'>
export const i16 = (): I16 => sized('i16', 2)

export type U16 = Sized<number, 2, 'u16'>
export const u16 = (): U16 => sized('u16', 2)

export type F16 = Sized<number, 2, 'f16'>
export const f16 = (): F16 => sized('f16', 2)

// ==========================================
// 32-Bit
// ==========================================

export type I32 = Sized<number, 4, 'i32'>
export const i32 = (): I32 => sized('i32', 4)

export type U32 = Sized<number, 4, 'u32'>
export const u32 = (): U32 => sized('u32', 4)

export type F32 = Sized<number, 4, 'f32'>
export const f32 = (): F32 => sized('f32', 4)

// ==========================================
// 64-Bit
// ==========================================

export type I64 = Sized<bigint, 8, 'i64'>
export const i64 = (): I64 => sized('i64', 8)

export type U64 = Sized<bigint, 8, 'u64'>
export const u64 = (): U64 => sized('u64', 8)

export type F64 = Sized<number, 8, 'f64'>
export const f64 = (): F64 => sized('f64', 8)

// ==========================================
// String
// ==========================================

export type Str = BaseType<string, 'str'>
export const str = (): Str => type('str')<string>()

// ==========================================
// Composite Types
// ==========================================

export type Struct<T> = {
  $infer: { [K in keyof T]: T[K] extends BaseType<infer I> ? I : never }
  shape: T
  tag: 'struct'
}

export type SizedStruct<T> = {
  $infer: { [K in keyof T]: T[K] extends Sized<infer I> ? I : never }
  shape: T
  tag: 'struct'
  size: number
}

export const struct: {
  <T extends Record<string, Sized<any, number, any>>>(shape: T): SizedStruct<T>
  <T extends Record<string, BaseType<any, any> | Sized<string, number, any>>>(shape: T): Struct<T>
} = <T extends Record<string, BaseType<any, any>>>(shape: T) => {
  const struct = {
    $infer: null as unknown as { [K in keyof T]: T[K]['$infer'] },
    shape: shape,
    tag: 'struct',
  }
  let size = 0
  for (const key in shape) {
    if (isSized(shape[key]!)) {
      size += shape[key].size
    } else {
      return struct as any
    }
  }
  return {
    ...struct,
    size,
  } as SizedStruct<T>
}

export type List<T> = {
  $infer: T extends Schema<any> ? T['$infer'][] : never
  item: T
  tag: 'list'
}

export const list = <T extends Schema<any>>(item: T) =>
  ({
    $infer: null as unknown as T['$infer'][],
    item: item,
    tag: 'list',
  }) as List<T>

export type Schema<T> = Bool | I8 | U8 | I16 | U16 | I32 | U32 | I64 | U64 | F16 | F32 | F64 | Str | Struct<T> | List<T>
