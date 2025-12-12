import { Backend, Kernel, Mode } from './types.js'
import { Schema } from './schema/index.js'

export const compile = <Ctx, M extends Mode, K extends Kernel>(
  schema: Schema<any>,
  backend: Backend<Ctx, M, K>,
): any => {
  switch (schema.tag) {
    case 'bool':
      return backend.bool()
    case 'i8':
      return backend.i8()
    case 'u8':
      return backend.u8()
    case 'i16':
      return backend.i16()
    case 'u16':
      return backend.u16()
    case 'f16':
      return backend.f16()
    case 'i32':
      return backend.i32()
    case 'u32':
      return backend.u32()
    case 'f32':
      return backend.f32()
    case 'i64':
      return backend.i64()
    case 'u64':
      return backend.u64()
    case 'f64':
      return backend.f64()
    case 'str':
      return backend.str()
    case 'struct': {
      const compiledShape: Record<string, any> = {}
      for (const key in schema.shape) {
        compiledShape[key] = compile(schema.shape[key], backend)
      }
      return backend.struct(compiledShape)
    }
    case 'list':
      return backend.list(compile(schema.item, backend))
    default:
      throw new Error(`Unsupported schema type: ${(schema as Schema<any>).tag}`)
  }
}
