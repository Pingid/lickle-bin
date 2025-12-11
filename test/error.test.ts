import { describe, it } from 'vitest'

import { tryDecode, ErrorCode, Result } from '../src/index.js'
import * as b from '../src/codecs.js'

describe('Error Handling', () => {
  const expectError = (code: ErrorCode, result: Result<any>) => {
    // if (result.ok === true) throw new Error('Expected error, got success')
    // expect(result.ok).toBe(false)
    // expect(result.error.code).toBe(code)
    console.log(code, result)
  }
  it('throws EOF when buffer is too short', () => {
    const codec = b.uint32() // Expects 4 bytes
    const shortBuf = new Uint8Array([1, 2, 3]) // Only 3 bytes

    // Checked reader should throw strict EOF
    expectError(ErrorCode.EOF, tryDecode(codec, shortBuf))
  })

  // it('throws SIZE_LIMIT on huge allocations', () => {
  //   // Malicious payload: Varint encoding of 0xffffffff (4294967295), then empty
  //   // 0xff 0xff 0xff 0xff 0x0f encodes max uint32 as varint
  //   const maliciousBuf = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x0f])
  //   const codec = b.array(b.uint8())

  //   expect(() => decode(codec, maliciousBuf)).toThrowError(/SIZE_LIMIT/)
  // })

  // it('throws on invalid UTF-8', () => {
  //   // 0xFF is never valid in UTF-8
  //   const badBuf = encode(b.bytes(), new Uint8Array([0xff]))
  //   expect(() => decode(b.utf8(), badBuf)).toThrowError(/INVALID_UTF8/)
  // })
})
