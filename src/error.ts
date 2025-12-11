export const enum ErrorCode {
  EOF = 'EOF',
  INVALID_TAG = 'INVALID_TAG',
  INVALID_UTF8 = 'INVALID_UTF8',
  SIZE_LIMIT = 'SIZE_LIMIT',
  ASSERTION = 'ASSERTION',
  UNKNOWN = 'UNKNOWN',
}

export class BinError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public offset?: number,
    public context?: string,
  ) {
    super(`[${code}] ${message}${offset != null ? ` at offset ${offset}` : ''}`)
    this.name = 'BinError'
  }
}

/** Throws a BincodeError and cleans the stack trace so it points to the caller. */
export const fail = (code: ErrorCode, msg: string, offset?: number, fn?: Function): never => {
  const e = new BinError(code, msg, offset)
  if ('captureStackTrace' in Error) {
    ;(Error as any).captureStackTrace(e, fn ?? fail)
  }
  throw e
}

/** Wraps a codec execution to add context if it fails. */
const DEBUG = process.env['NODE_ENV'] !== 'production'
export const withContext = <T>(context: string, fn: () => T): T => {
  if (!DEBUG) return fn()
  try {
    return fn()
  } catch (e) {
    if (e instanceof BinError) {
      e.context = e.context ? `${context}.${e.context}` : context
      e.message = `[${e.code}] ${e.message.split(' (in')[0]} (in ${e.context})`
    }
    throw e
  }
}
