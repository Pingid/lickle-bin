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
    // bool: bool(check),
    i8: i8(check),
    // u8: u8(check),
    i16: i16(check),
    u16: u16(check),
    f16: f16(check),
    i32: i32(check),
    u32: u32(check),
    f32: f32(check),
    i64: i64(check),
    u64: u64(check),
    f64: f64(check),
    bool: () => (c: JitReadContext) => {
      if (check) c.write(`if (${c.pos} + 1 > ${c.buf}.byteLength) throw new Error('EOF');`)
      const v = c.var('bool')
      if (!check) {
        c.write(`const ${v} = ${c.buf}[${c.pos}] !== 0;`)
      } else {
        c.write(`const ${v} = ${c.view}.getUint8(${c.pos}) !== 0;`)
      }
      c.write(`${c.pos}++;`)
      return v
    },

    u8: () => (c: JitReadContext) => {
      if (check) c.write(`if (${c.pos} + 1 > ${c.buf}.byteLength) throw new Error('EOF');`)
      const v = c.var('u8')
      if (!check) {
        c.write(`const ${v} = ${c.buf}[${c.pos}];`)
      } else {
        c.write(`const ${v} = ${c.view}.getUint8(${c.pos});`)
      }
      c.write(`${c.pos}++;`)
      return v
    },
    str: str(check, opts.maxStringLength),
    // str: () => (c) => {
    //   const len = c.var('strLen')
    //   const v = c.var('strVal')

    //   // Read Length
    //   c.write(`const ${len} = ${c.view}.getUint32(${c.pos}, false);`)
    //   c.write(`${c.pos} += 4;`)

    //   // ... safety checks ...

    //   // Generate Fast String Code
    //   c.write(`let ${v};`)
    //   genFastString(c, len, v) // INLINE THE DECODER

    //   c.write(`${c.pos} += ${len};`)
    //   return v
    // },

    struct: (shape) => (c) => {
      const keys = Object.keys(shape)

      // OPTIMIZATION: Register Pressure Heuristic
      // If we have too many fields, keeping all variables alive causes stack spilling.
      // We switch to incremental assignment for large structs.
      if (keys.length > 5) {
        const result = c.var('struct')
        c.write(`const ${result} = {};`)

        for (const key of keys) {
          // 1. Run the inner decoder
          const val = shape[key]!(c)

          // 2. Assign immediately so 'val' can be garbage collected from registers
          const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`
          c.write(`${result}.${safeKey} = ${val};`)
        }
        return result
      }

      // Fast Path: Object Literal for small structs
      const vars: string[] = []
      for (let i = 0; i < keys.length; i++) {
        vars.push(shape[keys[i]!]!(c))
      }

      const result = c.var('struct')
      const fields = keys
        .map((key, i) => {
          const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`
          return `${safeKey}: ${vars[i]}`
        })
        .join(', ')

      c.write(`const ${result} = { ${fields} };`)
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
      if (check && opts.maxListLength < Infinity) {
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

      // OPTIMIZATION: Use a local variable for position
      // Mutating arguments ('pos') is bad for optimization.
      // We accept 'argPos', assign it to local 'pos', and use 'pos' internally.
      const argPos = 'argPos'
      c.write(`let ${c.pos} = ${argPos};`)

      c.write(`const ${c.view} = new DataView(${c.buf}.buffer, ${c.buf}.byteOffset, ${c.buf}.byteLength);`)

      const resultVar = internal(c)

      c.write(`return ${resultVar};`) // Return ONLY the result, we don't need pos for decode usually

      const fnBody = c.body()
      const importKeys = Array.from(c.imports.keys())
      const importValues = Array.from(c.imports.values())

      const factory = new Function(
        ...importKeys,
        `return function JitDecode(${c.buf}, ${argPos}) { 
          ${fnBody} 
        }`,
      )

      const fn = factory(...importValues)

      return (buf: Uint8Array) => {
        return fn(buf, 0)
      }
    },
  }
}

// Helper to manage JIT state
const createCtx = (): JitReadContext & { imports: Map<string, any>; body: () => string } => {
  let vCount = 0
  const lines: string[] = []

  // Map value -> variable name (e.g. TextDecoder -> "__decoder_0")
  // We use a Map to ensure we reuse the same variable for the same import instance
  const valueToName = new Map<any, string>()
  const imports = new Map<string, any>()

  return {
    var: (p = 'v') => `${p}_${vCount++}`,
    write: (l) => lines.push(l),
    import: (name, val) => {
      // DEDUPLICATION: If we already imported this EXACT value, return its existing name
      if (valueToName.has(val)) return valueToName.get(val)!

      const id = `__${name}_${imports.size}`
      imports.set(id, val)
      valueToName.set(val, id)
      return id
    },
    access: (v, k) => {
      if (typeof k === 'string' && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)) return `${v}.${k}`
      return `${v}[${typeof k === 'string' ? `'${k}'` : k}]`
    },
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

const decoder = new TextDecoder('utf-8', { fatal: true })
const str = (check: boolean, maxLen: number) => () => (c: JitReadContext) => {
  const len = c.var('strLen')
  const v = c.var('strVal')
  const dec = c.import('decoder', decoder)

  // Read length
  if (check) c.write(`if (${c.pos} + 4 > ${c.buf}.byteLength) throw new Error('EOF');`)
  c.write(`const ${len} = ${c.view}.getUint32(${c.pos}, false);`)
  c.write(`${c.pos} += 4;`)

  // Security check
  if (check && maxLen < Infinity) {
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

const genFastString = (c: JitReadContext, lenVar: string, resultVar: string) => {
  // Only use fast path for strings < 48 bytes (heuristic)
  c.write(`if (${lenVar} < 48) {`)
  c.write(`  let ${resultVar} = "";`)
  c.write(`  let i = 0;`)
  c.write(`  while (i < ${lenVar}) {`)
  c.write(`    let b = ${c.buf}[${c.pos} + i];`)
  c.write(`    if (b < 128) {`)
  c.write(`      ${resultVar} += String.fromCharCode(b);`)
  c.write(`      i++;`)
  c.write(`    } else if ((b & 0xe0) === 0xc0) {`)
  c.write(`      ${resultVar} += String.fromCharCode(((b & 0x1f) << 6) | (${c.buf}[${c.pos} + i + 1] & 0x3f));`)
  c.write(`      i += 2;`)
  c.write(`    } else if ((b & 0xf0) === 0xe0) {`)
  c.write(
    `      ${resultVar} += String.fromCharCode(((b & 0x0f) << 12) | ((${c.buf}[${c.pos} + i + 1] & 0x3f) << 6) | (${c.buf}[${c.pos} + i + 2] & 0x3f));`,
  )
  c.write(`      i += 3;`)
  c.write(`    } else {`)
  // Fallback for 4-byte chars (rare) or just let TextDecoder handle complex cases
  c.write(
    `      ${resultVar} = ${c.import('decoder', decoder)}.decode(${c.buf}.subarray(${c.pos}, ${c.pos} + ${lenVar}));`,
  )
  c.write(`      break;`)
  c.write(`    }`)
  c.write(`  }`)
  c.write(`} else {`)
  // Fallback for long strings
  c.write(`  ${resultVar} = ${c.import('decoder', decoder)}.decode(${c.buf}.subarray(${c.pos}, ${c.pos} + ${lenVar}));`)
  c.write(`}`)
}
