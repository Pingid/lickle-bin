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
      c.write(`const ${c.view} = new DataView(${c.buf}.buffer, ${c.buf}.byteOffset, ${c.buf}.byteLength);`)
      internal(c, inputVar as any)
      c.write(`return ${c.pos};`)
      const code = c.body()
      const importKeys = Array.from(c.imports.keys())
      const importValues = Array.from(c.imports.values())

      const factory = new Function(
        ...importKeys,
        `return function JitEncode(${inputVar}, ${c.buf}, ${c.pos}) {
          ${code}
        }`,
      )
      const fn = factory(...importValues)
      return (val: any) => {
        const bufLen = size ?? opts.initialBufferSize
        const buf = new Uint8Array(bufLen)
        const finalPos = fn(val, buf, 0)
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
    access: (v, k) => {
      // Use dot notation if k is a valid simple identifier
      if (typeof k === 'string' && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)) {
        return `${v}.${k}`
      }
      return `${v}[${typeof k === 'string' ? `'${k}'` : k}]`
    },
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

  // Use a fixed reservation for the length prefix (4 bytes)
  // We save the current position to write the length later
  const startPos = c.var('start')
  c.write(`const ${startPos} = ${c.pos};`)
  c.write(`${c.pos} += 4;`) // Advance past length prefix

  // Optimization: use encodeInto directly into the target buffer
  // This avoids allocating a temporary Uint8Array
  const res = c.var('res')

  if (check) {
    // Safety check logic (simplified for brevity, you might want a "ensure" helper in JIT)
    // Since encodeInto doesn't expand, we must ensure space exists or handle the result
    c.write(`const ${res} = ${enc}.encodeInto(${v}, ${c.buf}.subarray(${c.pos}));`)
    c.write(`if (${res}.read < ${v}.length) throw new Error('Buffer overflow');`)
  } else {
    c.write(`const ${res} = ${enc}.encodeInto(${v}, ${c.buf}.subarray(${c.pos}));`)
  }

  // Go back and write the length
  c.write(`${c.view}.setUint32(${startPos}, ${res}.written, false);`)

  // Advance position by bytes written
  c.write(`${c.pos} += ${res}.written;`)
}
