import { Backend, Kernel, Endian, DEFAULT_DECODER_OPTIONS, DecoderOptions } from '../backend.js'

interface JitKernel extends Kernel {
  Num: string
  BigNum: string
  Str: string
  Bytes: string
  Bool: string
  Buffer: string
}

export type JitReadContext = {
  // Generate a unique variable name
  var: (prefix?: string) => string
  // Add a line of code
  write: (code: string) => void
  // Register an external value (like TextDecoder) and get its var name
  import: (name: string, value: any) => string
  // Access a property of an object
  access: (value: any, key: string | number) => string
  // The variable name of the DataView
  view: string
  // The variable name of the position cursor
  pos: string
  // The variable name of the buffer (Uint8Array)
  buf: string
}

export const createReader = (userOpts?: DecoderOptions): Backend<JitReadContext, 'read', JitKernel> => {
  const opts = { ...DEFAULT_DECODER_OPTIONS, ...userOpts }
  const check = opts.boundsCheck

  return {
    mode: 'read',
    bool: bool(check),
    i8: i8(check),
    u8: u8(check),
    i16: i16(check),
    u16: u16(check),
    f16: f16(check),
    i32: i32(check),
    u32: u32(check),
    f32: f32(check),
    i64: i64(check),
    u64: u64(check),
    f64: f64(check),
    str: str(check, opts.maxStringLength),

    struct: (shape) => (c) => {
      const result = c.var('obj')
      c.write(`const ${result} = {};`)
      for (const key in shape) {
        const val = shape[key]!(c)
        c.write(`${result}.${key} = ${val};`)
      }
      return result
    },

    list: (inner) => (c) => {
      const len = c.var('len')
      const arr = c.var('arr')
      const i = c.var('i')

      // Read length
      c.write(`const ${len} = ${c.view}.getUint32(${c.pos}, false);`)
      c.write(`${c.pos} += 4;`)

      // Security check (optional, but good for JIT to respect options)
      if (opts.maxListLength < Infinity) {
        c.write(`if (${len} > ${opts.maxListLength}) throw new Error("Max list length exceeded");`)
      }

      c.write(`const ${arr} = new Array(${len});`)
      c.write(`for (let ${i} = 0; ${i} < ${len}; ${i}++) {`)

      const item = inner(c)
      c.write(`${arr}[${i}] = ${item};`)

      c.write(`}`)
      return arr
    },

    wrap: (internal) => {
      const c = createCtx()
      const resultVar = internal(c)
      c.write(`return ${resultVar};`)

      // Compile
      const argNames = ['buf', 'view', 'pos', ...c.imports.keys()]
      const fnBody = c.body()

      // Create the JIT function
      // Signature: (buf, view, pos, ...imports) => Result
      const fn = new Function(...argNames, fnBody)
      const importValues = Array.from(c.imports.values())

      return (buf: Uint8Array) => {
        // We recreate the view here to pass into the JIT function
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
        return fn(buf, view, 0, ...importValues)
      }
    },
  }
}

// Helper to manage JIT state
const createCtx = (): JitReadContext & { imports: Map<string, any>; body: () => string } => {
  let vCount = 0
  const lines: string[] = []
  const imports = new Map<string, any>()

  return {
    var: (p = 'v') => `${p}_${vCount++}`,
    write: (l) => lines.push(l),
    import: (name, val) => {
      const id = `__${name}_${imports.size}`
      imports.set(id, val)
      return id
    },
    access: (v, k) => `${v}[${typeof k === 'string' ? `'${k}'` : k}]`,
    view: 'view',
    pos: 'pos',
    buf: 'buf',
    imports,
    body: () => lines.join('\n'),
  }
}

const bool = (check: boolean) => () => (c: JitReadContext) => {
  if (check) c.write(`if (${c.pos} + 1 > ${c.buf}.byteLength) throw new Error('EOF');`)
  const v = c.var('bool')
  c.write(`const ${v} = ${c.view}.getUint8(${c.pos}) !== 0;`)
  c.write(`${c.pos}++;`)
  return v
}

