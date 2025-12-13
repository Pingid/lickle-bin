import { Backend, Kernel, Endian, DEFAULT_ENCODER_OPTIONS, EncoderOptions } from '../backend.js'

interface JitKernel extends Kernel {
  Num: string
  BigNum: string
  Str: string
  Bytes: string
  Bool: string
  Buffer: string
}

export type JitWriteContext = {
  // Generate a unique variable name (e.g., "v1", "i2")
  var: (prefix?: string) => string
  // Add a line of code to the function body
  write: (code: string) => void
  // Register an external value (like TextEncoder) and get its variable name
  import: (name: string, value: any) => string
  // Access a property of an object
  access: (value: any, key: string | number) => string
  // The variable name of the DataView
  view: string
  // The variable name of the position cursor
  pos: string
  // (Encode only) The variable name of the buffer (Uint8Array)
  buf: string
}

export const createWriter = (
  userOpts?: EncoderOptions,
  size?: number,
): Backend<JitWriteContext, 'write', JitKernel> => {
  const opts = { ...DEFAULT_ENCODER_OPTIONS, ...userOpts }
  const check = opts.boundsCheck

  return {
    mode: 'write',
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
    str: str(check),

    struct: (shape) => (c, v) => {
      for (const key in shape) {
        // v is the variable name of the struct instance
        const prop = c.access(v, key)
        shape[key]!(c, prop)
      }
    },

    list: (inner) => (c, v) => {
      const len = c.access(v, 'length')
      const i = c.var('i')

      // Write Length
      c.write(`${c.view}.setUint32(${c.pos}, ${len}, false);`)
      c.write(`${c.pos} += 4;`)

      // Loop
      c.write(`for (let ${i} = 0; ${i} < ${len}; ${i}++) {`)
      inner(c, `${v}[${i}]`)
      c.write(`}`)
    },

    wrap: (internal) => {
      const c = createCtx()
      const inputVar = 'input'

      // Generate the body
      internal(c, inputVar as any)

      // Add return statement
      c.write(`return ${c.pos};`)

      // Retrieve code and imports
      const code = c.body()
      const argNames = [inputVar, 'buf', 'view', 'pos', ...c.imports.keys()]
      const fn = new Function(...argNames, code) as (
        val: any,
        buf: Uint8Array,
        view: DataView,
        pos: number,
        ...imports: any[]
      ) => number
      const importValues = Array.from(c.imports.values())

      // Return the runtime Encoder function
      return (val: any) => {
        const bufLen = size ?? opts.initialBufferSize
        const buf = new Uint8Array(bufLen)
        const view = new DataView(buf.buffer)

        const finalPos = fn(val, buf, view, 0, ...importValues)

        return buf.subarray(0, finalPos)
      }
    },
  }
}

// Helper to manage JIT state (Identical to Reader, can be shared)
const createCtx = (): JitWriteContext & { imports: Map<string, any>; body: () => string } => {
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

const bool = (check: boolean) => () => (c: JitWriteContext, v: JitKernel['Bool']) => {
  if (check) c.write(`if (${c.pos} + 1 > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
  c.write(`${c.view}.setUint8(${c.pos}, ${v} ? 1 : 0);`)
  c.write(`${c.pos}++;`)
}

const i8 = (check: boolean) => () => (c: JitWriteContext, v: JitKernel['Num']) => {
  if (check) c.write(`if (${c.pos} + 1 > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
  c.write(`${c.view}.setInt8(${c.pos}, ${v});`)
  c.write(`${c.pos}++;`)
}

const u8 = (check: boolean) => () => (c: JitWriteContext, v: JitKernel['Num']) => {
  if (check) c.write(`if (${c.pos} + 1 > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
  c.write(`${c.view}.setUint8(${c.pos}, ${v});`)
  c.write(`${c.pos}++;`)
}

const i16 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitWriteContext, v: JitKernel['Num']) => {
    if (check) c.write(`if (${c.pos} + 2 > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
    c.write(`${c.view}.setInt16(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 2;`)
  }

const u16 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitWriteContext, v: JitKernel['Num']) => {
    if (check) c.write(`if (${c.pos} + 2 > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
    c.write(`${c.view}.setUint16(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 2;`)
  }

const f16 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitWriteContext, v: JitKernel['Num']) => {
    if (check) c.write(`if (${c.pos} + 2 > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
    c.write(`${c.view}.setFloat16(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 2;`)
  }

const i32 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitWriteContext, v: JitKernel['Num']) => {
    if (check) c.write(`if (${c.pos} + 4 > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
    c.write(`${c.view}.setInt32(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 4;`)
  }

const u32 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitWriteContext, v: JitKernel['Num']) => {
    if (check) c.write(`if (${c.pos} + 4 > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
    c.write(`${c.view}.setUint32(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 4;`)
  }

const f32 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitWriteContext, v: JitKernel['Num']) => {
    if (check) c.write(`if (${c.pos} + 4 > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
    c.write(`${c.view}.setFloat32(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 4;`)
  }

const i64 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitWriteContext, v: JitKernel['BigNum']) => {
    if (check) c.write(`if (${c.pos} + 8 > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
    c.write(`${c.view}.setBigInt64(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 8;`)
  }

const u64 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitWriteContext, v: JitKernel['BigNum']) => {
    if (check) c.write(`if (${c.pos} + 8 > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
    c.write(`${c.view}.setBigUint64(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 8;`)
  }

const f64 =
  (check: boolean) =>
  (endian: Endian = 'be') =>
  (c: JitWriteContext, v: JitKernel['Num']) => {
    if (check) c.write(`if (${c.pos} + 8 > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
    c.write(`${c.view}.setFloat64(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 8;`)
  }

const encoder = new TextEncoder()
const str = (check: boolean) => () => (c: JitWriteContext, v: string) => {
  const enc = c.import('encoder', encoder)
  const encoded = c.var('encoded')
  const len = c.var('len')

  // For safety, we encode to a temporary array first to know the exact size
  c.write(`const ${encoded} = ${enc}.encode(${v});`)
  c.write(`const ${len} = ${encoded}.length;`)

  // Check if we have space for length prefix + encoded string
  if (check) {
    c.write(`if (${c.pos} + 4 + ${len} > ${c.buf}.byteLength) throw new Error('Buffer overflow');`)
  }

  // Write length prefix (big endian)
  c.write(`${c.view}.setUint32(${c.pos}, ${len}, false);`)
  c.write(`${c.pos} += 4;`)

  // Copy encoded bytes
  c.write(`${c.buf}.set(${encoded}, ${c.pos});`)
  c.write(`${c.pos} += ${len};`)
}
