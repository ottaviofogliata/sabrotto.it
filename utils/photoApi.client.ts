import type { GalleryPhoto } from './galleryPool'
import type { PreparedPhoto } from './photoProcessing.client'

interface ApiErrorBody {
  statusMessage?: string
}

async function apiJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const body = await response.json().catch(() => ({})) as T & ApiErrorBody
  if (!response.ok) throw new Error(body.statusMessage || 'Operazione non riuscita.')
  return body
}

export async function readPhotoSession(role: 'guest' | 'gallery') {
  return apiJson<{ authorized: boolean, expiresAt?: number }>(`/api/photos/session?role=${role}`)
}

export async function exchangeGuestAccess(turnstileToken: string) {
  return apiJson<{ authorized: true }>('/api/photos/access/guest', {
    method: 'POST',
    body: JSON.stringify({ turnstileToken }),
  })
}

export async function exchangeGalleryAccess(accessKey: string) {
  return apiJson<{ authorized: true }>('/api/photos/access/gallery', {
    method: 'POST',
    body: JSON.stringify({ accessKey }),
  })
}

function uploadBlobDirectly(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', uploadUrl)
    request.setRequestHeader('Content-Type', 'image/jpeg')
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener('load', () => {
      if (request.status === 200 || request.status === 201) resolve()
      else reject(new Error('Google Drive non ha accettato la foto.'))
    })
    request.addEventListener('error', () => reject(new Error('Connessione interrotta durante il caricamento.')))
    request.addEventListener('abort', () => reject(new Error('Caricamento annullato.')))
    request.send(file)
  })
}

export async function uploadPreparedPhoto(
  photo: PreparedPhoto,
  onProgress?: (progress: number) => void,
) {
  const upload = await apiJson<{
    photoId: string
    uploadUrl: string
    completionToken: string
  }>('/api/photos/uploads', {
    method: 'POST',
    body: JSON.stringify({
      originalName: photo.originalName,
      mimeType: 'image/jpeg',
      byteSize: photo.file.size,
      width: photo.width,
      height: photo.height,
    }),
  })

  await uploadBlobDirectly(upload.uploadUrl, photo.file, onProgress)
  await apiJson(`/api/photos/uploads/${upload.photoId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ completionToken: upload.completionToken }),
  })
  return upload.photoId
}

export async function readGalleryPhotos() {
  return apiJson<{ photos: GalleryPhoto[], count: number }>('/api/photos/gallery')
}
