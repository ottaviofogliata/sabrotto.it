import { describe, expect, it } from 'vitest'
import { __test, onRequest } from '../functions/api/photos/[[path]].js'

type StoredPhoto = Record<string, any>

class MockD1 {
  rows = new Map<string, StoredPhoto>()
  usageCount = 0

  prepare(sql: string) {
    const database = this
    let values: any[] = []
    return {
      bind(...args: any[]) {
        values = args
        return this
      },
      async first() {
        if (sql.includes('COUNT(*) AS count')) return { count: database.usageCount }
        if (sql.includes('SELECT * FROM photo_uploads')) {
          const row = database.rows.get(values[0])
          return row?.guest_session_id === values[1] ? row : null
        }
        if (sql.includes('SELECT drive_file_id FROM photo_uploads')) {
          const row = database.rows.get(values[0])
          return row?.status === 'ready' ? { drive_file_id: row.drive_file_id } : null
        }
        return null
      },
      async all() {
        if (!sql.includes("WHERE status = 'ready'")) return { results: [] }
        return {
          results: [...database.rows.values()]
            .filter(row => row.status === 'ready')
            .map(row => ({
              id: row.id,
              drive_file_id: row.drive_file_id,
              width: row.width,
              height: row.height,
              completed_at: row.completed_at,
            })),
        }
      },
      async run() {
        if (sql.includes('INSERT INTO photo_uploads')) {
          database.rows.set(values[0], {
            id: values[0],
            drive_file_id: values[1],
            completion_token_hash: values[2],
            guest_session_id: values[3],
            original_name: values[4],
            stored_name: values[5],
            mime_type: values[6],
            byte_size: values[7],
            width: values[8],
            height: values[9],
            status: 'pending',
            created_at: values[10],
            expires_at: values[11],
            completed_at: null,
          })
        } else if (sql.includes("SET status = 'ready'")) {
          const row = database.rows.get(values[0])!
          row.status = 'ready'
          row.width = values[1]
          row.height = values[2]
          row.completed_at = values[3]
        } else if (sql.includes("SET status = 'missing'")) {
          const row = database.rows.get(values[0])
          if (row) row.status = 'missing'
        } else if (sql.includes("DELETE FROM photo_uploads")) {
          for (const [id, row] of database.rows) {
            if (row.status === 'pending' && row.expires_at < values[0]) database.rows.delete(id)
          }
        }
        return { success: true }
      },
    }
  }
}

function request(url: string, init: RequestInit = {}) {
  return new Request(`https://sabrotto.it${url}`, {
    ...init,
    headers: {
      origin: 'https://sabrotto.it',
      ...(init.headers || {}),
    },
  })
}

