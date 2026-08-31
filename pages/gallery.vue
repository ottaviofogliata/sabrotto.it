<script setup lang="ts">
import { exchangeGalleryAccess, readGalleryPhotos, readPhotoSession } from '~/utils/photoApi.client'
import { GalleryPool, type GalleryPhoto } from '~/utils/galleryPool'

type AccessState = 'checking' | 'authorized' | 'denied'
type WakeLockSentinelLike = { release: () => Promise<void>, addEventListener: (type: string, listener: () => void) => void }

const accessState = ref<AccessState>('checking')
const accessMessage = ref('Verifica del link operatore…')
const galleryRoot = ref<HTMLElement>()
const started = ref(false)
const paused = ref(false)
const loadingPhotos = ref(false)
const currentPhoto = ref<GalleryPhoto | null>(null)
const photoCount = ref(0)
const controlsVisible = ref(true)
const galleryMessage = ref('In attesa delle prime foto…')

const pool = new GalleryPool()
let queuedPhoto: GalleryPhoto | null = null
let queuePromise: Promise<void> | null = null
let slideTimer: ReturnType<typeof setInterval> | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null
let controlsTimer: ReturnType<typeof setTimeout> | null = null
let wakeLock: WakeLockSentinelLike | null = null
const photoHistory = ref<GalleryPhoto[]>([])

useSeoMeta({
  title: 'Gallery privata | Ottavio e Sabrina',
  description: 'La gallery privata delle fotografie del matrimonio di Ottavio e Sabrina.',
  robots: 'noindex, nofollow, noarchive',
})

async function initializeAccess() {
  try {
    const session = await readPhotoSession('gallery')
    if (session.authorized) {
      accessState.value = 'authorized'
      return
    }
  } catch (error) {
    if (!location.hash) {
      accessState.value = 'denied'
      accessMessage.value = error instanceof Error ? error.message : 'Gallery non disponibile.'
      return
    }
  }

  // Preserve fragment-based access across a possible `/gallery` →
  // `/gallery/` normalization performed by static hosting.
  if (!location.hash) await new Promise(resolve => setTimeout(resolve, 200))
  const key = decodeURIComponent(location.hash.slice(1)).trim()
  if (!key) {
    accessState.value = 'denied'
    accessMessage.value = 'Apri il link operatore ricevuto dagli sposi.'
    return
  }

  try {
    await exchangeGalleryAccess(key)
    window.history.replaceState(null, '', `${location.pathname}${location.search}`)
    accessState.value = 'authorized'
  } catch (error) {
    accessState.value = 'denied'
    accessMessage.value = error instanceof Error ? error.message : 'Link operatore non valido.'
  }
}

async function refreshPhotos() {
  if (loadingPhotos.value || accessState.value !== 'authorized') return
  loadingPhotos.value = true
  try {
    const result = await readGalleryPhotos()
    const availableIds = new Set(result.photos.map(photo => photo.id))
    photoCount.value = result.count
    pool.update(result.photos)
    photoHistory.value = photoHistory.value.filter(photo => availableIds.has(photo.id))
    if (queuedPhoto && !availableIds.has(queuedPhoto.id)) queuedPhoto = null
    if (currentPhoto.value && !availableIds.has(currentPhoto.value.id)) currentPhoto.value = null
    if (result.count === 0) {
      currentPhoto.value = null
      queuedPhoto = null
      galleryMessage.value = 'In attesa delle prime foto…'
    } else if (started.value && !currentPhoto.value && !queuedPhoto) {
      await prepareNext()
      await advance()
    }
  } catch (error) {
    galleryMessage.value = error instanceof Error ? error.message : 'Non riesco ad aggiornare la gallery.'
  } finally {
    loadingPhotos.value = false
  }
}

function preload(photo: GalleryPhoto) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Foto non disponibile'))
    image.src = photo.imageUrl
  })
}

