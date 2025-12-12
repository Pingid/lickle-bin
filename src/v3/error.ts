export const enum ErrorCode {
  EOF = 'EOF',
  TRAILING_DATA = 'TRAILING_DATA',
  OVERFLOW = 'OVERFLOW', // Integers too big for target type
  BANNED_TYPE = 'BANNED_TYPE', // e.g. NaN or Infinity when not allowed
}

export class BinError extends Error {
  public readonly path: (string | number)[] = []

  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly offset?: number,
  ) {
    super(message)
    this.name = 'BinError'
  }

  pushPath(key: string | number) {
    this.path.unshift(key)
    this.recomputeMessage()
  }

  private recomputeMessage() {
    const p = this.path.map((k) => (typeof k === 'number' ? `[${k}]` : `.${k}`)).join('')
    const at = this.offset != null ? ` at byte ${this.offset}` : ''
    this.message = `[${this.code}] ${this.originalMessage} (in ${p || 'root'})${at}`
  }

  // Store original message so we don't duplicate text when recomputing
  private originalMessage = this.message
}

export const fail = (code: ErrorCode, msg: string, offset?: number): never => {
  throw new BinError(code, msg, offset)
}

/** * Context Wrapper:
 * Catches errors from inner codecs and prepends the current key/index.
 * This is zero-overhead in happy paths if implemented inside the compiler/runtime properly.
 */
export const ctx = <T>(key: string | number, fn: () => T): T => {
  if (!DEBUG) return fn()
  try {
    return fn()
  } catch (e) {
    if (e instanceof BinError) {
      e.pushPath(key)
    }
    throw e
  }
}

const DEBUG = process.env['NODE_ENV'] !== 'production'
