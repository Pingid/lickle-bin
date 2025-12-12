export * from './reader.js'
export * from './writer.js'

import { createDynamicStrategy, createStaticStrategy } from './allocator.js'
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
  const strategy = isSized(schema) ? createStaticStrategy(schema.size) : createDynamicStrategy(opts)
  const backend = createWriter(strategy, opts)
  const internalEncoder = compile(schema, backend)
  return backend.wrap(internalEncoder)
}
