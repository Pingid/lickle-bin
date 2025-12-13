import { Backend, Kernel, Endian, DEFAULT_DECODER_OPTIONS, DecoderOptions } from '../backend.js'

interface JitKernel extends Kernel {
  Num: string
  BigNum: string
  Str: string
  Bytes: string
  Bool: string
  Buffer: string
}

export type JitContext = {
  // Generate a unique variable name
  var: (prefix?: string) => string
  // Add a line of code
  write: (code: string) => void
  // Register an external value (like TextDecoder) and get its var name
  import: (name: string, value: any) => string
  // The variable name of the DataView
  view: string
  // The variable name of the position cursor
  pos: string
  // The variable name of the buffer (Uint8Array)
  buf: string
}

export const createReader = (userOpts?: DecoderOptions): Backend<JitContext, 'read', JitKernel> => {
  const opts = { ...DEFAULT_DECODER_OPTIONS, ...userOpts }

  return {
    mode: 'read',
    bool,
    i8,
    u8,
    i16,
    u16,
    f16,
    i32,
    u32,
    f32,
    i64,
    u64,
    f64,
    str: str(opts.maxStringLength),

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
const createCtx = (): JitContext & { imports: Map<string, any>; body: () => string } => {
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
    view: 'view',
    pos: 'pos',
    buf: 'buf',
    imports,
    body: () => lines.join('\n'),
  }
}

const bool = () => (c: JitContext) => {
  const v = c.var('bool')
  c.write(`const ${v} = ${c.view}.getUint8(${c.pos}) !== 0;`)
  c.write(`${c.pos}++;`)
  return v
}

const i8 = () => (c: JitContext) => {
  const v = c.var('i8')
  c.write(`const ${v} = ${c.view}.getInt8(${c.pos});`)
  c.write(`${c.pos}++;`)
  return v
}

const u8 = () => (c: JitContext) => {
  const v = c.var('u8')
  c.write(`const ${v} = ${c.view}.getUint8(${c.pos});`)
  c.write(`${c.pos}++;`)
  return v
}

const i16 =
  (endian: Endian = 'be') =>
  (c: JitContext) => {
    const v = c.var('i16')
    c.write(`const ${v} = ${c.view}.getInt16(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 2;`)
    return v
  }

const u16 =
  (endian: Endian = 'be') =>
  (c: JitContext) => {
    const v = c.var('u16')
    c.write(`const ${v} = ${c.view}.getUint16(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 2;`)
    return v
  }

const f16 =
  (endian: Endian = 'be') =>
  (c: JitContext) => {
    const v = c.var('f16')
    c.write(`const ${v} = ${c.view}.getFloat16(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 2;`)
    return v
  }

const i32 =
  (endian: Endian = 'be') =>
  (c: JitContext) => {
    const v = c.var('i32')
    c.write(`const ${v} = ${c.view}.getInt32(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 4;`)
    return v
  }

const u32 =
  (endian: Endian = 'be') =>
  (c: JitContext) => {
    const v = c.var('u32')
    c.write(`const ${v} = ${c.view}.getUint32(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 4;`)
    return v
  }

const f32 =
  (endian: Endian = 'be') =>
  (c: JitContext) => {
    const v = c.var('f32')
    c.write(`const ${v} = ${c.view}.getFloat32(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 4;`)
    return v
  }

const i64 =
  (endian: Endian = 'be') =>
  (c: JitContext) => {
    const v = c.var('i64')
    c.write(`const ${v} = ${c.view}.getBigInt64(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 8;`)
    return v
  }

const u64 =
  (endian: Endian = 'be') =>
  (c: JitContext) => {
    const v = c.var('u64')
    c.write(`const ${v} = ${c.view}.getBigUint64(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 8;`)
    return v
  }

const f64 =
  (endian: Endian = 'be') =>
  (c: JitContext) => {
    const v = c.var('f64')
    c.write(`const ${v} = ${c.view}.getFloat64(${c.pos}, ${endian === 'le'});`)
    c.write(`${c.pos} += 8;`)
    return v
  }

const decoder = new TextDecoder()
const str = (maxLen: number) => () => (c: JitContext) => {
  const len = c.var('strLen')
  const v = c.var('strVal')
  const dec = c.import('decoder', decoder)

  // Read length
  c.write(`const ${len} = ${c.view}.getUint32(${c.pos}, false);`)
  c.write(`${c.pos} += 4;`)

  // Decode
  c.write(`const ${v} = ${dec}.decode(${c.buf}.subarray(${c.pos}, ${c.pos} + ${len}));`)
  c.write(`${c.pos} += ${len};`)

  return v
}
