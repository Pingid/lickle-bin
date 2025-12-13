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
  // Add a line of code to the function body
  write: (code: string) => void
  //   // The variable name of the DataView
  //   view: string
  //   // The variable name of the position cursor
  //   pos: string
  //   // (Encode only) The variable name of the buffer (Uint8Array)
  //   buf: string
  //   view: { [K in keyof DataView]: (...args: Params<DataView[K]>) => number }
  view: DataView
}

export const createReader = (userOpts?: DecoderOptions): Backend<JitContext, 'read', JitKernel> => {
  const opts = { ...DEFAULT_DECODER_OPTIONS, ...userOpts }

  return {
    mode: 'read',
    bool: () => (c: JitContext, v: JitKernel['Bool']) => {
      // c.view.getUint8(c.pos)
      //   c.write(`${c.view}.setUint8(${c.pos}, ${v} ? 1 : 0);`)
      //   c.write(`${c.pos}++;`)
      //   c``
    },
    ...({} as Omit<Backend<JitContext, 'read', JitKernel>, 'mode' | 'bool'>),
  }
}

type Params<T> = T extends (offset: number, ...args: infer A) => any ? A : never
const writeNum = <K extends keyof DataView>(key: K, ...args: Params<DataView[typeof key]>) => {
  // c.view
}

// const i16 = writeNum('setInt16', 2)

// const i16Safe = (endian?: Endian) => {
//   const le = endian === 'le'
//   return (c: JitContext, v: number) => {
//     if (c.pos + 2 > c.buf.byteLength) {
//       if (c.ensure) c.ensure(2)
//       else return eof(c, 2)
//     }
//     c.view.setInt16(c.pos, v, le)
//     c.pos += 2
//   }
// }