async function prepareNext() {
  if (queuedPhoto || queuePromise) return queuePromise
  queuePromise = (async () => {
    while (pool.size > 0 && !queuedPhoto) {
      const candidate = pool.next()
      if (!candidate) break
      try {
        await preload(candidate)
        queuedPhoto = candidate
      } catch {
        pool.remove(candidate.id)
        photoCount.value = pool.size
      }
    }
  })().finally(() => { queuePromise = null })
  return queuePromise
}

async function showPhoto(photo: GalleryPhoto, rememberCurrent = true) {
  if (rememberCurrent && currentPhoto.value && currentPhoto.value.id !== photo.id) {
    photoHistory.value.push(currentPhoto.value)
    if (photoHistory.value.length > 100) photoHistory.value.shift()
  }
  currentPhoto.value = photo
  galleryMessage.value = ''
}

async function advance() {
  if (!started.value) return
  if (!queuedPhoto) await prepareNext()
  if (!queuedPhoto) {
    if (pool.size === 0) galleryMessage.value = 'In attesa delle prime foto…'
    return
  }
  const next = queuedPhoto
  queuedPhoto = null
  await showPhoto(next)
  void prepareNext()
}

async function previous() {
  const photo = photoHistory.value.pop()
  if (!photo) return
  paused.value = true
  await showPhoto(photo, false)
  revealControls()
}

function resetSlideTimer() {
  if (slideTimer) clearInterval(slideTimer)
  slideTimer = setInterval(() => {
    if (!paused.value) void advance()
  }, 8000)
}

async function requestWakeLock() {
  try {
    const wakeLockApi = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock
    if (!wakeLockApi || document.visibilityState !== 'visible') return
    wakeLock = await wakeLockApi.request('screen')
    wakeLock.addEventListener('release', () => { wakeLock = null })
  } catch {
    wakeLock = null
  }
}

async function enterFullscreen() {
  try {
    if (!document.fullscreenElement) await galleryRoot.value?.requestFullscreen()
  } catch {
    // The slideshow remains usable when fullscreen is unavailable.
  }
}

async function startGallery() {
  started.value = true
  paused.value = false
  await Promise.allSettled([enterFullscreen(), requestWakeLock()])
  await refreshPhotos()
  if (!currentPhoto.value) {
    await prepareNext()
    await advance()
  }
  resetSlideTimer()
  refreshTimer = setInterval(() => { void refreshPhotos() }, 20000)
  revealControls()
}

async function onCurrentPhotoError() {
  const failedId = currentPhoto.value?.id
  if (!failedId) return
  pool.remove(failedId)
  photoHistory.value = photoHistory.value.filter(photo => photo.id !== failedId)
  currentPhoto.value = null
  photoCount.value = pool.size
  await advance()
}

function togglePause() {
  paused.value = !paused.value
  revealControls()
}

function revealControls() {
  controlsVisible.value = true
  if (controlsTimer) clearTimeout(controlsTimer)
  controlsTimer = setTimeout(() => { controlsVisible.value = false }, 3500)
}

function onKeydown(event: KeyboardEvent) {
  if (!started.value) return
  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault()
    togglePause()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    void advance()
    resetSlideTimer()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    void previous()
  } else if (event.key.toLowerCase() === 'f') {
    event.preventDefault()
    void enterFullscreen()
  }
}

function onVisibilityChange() {
  if (started.value && document.visibilityState === 'visible' && !wakeLock) void requestWakeLock()
}

