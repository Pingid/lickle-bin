import { DecoderOptions, EncoderOptions } from '../backend.js'
import { isSized, Schema } from '../schema/index.js'
import { createReader } from './reader.js'
import { createWriter } from './writer.js'
import { compile } from '../compiler.js'

export const createDecoder = <T>(schema: Schema<T>, opts?: DecoderOptions) => {
  const backend = createReader(opts)
  const internalDecoder = compile(schema, backend)
  return backend.wrap<T>(internalDecoder)
}

export const createEncoder = <T>(schema: Schema<T>, opts?: EncoderOptions) => {
  const size = isSized(schema) ? schema.size : undefined
  const backend = createWriter(opts, size)
  const internalEncoder = compile(schema, backend)
  return backend.wrap(internalEncoder)
}