const i8 = (check: boolean) => () => (c: JitReadContext) => {
  if (check) c.write(`if (${c.pos} + 1 > ${c.buf}.byteLength) throw new Error('EOF');`)
  const v = c.var('i8')
  c.write(`const ${v} = ${c.view}.getInt8(${c.pos});`)
  c.write(`${c.pos}++;`)
  return v
}

const u8 = (check: boolean) => () => (c: JitReadContext) => {
  if (check) c.write(`if (${c.pos} + 1 > ${c.buf}.byteLength) throw new Error('EOF');`)
  const v = c.var('u8')
  c.write(`const ${v} = ${c.view}.getUint8(${c.pos});`)
  c.write(`${c.pos}++;`)
  return v
}

const i16 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitReadContext) => {
    if (check) c.write(`if (${c.pos} + 2 > ${c.buf}.byteLength) throw new Error('EOF');`)
    const v = c.var('i16')
    c.write(`const ${v} = ${c.view}.getInt16(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 2;`)
    return v
  }

const u16 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitReadContext) => {
    if (check) c.write(`if (${c.pos} + 2 > ${c.buf}.byteLength) throw new Error('EOF');`)
    const v = c.var('u16')
    c.write(`const ${v} = ${c.view}.getUint16(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 2;`)
    return v
  }

const f16 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitReadContext) => {
    if (check) c.write(`if (${c.pos} + 2 > ${c.buf}.byteLength) throw new Error('EOF');`)
    const v = c.var('f16')
    c.write(`const ${v} = ${c.view}.getFloat16(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 2;`)
    return v
  }

const i32 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitReadContext) => {
    if (check) c.write(`if (${c.pos} + 4 > ${c.buf}.byteLength) throw new Error('EOF');`)
    const v = c.var('i32')
    c.write(`const ${v} = ${c.view}.getInt32(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 4;`)
    return v
  }

const u32 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitReadContext) => {
    if (check) c.write(`if (${c.pos} + 4 > ${c.buf}.byteLength) throw new Error('EOF');`)
    const v = c.var('u32')
    c.write(`const ${v} = ${c.view}.getUint32(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 4;`)
    return v
  }

const f32 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitReadContext) => {
    if (check) c.write(`if (${c.pos} + 4 > ${c.buf}.byteLength) throw new Error('EOF');`)
    const v = c.var('f32')
    c.write(`const ${v} = ${c.view}.getFloat32(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 4;`)
    return v
  }

const i64 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitReadContext) => {
    if (check) c.write(`if (${c.pos} + 8 > ${c.buf}.byteLength) throw new Error('EOF');`)
    const v = c.var('i64')
    c.write(`const ${v} = ${c.view}.getBigInt64(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 8;`)
    return v
  }

const u64 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitReadContext) => {
    if (check) c.write(`if (${c.pos} + 8 > ${c.buf}.byteLength) throw new Error('EOF');`)
    const v = c.var('u64')
    c.write(`const ${v} = ${c.view}.getBigUint64(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 8;`)
    return v
  }

const f64 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitReadContext) => {
    if (check) c.write(`if (${c.pos} + 8 > ${c.buf}.byteLength) throw new Error('EOF');`)
    const v = c.var('f64')
    c.write(`const ${v} = ${c.view}.getFloat64(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 8;`)
    return v
  }

const decoder = new TextDecoder()
const str = (check: boolean, maxLen: number) => () => (c: JitReadContext) => {
  const len = c.var('strLen')
  const v = c.var('strVal')
  const dec = c.import('decoder', decoder)

  // Read length
  if (check) c.write(`if (${c.pos} + 4 > ${c.buf}.byteLength) throw new Error('EOF');`)
  c.write(`const ${len} = ${c.view}.getUint32(${c.pos}, false);`)
  c.write(`${c.pos} += 4;`)

  // Security check
  if (maxLen < Infinity) {
    c.write(`if (${len} > ${maxLen}) throw new Error("String length exceeds max");`)
  }

  // Bounds check for string payload
  if (check) {
    c.write(`if (${c.pos} + ${len} > ${c.buf}.byteLength) throw new Error('EOF');`)
  }

  // Decode
  c.write(`const ${v} = ${dec}.decode(${c.buf}.subarray(${c.pos}, ${c.pos} + ${len}));`)
  c.write(`${c.pos} += ${len};`)

  return v
}
