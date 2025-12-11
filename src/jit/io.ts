import { Codec } from '../core.js'
import { JitContext, Jittable } from './core.js'

export const compileEncoder: {
  <D, E>(codec: Codec<D, E> & Jittable): (val: E) => Uint8Array
  (codec: Jittable): (val: unknown) => Uint8Array
} = (codec: Jittable): ((val: unknown) => Uint8Array) => {
  const imports: Record<string, any> = {}
  const lines: string[] = []
  let varCount = 0

  const ctx: JitContext = {
    var: (p = 't') => `${p}_${varCount++}`,
    write: (c) => lines.push(c),
    import: (name, val) => {
      if (!imports[name]) imports[name] = val
      return name
    },
    view: 'view',
    pos: 'pos',
    buf: 'buf',
  }

  // 1. Calculate Size (using the standard size function)
  // Optimization: You could also JIT compile the size calculation, but let's start here.
  ctx.write(`const size = codec.s(val);`)
  ctx.write(`const buf = new Uint8Array(size);`)
  ctx.write(`const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);`)
  ctx.write(`let pos = 0;`)

  // 2. Generate Body
  codec.je(ctx, 'val')

  // 3. Return
  ctx.write(`return buf;`)

  // 4. Compile
  const fnBody = lines.join('\n')
  const importKeys = ['codec', ...Object.keys(imports)]
  const importValues = [codec, ...Object.values(imports)]
  const factory = new Function(...importKeys, `return function CompiledEncode(val) { ${fnBody} }`)
  return factory(...importValues)
}

export const compileDecoder: {
  <D, E>(codec: Codec<D, E> & Jittable): (buf: Uint8Array) => D
  (codec: Jittable): (buf: Uint8Array) => unknown
} = (codec: Jittable): ((buf: Uint8Array) => unknown) => {
  const imports: Record<string, any> = {}
  const lines: string[] = []
  let varCount = 0

  const ctx: JitContext = {
    var: (p = 't') => `${p}_${varCount++}`,
    write: (c) => lines.push(c),
    import: (name, val) => {
      if (!imports[name]) imports[name] = val
      return name
    },
    view: 'view',
    pos: 'pos',
    buf: 'buf', // Unused in decode usually
  }

  // 1. Setup
  ctx.write(`const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);`)
  ctx.write(`let pos = 0;`)

  // 2. Generate Body
  const resultVar = codec.jd(ctx)

  // 3. Return
  ctx.write(`return ${resultVar};`)

  // 4. Compile
  const fnBody = lines.join('\n')
  const importKeys = Object.keys(imports)
  const importValues = Object.values(imports)
  const factory = new Function(...importKeys, `return function CompiledDecode(buf) { ${fnBody} }`)
  return factory(...importValues)
}