describe('photo API flow', () => {
  it('opens a guest session with Turnstile and no private access key', async () => {
    const response = await onRequest({
      request: request('/api/photos/access/guest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ turnstileToken: 'valid-turnstile-token' }),
      }),
      env: {
        PHOTO_SESSION_SIGNING_SECRET: 'photo-session-signing-secret-for-tests',
        TURNSTILE_SECRET_KEY: 'turnstile-test-secret',
        PHOTO_ALLOWED_ORIGINS: 'https://sabrotto.it',
        __fetch: async (url: string) => {
          if (url.includes('/turnstile/v0/siteverify')) return Response.json({ success: true })
          throw new Error(`Unexpected fetch: ${url}`)
        },
      },
    } as any)

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('sb_photo_guest=')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=Strict')
  })

  it('keeps gallery access behind its private key', async () => {
    const galleryKey = 'gallery-key-for-tests'
    const response = await onRequest({
      request: request('/api/photos/access/gallery', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accessKey: 'wrong-key' }),
      }),
      env: {
        PHOTO_SESSION_SIGNING_SECRET: 'photo-session-signing-secret-for-tests',
        PHOTO_GALLERY_KEY_HASH: await __test.sha256Hex(galleryKey),
        PHOTO_ALLOWED_ORIGINS: 'https://sabrotto.it',
      },
    } as any)

    expect(response.status).toBe(403)
  })

  it('creates, verifies, lists and serves a Drive-backed photo', async () => {
    const database = new MockD1()
    const signingSecret = 'photo-session-signing-secret-for-tests'
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const guestToken = await __test.createSignedSession('guest', 'guest-session', expiresAt, signingSecret)
    const galleryToken = await __test.createSignedSession('gallery', 'gallery-session', expiresAt, signingSecret)

    const env: any = {
      PHOTO_DB: database,
      PHOTO_ALLOWED_ORIGINS: 'https://sabrotto.it',
      PHOTO_SESSION_SIGNING_SECRET: signingSecret,
      GOOGLE_CLIENT_ID: 'client',
      GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_REFRESH_TOKEN: 'refresh',
      GOOGLE_DRIVE_FOLDER_ID: 'folder-1',
      __fetch: async (url: string, init: RequestInit = {}) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          return Response.json({ access_token: 'access', expires_in: 3600 })
        }
        if (url.includes('/files/generateIds')) {
          return Response.json({ ids: ['drive-file-1'] })
        }
        if (url.includes('/drive/v3/files?') && url.includes('pageSize=1000')) {
          return Response.json({ files: [{ id: 'drive-file-1' }] })
        }
        if (url.includes('uploadType=resumable')) {
          return new Response(null, { status: 200, headers: { location: 'https://uploads.google.test/session-1' } })
        }
        if (url.includes('fields=') && url.includes('/files/drive-file-1')) {
          const row = [...database.rows.values()][0]!
          return Response.json({
            id: 'drive-file-1',
            name: row.stored_name,
            mimeType: 'image/jpeg',
            size: String(row.byte_size),
            parents: ['folder-1'],
            imageMediaMetadata: { width: 3840, height: 2160 },
            trashed: false,
          })
        }
        if (url.includes('alt=media')) {
          const range = new Headers(init.headers).get('range')
          return new Response(
            range ? new Uint8Array([0xff, 0xd8, 0xff]) : new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
            { status: range ? 206 : 200, headers: { 'content-type': 'image/jpeg' } },
          )
        }
        throw new Error(`Unexpected fetch: ${url}`)
      },
    }

    const createResponse = await onRequest({
      request: request('/api/photos/uploads', {
        method: 'POST',
        headers: { cookie: `sb_photo_guest=${guestToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          originalName: 'IMG_1234.HEIC',
          mimeType: 'image/jpeg',
          byteSize: 5_000_000,
          width: 3840,
          height: 2160,
        }),
      }),
      env,
    } as any)
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json() as any
    expect(created.uploadUrl).toBe('https://uploads.google.test/session-1')

    const completeResponse = await onRequest({
      request: request(`/api/photos/uploads/${created.photoId}/complete`, {
        method: 'POST',
        headers: { cookie: `sb_photo_guest=${guestToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ completionToken: created.completionToken }),
      }),
      env,
    } as any)
    expect(completeResponse.status).toBe(200)
    expect((await completeResponse.json() as any).ready).toBe(true)

    const galleryResponse = await onRequest({
      request: request('/api/photos/gallery', { headers: { cookie: `sb_photo_gallery=${galleryToken}` } }),
      env,
    } as any)
    expect(galleryResponse.status).toBe(200)
    const gallery = await galleryResponse.json() as any
    expect(gallery.count).toBe(1)
    expect(gallery.photos[0].id).toBe(created.photoId)

    const imageResponse = await onRequest({
      request: request(`/api/photos/${created.photoId}/image`, { headers: { cookie: `sb_photo_gallery=${galleryToken}` } }),
      env,
      waitUntil: () => {},
    } as any)
    expect(imageResponse.status).toBe(200)
    expect(imageResponse.headers.get('content-type')).toBe('image/jpeg')
  })

  it('removes Drive-deleted photos from the gallery listing', async () => {
    const database = new MockD1()
    database.rows.set('photo-deleted', {
      id: 'photo-deleted',
      drive_file_id: 'drive-deleted',
      status: 'ready',
      width: 1200,
      height: 800,
      completed_at: '2020-01-01T20:00:00.000Z',
    })
    const signingSecret = 'photo-session-signing-secret-for-tests'
    const galleryToken = await __test.createSignedSession(
      'gallery',
      'gallery-session',
      Math.floor(Date.now() / 1000) + 3600,
      signingSecret,
    )
    const env: any = {
      PHOTO_DB: database,
      PHOTO_SESSION_SIGNING_SECRET: signingSecret,
      GOOGLE_CLIENT_ID: 'client',
      GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_REFRESH_TOKEN: 'refresh',
      GOOGLE_DRIVE_FOLDER_ID: 'folder-1',
      __fetch: async (url: string) => {
        if (url === 'https://oauth2.googleapis.com/token') {
          return Response.json({ access_token: 'access', expires_in: 3600 })
        }
        if (url.includes('/drive/v3/files?')) return Response.json({ files: [] })
        throw new Error(`Unexpected fetch: ${url}`)
      },
    }

    const response = await onRequest({
      request: request('/api/photos/gallery', { headers: { cookie: `sb_photo_gallery=${galleryToken}` } }),
      env,
    } as any)

    expect(response.status).toBe(200)
    expect((await response.json() as any).count).toBe(0)
    expect(database.rows.get('photo-deleted')?.status).toBe('missing')
  })

  it('rejects uploads over the per-session hourly limit', async () => {
    const database = new MockD1()
    database.usageCount = 30
    const signingSecret = 'photo-session-signing-secret-for-tests'
    const guestToken = await __test.createSignedSession(
      'guest',
      'guest-session',
      Math.floor(Date.now() / 1000) + 3600,
      signingSecret,
    )
    const response = await onRequest({
      request: request('/api/photos/uploads', {
        method: 'POST',
        headers: { cookie: `sb_photo_guest=${guestToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          originalName: 'foto.jpg',
          mimeType: 'image/jpeg',
          byteSize: 1_000_000,
          width: 1600,
          height: 1200,
        }),
      }),
      env: {
        PHOTO_DB: database,
        PHOTO_SESSION_SIGNING_SECRET: signingSecret,
        GOOGLE_DRIVE_FOLDER_ID: 'folder-1',
        PHOTO_ALLOWED_ORIGINS: 'https://sabrotto.it',
      },
    } as any)

    expect(response.status).toBe(429)
  })

  it('rejects a completed file outside the configured Drive folder', async () => {
    const database = new MockD1()
    const signingSecret = 'photo-session-signing-secret-for-tests'
    const completionToken = 'completion-token'
    database.rows.set('abcd-1234', {
      id: 'abcd-1234',
      drive_file_id: 'drive-file-1',
      completion_token_hash: await __test.sha256Hex(completionToken),
      guest_session_id: 'guest-session',
      stored_name: 'stored.jpg',
      byte_size: 500,
      status: 'pending',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    })
    const guestToken = await __test.createSignedSession(
      'guest',
      'guest-session',
      Math.floor(Date.now() / 1000) + 3600,
      signingSecret,
    )
    const response = await onRequest({
      request: request('/api/photos/uploads/abcd-1234/complete', {
        method: 'POST',
        headers: { cookie: `sb_photo_guest=${guestToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ completionToken }),
      }),
      env: {
        PHOTO_DB: database,
        PHOTO_SESSION_SIGNING_SECRET: signingSecret,
        GOOGLE_CLIENT_ID: 'client',
        GOOGLE_CLIENT_SECRET: 'secret',
        GOOGLE_REFRESH_TOKEN: 'refresh',
        GOOGLE_DRIVE_FOLDER_ID: 'folder-1',
        PHOTO_ALLOWED_ORIGINS: 'https://sabrotto.it',
        __fetch: async (url: string) => {
          if (url === 'https://oauth2.googleapis.com/token') {
            return Response.json({ access_token: 'access', expires_in: 3600 })
          }
          if (url.includes('/files/drive-file-1')) {
            return Response.json({
              id: 'drive-file-1',
              name: 'stored.jpg',
              mimeType: 'image/jpeg',
              size: '500',
              parents: ['wrong-folder'],
              imageMediaMetadata: { width: 100, height: 100 },
              trashed: false,
            })
          }
          throw new Error(`Unexpected fetch: ${url}`)
        },
      },
    } as any)

    expect(response.status).toBe(400)
    expect(database.rows.get('abcd-1234')?.status).toBe('pending')
  })
})
