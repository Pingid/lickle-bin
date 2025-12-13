import { Backend, DecoderOptions, Kernel, Endian } from '../backend.js'
import { DEFAULT_DECODER_OPTIONS } from '../backend.js'
import { ErrorCode, fail } from '../error.js'
import { ReadCursor } from '../types.js'

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
  // The variable name of the DataView
  view: string
  // The variable name of the position cursor
  pos: string
  // (Encode only) The variable name of the buffer (Uint8Array)
  buf: string
}

export const createReader = (userOpts?: DecoderOptions): Backend<JitContext, 'read', JitKernel> => {
  const opts = { ...DEFAULT_DECODER_OPTIONS, ...userOpts }

  return {
    mode: 'read',
    bool: () => (c: JitContext, v: JitKernel['Bool']) => {
      c.write(`${c.view}.setUint8(${c.pos}, ${v} ? 1 : 0);`)
      c.write(`${c.pos}++;`)
    },
    ...({} as Omit<Backend<JitContext, 'read', JitKernel>, 'mode' | 'bool'>),
  }
}
