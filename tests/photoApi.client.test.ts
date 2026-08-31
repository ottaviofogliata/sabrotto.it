import { afterEach, describe, expect, it, vi } from 'vitest'
import { uploadPreparedPhoto } from '../utils/photoApi.client'

class MockUploadRequest {
  status = 0
  upload = { addEventListener: vi.fn() }
  listeners = new Map<string, () => void>()

  open() {}
  setRequestHeader() {}

  addEventListener(name: string, listener: () => void) {
    this.listeners.set(name, listener)
  }

  send() {
    this.listeners.get('error')?.()
  }
}

const preparedPhoto = {
  file: new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' }),
  originalName: 'photo.jpg',
  width: 1200,
  height: 800,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('photo upload client', () => {
  it('completes an upload when Drive saved the file but its CORS response is opaque', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        photoId: 'photo-1',
        uploadUrl: 'https://drive.example/upload-session',
        completionToken: 'completion-token',
      }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ ready: true }))

    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('XMLHttpRequest', MockUploadRequest)

    await expect(uploadPreparedPhoto(preparedPhoto)).resolves.toBe('photo-1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/photos/uploads/photo-1/complete')
  })

  it('reports the network failure when the Worker cannot verify the Drive file', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        photoId: 'photo-2',
        uploadUrl: 'https://drive.example/upload-session',
        completionToken: 'completion-token',
      }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ statusMessage: 'File not found' }, { status: 502 }))

    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('XMLHttpRequest', MockUploadRequest)

    await expect(uploadPreparedPhoto(preparedPhoto)).rejects.toThrow('Connessione interrotta durante il caricamento.')
  })
})