onMounted(async () => {
  await initializeAccess()
  if (accessState.value === 'authorized') await refreshPhotos()
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  if (slideTimer) clearInterval(slideTimer)
  if (refreshTimer) clearInterval(refreshTimer)
  if (controlsTimer) clearTimeout(controlsTimer)
  void wakeLock?.release()
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <main
    ref="galleryRoot"
    class="gallery-page"
    :class="{ 'gallery-page--started': started, 'gallery-page--controls': controlsVisible }"
    @mousemove="revealControls"
    @click.self="revealControls"
  >
    <section v-if="accessState !== 'authorized'" class="gallery-gate" aria-live="polite">
      <div class="gallery-gate__aperture" aria-hidden="true"><span /></div>
      <p>Ottavio &amp; Sabrina</p>
      <h1>Gallery privata</h1>
      <div v-if="accessState === 'checking'" class="gallery-loader" aria-hidden="true" />
      <span>{{ accessMessage }}</span>
    </section>

    <section v-else-if="!started" class="gallery-launch">
      <div class="gallery-launch__flash" aria-hidden="true">✦</div>
      <p>Missione Paparazzi</p>
      <h1>La serata,<br>uno scatto alla volta.</h1>
      <span>{{ photoCount ? `${photoCount} ${photoCount === 1 ? 'foto pronta' : 'foto pronte'}` : 'In attesa delle prime foto' }}</span>
      <button type="button" @click="startGallery">Avvia la gallery</button>
      <small>Schermo intero · cambio ogni 8 secondi</small>
    </section>

    <template v-else>
      <Transition name="photo-crossfade">
        <img
          v-if="currentPhoto"
          :key="currentPhoto.id"
          class="gallery-photo"
          :src="currentPhoto.imageUrl"
          alt="Foto condivisa dagli invitati"
          @error="onCurrentPhotoError"
        >
      </Transition>

      <div v-if="!currentPhoto" class="gallery-empty" aria-live="polite">
        <div class="gallery-empty__aperture" aria-hidden="true" />
        <p>{{ galleryMessage }}</p>
      </div>

      <div class="gallery-status" :class="{ 'gallery-status--visible': controlsVisible }">
        <span>{{ photoCount }} {{ photoCount === 1 ? 'foto' : 'foto' }}</span>
        <span>{{ paused ? 'In pausa' : 'In riproduzione' }}</span>
      </div>

      <nav class="gallery-controls" :class="{ 'gallery-controls--visible': controlsVisible }" aria-label="Controlli gallery" @click.stop>
        <button type="button" aria-label="Foto precedente" :disabled="!photoHistory.length" @click="previous">←</button>
        <button type="button" :aria-label="paused ? 'Riprendi' : 'Metti in pausa'" @click="togglePause">{{ paused ? '▶' : 'Ⅱ' }}</button>
        <button type="button" aria-label="Foto successiva" @click="advance(); resetSlideTimer()">→</button>
        <button type="button" aria-label="Schermo intero" @click="enterFullscreen">⛶</button>
      </nav>
    </template>
  </main>
</template>

<style scoped>
.gallery-page {
  position: fixed;
  inset: 0;
  z-index: 100;
  min-width: 320px;
  min-height: 100svh;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #fff8ed;
  background: #050505;
  font-family: var(--font-sans);
}

.gallery-page:not(.gallery-page--started) {
  background:
    radial-gradient(circle at 50% 15%, rgba(255, 200, 61, 0.13), transparent 32rem),
    linear-gradient(145deg, #101820, #050505 68%);
}

.gallery-page--started,
.gallery-page::backdrop {
  background: #000;
}

.gallery-page:not(.gallery-page--started)::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0.11;
  background-image:
    linear-gradient(rgba(255, 248, 237, 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 248, 237, 0.12) 1px, transparent 1px);
  background-size: 36px 36px;
}

.gallery-gate,
.gallery-launch {
  position: relative;
  z-index: 2;
  width: min(calc(100% - 2rem), 40rem);
  padding: clamp(2rem, 7vw, 4.5rem);
  border: 1px solid rgba(255, 248, 237, 0.18);
  border-radius: 2rem;
  background: rgba(8, 12, 16, 0.72);
  box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.38);
  text-align: center;
  backdrop-filter: blur(18px);
}

.gallery-gate p,
.gallery-launch p {
  margin: 0 0 0.7rem;
  color: #ffc83d;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.gallery-gate h1,
.gallery-launch h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(2.6rem, 9vw, 5.6rem);
  font-weight: 500;
  line-height: 0.95;
}

.gallery-gate > span,
.gallery-launch > span {
  display: block;
  margin: 1.3rem 0;
  color: rgba(255, 248, 237, 0.7);
  font-size: 0.92rem;
  line-height: 1.6;
}

.gallery-launch button {
  width: min(100%, 20rem);
  min-height: 3.8rem;
  margin-top: 0.4rem;
  border: 1px solid #e2a82d;
  border-radius: 999px;
  color: #172433;
  background: linear-gradient(#ffdf76, #ffc83d);
  font-size: 1rem;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 0.8rem 2rem rgba(255, 200, 61, 0.16);
}

.gallery-launch small { display: block; margin-top: 1rem; color: rgba(255, 248, 237, 0.44); }
.gallery-launch__flash { margin-bottom: 0.7rem; color: #ffc83d; font-size: 4rem; }

.gallery-gate__aperture {
  position: relative;
  width: 4.8rem;
  height: 4.8rem;
  margin: 0 auto 1.4rem;
  border: 0.25rem solid #ffc83d;
  border-radius: 50%;
}
.gallery-gate__aperture::before,
.gallery-gate__aperture::after,
.gallery-gate__aperture span { content: ""; position: absolute; inset: 0.65rem; border: 0.18rem solid rgba(255, 248, 237, 0.7); transform: rotate(30deg); }
.gallery-gate__aperture::after { transform: rotate(90deg); }
.gallery-gate__aperture span { transform: rotate(150deg); }

.gallery-loader {
  width: 2rem;
  height: 2rem;
  margin: 1.5rem auto 0;
  border: 0.22rem solid rgba(255, 248, 237, 0.15);
  border-top-color: #ffc83d;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.gallery-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  image-orientation: from-image;
  user-select: none;
}

.photo-crossfade-enter-active,
.photo-crossfade-leave-active { transition: opacity 600ms ease; }
.photo-crossfade-enter-from,
.photo-crossfade-leave-to { opacity: 0; }
.photo-crossfade-leave-active { position: absolute; inset: 0; }

.gallery-empty {
  display: grid;
  place-items: center;
  gap: 1.2rem;
  color: rgba(255, 255, 255, 0.58);
  text-align: center;
}
.gallery-empty__aperture { width: 5rem; height: 5rem; border: 0.35rem dashed rgba(255, 200, 61, 0.65); border-radius: 50%; animation: spin 8s linear infinite; }
.gallery-empty p { margin: 0; font-size: clamp(1rem, 2vw, 1.35rem); letter-spacing: 0.05em; }

.gallery-controls {
  position: fixed;
  left: 50%;
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 10;
  display: flex;
  gap: 0.45rem;
  padding: 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.68);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 1rem);
  transition: opacity 180ms ease, transform 180ms ease;
  backdrop-filter: blur(14px);
}
.gallery-controls--visible { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }
.gallery-controls button { width: 3rem; height: 3rem; border: 0; border-radius: 50%; color: white; background: rgba(255, 255, 255, 0.1); font-size: 1.25rem; cursor: pointer; }
.gallery-controls button:disabled { opacity: 0.28; cursor: default; }

.gallery-status {
  position: fixed;
  top: max(0.8rem, env(safe-area-inset-top));
  left: 50%;
  z-index: 10;
  display: flex;
  gap: 1rem;
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.72);
  background: rgba(0, 0, 0, 0.62);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  opacity: 0;
  transform: translate(-50%, -0.6rem);
  transition: opacity 180ms ease, transform 180ms ease;
  backdrop-filter: blur(12px);
}
.gallery-status--visible { opacity: 1; transform: translate(-50%, 0); }

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 520px) {
  .gallery-gate,
  .gallery-launch { width: calc(100% - 1.2rem); padding: 2rem 1.2rem; border-radius: 1.4rem; }
  .gallery-controls button { width: 2.75rem; height: 2.75rem; }
}

@media (prefers-reduced-motion: reduce) {
  .photo-crossfade-enter-active,
  .photo-crossfade-leave-active { transition-duration: 1ms; }
}
</style>
