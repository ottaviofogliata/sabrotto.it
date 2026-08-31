import imageCompression from 'browser-image-compression'

export const PHOTO_TARGET_BYTES = 5 * 1024 * 1024
export const PHOTO_MAX_BYTES = 20 * 1024 * 1024
export const PHOTO_MAX_EDGE = 3840

export interface PreparedPhoto {
  file: File
  originalName: string
  width: number
  height: number
}

function isHeicFile(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

function isSupportedPhoto(file: File) {
  return /^(image\/jpeg|image\/png|image\/webp|image\/avif)$/i.test(file.type) || isHeicFile(file)
}

async function convertHeic(file: File) {
  const { heicTo } = await import('heic-to')
  const converted = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.94 })
  return new File([converted], file.name.replace(/\.hei[cf]$/i, '.jpg'), {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  })
}

async function dimensions(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const result = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return result
}

export async function preparePhoto(
  source: File,
  onProgress?: (progress: number) => void,
): Promise<PreparedPhoto> {
  if (!isSupportedPhoto(source)) {
    throw new Error('Formato non supportato. Usa JPEG, PNG, HEIC, WebP o AVIF.')
  }

  onProgress?.(2)
  const decodable = isHeicFile(source) ? await convertHeic(source) : source
  onProgress?.(12)

  const compressed = await imageCompression(decodable, {
    maxSizeMB: PHOTO_TARGET_BYTES / 1024 / 1024,
    maxWidthOrHeight: PHOTO_MAX_EDGE,
    fileType: 'image/jpeg',
    initialQuality: 0.92,
    maxIteration: 12,
    preserveExif: false,
    useWebWorker: true,
    onProgress(progress) {
      onProgress?.(12 + Math.round(progress * 0.84))
    },
  })

  if (compressed.size > PHOTO_MAX_BYTES) {
    throw new Error('La foto non può essere ridotta sotto il limite di 20 MB.')
  }

  const normalized = new File(
    [compressed],
    source.name.replace(/\.[^.]+$/, '') + '.jpg',
    { type: 'image/jpeg', lastModified: source.lastModified },
  )
  const size = await dimensions(normalized)
  onProgress?.(100)

  return {
    file: normalized,
    originalName: source.name,
    width: size.width,
    height: size.height,
  }
}
