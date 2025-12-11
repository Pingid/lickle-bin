import { Codec } from '../core.js'

export type JitContext = {
  // Generate a unique variable name (e.g., "v1", "i2")
  var: (prefix?: string) => string
  // Add a line of code to the function body
  write: (code: string) => void
  // Register an external value (like TextEncoder) and get its variable name
  import: (name: string, value: any) => string
  // The variable name of the DataView
  view: string
  // The variable name of the position cursor
  pos: string
  // (Encode only) The variable name of the buffer (Uint8Array)
  buf: string
}

export type Jittable = {
  /** Emits code to encode 'valueVar' */
  je: (ctx: JitContext, valueVar: string) => void
  /** Emits code to decode and returns the variable name of the result */
  jd: (ctx: JitContext) => string
}

export type JitCodec<D, E = D> = Codec<D, E> & Jittable
