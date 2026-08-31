import { describe, expect, it } from 'vitest'
import { __test } from '../functions/api/photos/[[path]].js'

describe('photo Pages Function primitives', () => {
  it('signs sessions and rejects tampering or expiration', async () => {
    const now = 1_800_000_000
    const token = await __test.createSignedSession('guest', 'session-1', now + 60, 'a-long-secret')
    await expect(__test.verifySignedSession(token, 'guest', 'a-long-secret', now)).resolves.toEqual({
      role: 'guest',
      sessionId: 'session-1',
      expiresAt: now + 60,
    })
    await expect(__test.verifySignedSession(`${token}x`, 'guest', 'a-long-secret', now)).resolves.toBeNull()
    await expect(__test.verifySignedSession(token, 'gallery', 'a-long-secret', now)).resolves.toBeNull()
    await expect(__test.verifySignedSession(token, 'guest', 'a-long-secret', now + 61)).resolves.toBeNull()
  })

  it('validates upload metadata and the 20 MiB boundary', () => {
    expect(__test.validateUploadMetadata({
      originalName: 'IMG_1234.HEIC',
      mimeType: 'image/jpeg',
      byteSize: __test.MAX_UPLOAD_BYTES,
      width: 3840,
      height: 2160,
    })).toMatchObject({ originalName: 'IMG_1234.HEIC', mimeType: 'image/jpeg' })

    expect(() => __test.validateUploadMetadata({
      originalName: 'bad.gif',
      mimeType: 'image/gif',
      byteSize: 200,
      width: 10,
      height: 10,
    })).toThrow('Invalid photo metadata')

    expect(() => __test.validateUploadMetadata({
      originalName: 'large.jpg',
      mimeType: 'image/jpeg',
      byteSize: __test.MAX_UPLOAD_BYTES + 1,
      width: 3840,
      height: 2160,
    })).toThrow('Invalid photo metadata')
  })

  it('sanitizes names and detects JPEG magic bytes', () => {
    expect(__test.safeOriginalName('../album\\foto\u0000.jpg')).toBe('..-album-foto-.jpg')
    expect(__test.isJpegPrefix(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true)
    expect(__test.isJpegPrefix(new Uint8Array([0x3c, 0x68, 0x74, 0x6d]))).toBe(false)
  })
})
