export * from './reader.js'
export * from './writer.js'

import { DecoderOptions, EncoderOptions } from '../backend.js'
import { createReader as createBackend } from './reader.js'
import { isSized, Schema } from '../schema/index.js'
import { createWriter } from './writer.js'
import { compile } from '../compiler.js'

export const createDecoder = <T>(schema: Schema<T>, opts?: DecoderOptions) => {
  const backend = createBackend(opts)
  const internalDecoder = compile(schema, backend)
  return backend.wrap<T>(internalDecoder)
}

export const createEncoder = <T>(schema: Schema<T>, opts?: EncoderOptions) => {
  const size = isSized(schema) ? schema.size : undefined
  const backend = createWriter(opts, size)
  const internalEncoder = compile(schema, backend)
  return backend.wrap(internalEncoder)
}
