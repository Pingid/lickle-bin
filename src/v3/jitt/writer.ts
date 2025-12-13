import { Backend, Kernel, Endian, DEFAULT_ENCODER_OPTIONS, EncoderOptions } from '../backend.js'

interface JitKernel extends Kernel {
  Num: string
  BigNum: string
  Str: string
  Bytes: string
  Bool: string
  Buffer: string
}

export type JitContext = {
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

export const createWriter = (userOpts?: EncoderOptions, size?: number): Backend<JitContext, 'write', JitKernel> => {
  const opts = { ...DEFAULT_ENCODER_OPTIONS, ...userOpts }

  return {
    mode: 'write',
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
    str,

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

      // Retrieve code and imports
      const code = c.body()
      const argNames = [inputVar, 'buf', 'view', 'pos', ...c.imports.keys()]
      const fn = new Function(...argNames, code)
      const importValues = Array.from(c.imports.values())

      // Return the runtime Encoder function
      return (val: any) => {
        // Simple buffer management for the JIT example
        // In a real JIT, we might generate the resizing logic into the function itself
        const bufLen = size ?? opts.initialBufferSize
        const buf = new Uint8Array(bufLen)
        const view = new DataView(buf.buffer)

        // Note: The JIT function updates 'pos' internally (conceptually),
        // but since 'pos' is a primitive passed by value, we can't get the new position out
        // unless we return it or use an object wrapper.
        // The standard JIT pattern usually passes a 'cursor' object or returns the new offset.
        // To fix the original architecture's limitation in 'wrap':

        // We will inject a wrapper for 'pos' or rely on the function returning something?
        // The architecture in `writer.ts` implies direct mutation of `pos` variable code.
        // Since `new Function` cannot mutate a number in the outer scope, we assume
        // strict size calculation occurred before or we change the signature to use a cursor object.

        // HOWEVER, sticking to the requested `wrap` signature:
        // We can make the JIT function return the final `pos`.

        const wrapperFn = new Function(...argNames, code + `\nreturn ${c.pos};`)
        const finalPos = wrapperFn(val, buf, view, 0, ...importValues)

        return buf.subarray(0, finalPos)
      }
    },
  }
}

// Helper to manage JIT state (Identical to Reader, can be shared)
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
    access: (v, k) => `${v}[${typeof k === 'string' ? `'${k}'` : k}]`,
    view: 'view',
    pos: 'pos',
    buf: 'buf',
    imports,
    body: () => lines.join('\n'),
  }
}

const bool = () => (c: JitContext, v: JitKernel['Bool']) => {
  c.write(`${c.view}.setUint8(${c.pos}, ${v} ? 1 : 0);`)
  c.write(`${c.pos}++;`)
}

const i8 = () => (c: JitContext, v: JitKernel['Num']) => {
  c.write(`${c.view}.setInt8(${c.pos}, ${v});`)
  c.write(`${c.pos}++;`)
}

const u8 = () => (c: JitContext, v: JitKernel['Num']) => {
  c.write(`${c.view}.setUint8(${c.pos}, ${v});`)
  c.write(`${c.pos}++;`)
}

const i16 =
  (endian: Endian = 'be') =>
  (c: JitContext, v: JitKernel['Num']) => {
    c.write(`${c.view}.setInt16(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 2;`)
  }

const u16 =
  (endian: Endian = 'be') =>
  (c: JitContext, v: JitKernel['Num']) => {
    c.write(`${c.view}.setUint16(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 2;`)
  }

const f16 =
  (endian: Endian = 'be') =>
  (c: JitContext, v: JitKernel['Num']) => {
    c.write(`${c.view}.setFloat16(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 2;`)
  }

const i32 =
  (endian: Endian = 'be') =>
  (c: JitContext, v: JitKernel['Num']) => {
    c.write(`${c.view}.setInt32(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 4;`)
  }

const u32 =
  (endian: Endian = 'be') =>
  (c: JitContext, v: JitKernel['Num']) => {
    c.write(`${c.view}.setUint32(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 4;`)
  }

const f32 =
  (endian: Endian = 'be') =>
  (c: JitContext, v: JitKernel['Num']) => {
    c.write(`${c.view}.setFloat32(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 4;`)
  }

const i64 =
  (endian: Endian = 'be') =>
  (c: JitContext, v: JitKernel['BigNum']) => {
    c.write(`${c.view}.setBigInt64(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 8;`)
  }

const u64 =
  (endian: Endian = 'be') =>
  (c: JitContext, v: JitKernel['BigNum']) => {
    c.write(`${c.view}.setBigUint64(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 8;`)
  }

const f64 =
  (endian: Endian = 'be') =>
  (c: JitContext, v: JitKernel['Num']) => {
    c.write(`${c.view}.setFloat64(${c.pos}, ${v}, ${endian === 'le'});`)
    c.write(`${c.pos} += 8;`)
  }

const encoder = new TextEncoder()
const str = () => (c: JitContext, v: string) => {
  const start = c.var('start')
  c.write(`const ${start} = ${c.pos};`)
  c.write(`${c.pos} += 4;`)
  const enc = c.import('encoder', encoder)
  const result = c.var('result')
  c.write(`const ${result} = ${enc}.encodeInto(${v}, ${c.buf}.subarray(${c.pos}));`)
  c.write(`${c.view}.setUint32(${start}, ${c.access(result, 'written')}, false);`)
  c.write(`${c.pos} += ${c.access(result, 'written')};`)
}
