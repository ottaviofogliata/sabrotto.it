<script setup lang="ts">
import 'photoswipe/style.css'
import { exchangeGuestAccess, readPhotoSession, uploadPreparedPhoto } from '~/utils/photoApi.client'
import { preparePhoto, type PreparedPhoto } from '~/utils/photoProcessing.client'

type AccessState = 'checking' | 'turnstile' | 'authorized' | 'denied'
type ItemStatus = 'preparing' | 'ready' | 'uploading' | 'uploaded' | 'error'

interface PhotoItem {
  id: string
  sourceName: string
  prepared?: PreparedPhoto
  previewUrl?: string
  status: ItemStatus
  prepareProgress: number
  uploadProgress: number
  error?: string
}

const config = useRuntimeConfig()
const accessState = ref<AccessState>('checking')
const accessMessage = ref('Verifica del link privato…')
const privateAccessKey = ref('')
const turnstileWidget = ref<string>()
const libraryInput = ref<HTMLInputElement>()
const cameraInput = ref<HTMLInputElement>()
const items = ref<PhotoItem[]>([])
const selectionKind = ref<'library' | 'camera'>('library')
const isPreparing = ref(false)
const isUploading = ref(false)
const isSuccess = ref(false)
const uploadedCount = ref(0)

useSeoMeta({
  title: 'Missione Paparazzi | Ottavio e Sabrina',
  description: 'La pagina privata per condividere le foto del matrimonio di Ottavio e Sabrina.',
  robots: 'noindex, nofollow, noarchive',
})

const readyItems = computed(() => items.value.filter(item => item.prepared && item.status !== 'uploaded'))
const hasErrors = computed(() => items.value.some(item => item.status === 'error'))
const overallProgress = computed(() => {
  if (!items.value.length) return 0
  const total = items.value.reduce((sum, item) => {
    if (item.status === 'uploaded') return sum + 100
    if (item.status === 'uploading') return sum + item.uploadProgress
    return sum
  }, 0)
  return Math.round(total / items.value.length)
})

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

function loadTurnstile() {
  return new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve()
    const existing = document.querySelector<HTMLScriptElement>('script[data-sabrotto-turnstile]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Controllo anti-bot non disponibile.')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.sabrottoTurnstile = 'true'
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('Controllo anti-bot non disponibile.')), { once: true })
    document.head.appendChild(script)
  })
}

async function renderTurnstile() {
  try {
    await loadTurnstile()
    await nextTick()
    if (!window.turnstile || turnstileWidget.value) return
    turnstileWidget.value = window.turnstile.render('#photo-turnstile', {
      sitekey: String(config.public.turnstileSiteKey),
      theme: 'light',
      size: 'flexible',
      callback: authorizeGuest,
      'error-callback': () => {
        accessMessage.value = 'Il controllo anti-bot non è riuscito. Riprova.'
      },
      'expired-callback': () => {
        accessMessage.value = 'Il controllo è scaduto. Riprova.'
        window.turnstile?.reset(turnstileWidget.value)
      },
    })
  } catch (error) {
    accessState.value = 'denied'
    accessMessage.value = error instanceof Error ? error.message : 'Controllo anti-bot non disponibile.'
  }
}

async function authorizeGuest(turnstileToken: string) {
  accessMessage.value = 'Apro la missione…'
  try {
    await exchangeGuestAccess(privateAccessKey.value, turnstileToken)
    history.replaceState(null, '', `${location.pathname}${location.search}`)
    privateAccessKey.value = ''
    accessState.value = 'authorized'
  } catch (error) {
    accessMessage.value = error instanceof Error ? error.message : 'Link privato non valido.'
    window.turnstile?.reset(turnstileWidget.value)
  }
}

async function initializeAccess() {
  try {
    const session = await readPhotoSession('guest')
    if (session.authorized) {
      accessState.value = 'authorized'
      return
    }
  } catch (error) {
    if (!location.hash) {
      accessState.value = 'denied'
      accessMessage.value = error instanceof Error ? error.message : 'Servizio fotografico non disponibile.'
      return
    }
  }

  // Some static hosts normalize `/foto` to `/foto/`. Give the browser a
  // moment to restore the fragment after that redirect before rejecting it.
  if (!location.hash) await new Promise(resolve => setTimeout(resolve, 200))
  privateAccessKey.value = decodeURIComponent(location.hash.slice(1)).trim()
  if (!privateAccessKey.value) {
    accessState.value = 'denied'
    accessMessage.value = 'Apri il link privato ricevuto dagli sposi.'
    return
  }
  accessState.value = 'turnstile'
  accessMessage.value = 'Un ultimo controllo e la missione può iniziare.'
  await renderTurnstile()
}

function openLibrary() {
  selectionKind.value = 'library'
  libraryInput.value?.click()
}

function openCamera() {
  selectionKind.value = 'camera'
  cameraInput.value?.click()
}

function releaseItem(item: PhotoItem) {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
}

function clearItems() {
  items.value.forEach(releaseItem)
  items.value = []
}

async function addFiles(files: File[], kind: 'library' | 'camera') {
  if (!files.length) return
  if (kind === 'camera') clearItems()
  selectionKind.value = kind
  const capacity = kind === 'camera' ? 1 : Math.max(0, 10 - items.value.length)
  const accepted = files.slice(0, capacity)
  if (!accepted.length) return

  isPreparing.value = true
  for (const source of accepted) {
    const item: PhotoItem = {
      id: makeId(),
      sourceName: source.name,
      status: 'preparing',
      prepareProgress: 0,
      uploadProgress: 0,
    }
    items.value.push(item)
    try {
      item.prepared = await preparePhoto(source, progress => { item.prepareProgress = progress })
      item.previewUrl = URL.createObjectURL(item.prepared.file)
      item.status = 'ready'
    } catch (error) {
      item.status = 'error'
      item.error = error instanceof Error ? error.message : 'Non riesco a preparare questa foto.'
    }
  }
  isPreparing.value = false
}

async function onLibraryChange(event: Event) {
  const input = event.target as HTMLInputElement
  await addFiles(Array.from(input.files || []), 'library')
  input.value = ''
}

async function onCameraChange(event: Event) {
  const input = event.target as HTMLInputElement
  await addFiles(Array.from(input.files || []), 'camera')
  input.value = ''
}

function removeItem(id: string) {
  const item = items.value.find(candidate => candidate.id === id)
  if (item) releaseItem(item)
  items.value = items.value.filter(candidate => candidate.id !== id)
}

async function openPreview(index: number) {
  const previewable = items.value.filter(item => item.previewUrl && item.prepared)
  const selected = items.value[index]
  const startIndex = Math.max(0, previewable.findIndex(item => item.id === selected?.id))
  if (!previewable.length) return
  const { default: PhotoSwipeLightbox } = await import('photoswipe/lightbox')
  const lightbox = new PhotoSwipeLightbox({
    dataSource: previewable.map(item => ({
      src: item.previewUrl,
      width: item.prepared!.width,
      height: item.prepared!.height,
      alt: `Anteprima di ${item.sourceName}`,
    })),
    pswpModule: () => import('photoswipe'),
    bgOpacity: 0.96,
    showHideAnimationType: 'zoom',
  })
  lightbox.init()
  lightbox.loadAndOpen(startIndex)
}

async function uploadItem(item: PhotoItem) {
  if (!item.prepared) return false
  item.status = 'uploading'
  item.error = undefined
  item.uploadProgress = 0
  try {
    await uploadPreparedPhoto(item.prepared, progress => { item.uploadProgress = progress })
    item.uploadProgress = 100
    item.status = 'uploaded'
    return true
  } catch (error) {
    item.status = 'error'
    item.error = error instanceof Error ? error.message : 'Caricamento non riuscito.'
    return false
  }
}

function finishIfComplete() {
  if (items.value.length && items.value.every(item => item.status === 'uploaded')) {
    uploadedCount.value = items.value.length
    isSuccess.value = true
  }
}

async function uploadAll() {
  if (!readyItems.value.length || isUploading.value) return
  isUploading.value = true
  for (const item of items.value) {
    if (item.prepared && item.status !== 'uploaded') await uploadItem(item)
  }
  isUploading.value = false
  finishIfComplete()
}

async function retryItem(item: PhotoItem) {
  if (!item.prepared || isUploading.value) return
  isUploading.value = true
  await uploadItem(item)
  isUploading.value = false
  finishIfComplete()
}

function startAgain() {
  clearItems()
  uploadedCount.value = 0
  isSuccess.value = false
  selectionKind.value = 'library'
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (!isUploading.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  initializeAccess()
  window.addEventListener('beforeunload', beforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  clearItems()
})
</script>

<template>
  <main class="paparazzi-page">
    <div class="paparazzi-page__glow paparazzi-page__glow--one" />
    <div class="paparazzi-page__glow paparazzi-page__glow--two" />

    <section v-if="accessState !== 'authorized'" class="access-card" aria-live="polite">
      <div class="camera-mark" aria-hidden="true">
        <span class="camera-mark__lens" />
      </div>
      <p class="eyebrow">Ottavio &amp; Sabrina</p>
      <h1>Missione<br><em>Paparazzi</em></h1>
      <div v-if="accessState === 'checking'" class="loader" aria-hidden="true" />
      <p class="access-card__message">{{ accessMessage }}</p>
      <div v-if="accessState === 'turnstile'" id="photo-turnstile" class="turnstile-slot" />
      <a v-if="accessState === 'denied'" class="text-home" href="/">Torna all’invito</a>
    </section>

    <section v-else-if="isSuccess" class="mission-card mission-card--success" aria-live="polite">
      <div class="success-flash" aria-hidden="true">✦</div>
      <p class="eyebrow">Foto ricevute</p>
      <h1>Missione<br><em>compiuta!</em></h1>
      <p>
        {{ uploadedCount === 1 ? 'La tua foto è pronta per la gallery.' : `Le tue ${uploadedCount} foto sono pronte per la gallery.` }}
      </p>
      <button class="primary-action" type="button" @click="startAgain">
        <span>Carica altre foto</span>
      </button>
    </section>

    <section v-else class="mission-card">
      <header class="mission-header">
        <div class="camera-mark camera-mark--small" aria-hidden="true">
          <span class="camera-mark__lens" />
        </div>
        <div>
          <p class="eyebrow">Ottavio &amp; Sabrina</p>
          <h1>Missione <em>Paparazzi</em></h1>
        </div>
      </header>

      <template v-if="!items.length">
        <p class="mission-copy">
          Cattura sorrisi, balli e momenti memorabili. Tu scatti, noi li proiettiamo.
        </p>
        <div class="start-actions">
          <button class="primary-action" type="button" @click="openLibrary">
            <span class="action-icon" aria-hidden="true">▧</span>
            <span>Carica foto</span>
          </button>
          <button class="secondary-action" type="button" @click="openCamera">
            <span class="action-icon" aria-hidden="true">◎</span>
            <span>Scatta una foto</span>
          </button>
        </div>
        <p class="privacy-note">Le foto vengono ottimizzate sul tuo telefono e inviate alla cartella privata degli sposi.</p>
      </template>

      <template v-else>
        <div class="review-heading">
          <div>
            <p class="eyebrow">Anteprima</p>
            <h2>{{ selectionKind === 'camera' ? 'Ti piace lo scatto?' : 'La tua selezione' }}</h2>
          </div>
          <span v-if="selectionKind === 'library'" class="photo-count">{{ items.length }}/10</span>
        </div>

        <div v-if="selectionKind === 'camera'" class="camera-preview">
          <button
            v-if="items[0]?.previewUrl"
            class="camera-preview__image"
            type="button"
            aria-label="Ingrandisci la foto"
            @click="openPreview(0)"
          >
            <img :src="items[0].previewUrl" alt="Anteprima della foto appena scattata">
          </button>
          <div v-else class="preparing-card">
            <div class="loader" aria-hidden="true" />
            <span>Preparo lo scatto… {{ items[0]?.prepareProgress || 0 }}%</span>
          </div>
          <p v-if="items[0]?.error" class="item-error">{{ items[0].error }}</p>
        </div>

        <div v-else class="photo-grid">
          <article v-for="(item, index) in items" :key="item.id" class="photo-tile" :class="`photo-tile--${item.status}`">
            <button
              v-if="item.previewUrl"
              class="photo-tile__preview"
              type="button"
              :aria-label="`Ingrandisci ${item.sourceName}`"
              @click="openPreview(index)"
            >
              <img :src="item.previewUrl" :alt="`Anteprima di ${item.sourceName}`">
            </button>
            <div v-else class="photo-tile__placeholder">
              <span>{{ item.status === 'preparing' ? `${item.prepareProgress}%` : '!' }}</span>
            </div>
            <button
              v-if="!isUploading && item.status !== 'uploaded'"
              class="photo-tile__remove"
              type="button"
              :aria-label="`Rimuovi ${item.sourceName}`"
              @click="removeItem(item.id)"
            >×</button>
            <div v-if="item.status === 'uploading'" class="photo-tile__progress">
              <span :style="{ width: `${item.uploadProgress}%` }" />
            </div>
            <span v-if="item.status === 'uploaded'" class="photo-tile__done" aria-label="Caricata">✓</span>
            <p v-if="item.error" class="photo-tile__error">{{ item.error }}</p>
            <button
              v-if="item.status === 'error' && item.prepared"
              class="retry-link"
              type="button"
              @click="retryItem(item)"
            >Riprova</button>
          </article>
        </div>

        <div v-if="isUploading" class="overall-progress" aria-live="polite">
          <div><span :style="{ width: `${overallProgress}%` }" /></div>
          <p>Invio alla gallery… {{ overallProgress }}%</p>
        </div>

        <div class="review-actions">
          <template v-if="selectionKind === 'camera'">
            <button class="secondary-action" type="button" :disabled="isUploading" @click="openCamera">Scatta di nuovo</button>
            <button class="primary-action" type="button" :disabled="isPreparing || isUploading || !readyItems.length" @click="uploadAll">OK, carica</button>
          </template>
          <template v-else>
            <button v-if="items.length < 10" class="secondary-action" type="button" :disabled="isUploading" @click="openLibrary">Aggiungi foto</button>
            <button class="primary-action" type="button" :disabled="isPreparing || isUploading || !readyItems.length" @click="uploadAll">
              {{ isUploading ? 'Caricamento…' : `Carica ${readyItems.length} ${readyItems.length === 1 ? 'foto' : 'foto'}` }}
            </button>
          </template>
        </div>
        <p v-if="hasErrors && !isUploading" class="review-note">Puoi riprovare le foto non riuscite oppure rimuoverle.</p>
      </template>
    </section>

    <input ref="libraryInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp,image/avif,.heic,.heif" multiple @change="onLibraryChange">
    <input ref="cameraInput" class="visually-hidden" type="file" accept="image/*" capture="environment" @change="onCameraChange">
  </main>
</template>

<style scoped>
.paparazzi-page {
  position: relative;
  isolation: isolate;
  min-height: 100svh;
  min-width: 320px;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  color: var(--color-maiolica-blue);
  background:
    radial-gradient(circle at 15% 12%, rgba(255, 214, 101, 0.42), transparent 26rem),
    linear-gradient(145deg, #fffaf0 0%, #f3eadc 54%, #e8dfcf 100%);
}

.paparazzi-page::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -2;
  opacity: 0.16;
  background-image:
    linear-gradient(rgba(36, 56, 77, 0.2) 1px, transparent 1px),
    linear-gradient(90deg, rgba(36, 56, 77, 0.2) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(to bottom, black, transparent 75%);
}

.paparazzi-page__glow {
  position: fixed;
  z-index: -1;
  width: 15rem;
  height: 15rem;
  border: 1.7rem solid rgba(36, 56, 77, 0.06);
  border-radius: 50%;
}

.paparazzi-page__glow--one { top: -8rem; right: -6rem; }
.paparazzi-page__glow--two { bottom: -9rem; left: -7rem; }

.access-card,
.mission-card {
  width: min(100%, 43rem);
  padding: clamp(1.35rem, 5vw, 3rem);
  border: 1px solid rgba(36, 56, 77, 0.17);
  border-radius: 2rem;
  background: rgba(255, 250, 240, 0.9);
  box-shadow: 0 1.5rem 4rem rgba(36, 56, 77, 0.15), inset 0 1px rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px);
}

.access-card,
.mission-card--success { text-align: center; }

.mission-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid rgba(36, 56, 77, 0.13);
}

.eyebrow {
  margin: 0 0 0.35rem;
  color: #936d23;
  font-family: var(--font-sans);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1,
h2 { margin: 0; font-weight: 600; line-height: 0.95; }
h1 { font-size: clamp(2.75rem, 10vw, 5rem); }
.mission-header h1 { font-size: clamp(2rem, 7vw, 3.6rem); }
h1 em, h2 em { color: #a34d3e; font-weight: 500; }
h2 { font-size: clamp(2rem, 7vw, 3rem); }

.camera-mark {
  position: relative;
  width: 5.1rem;
  height: 3.8rem;
  margin: 0 auto 1.4rem;
  border: 0.25rem solid var(--color-maiolica-blue);
  border-radius: 1rem;
}

.camera-mark::before {
  content: "";
  position: absolute;
  top: -0.75rem;
  left: 0.75rem;
  width: 1.65rem;
  height: 0.65rem;
  border-radius: 0.3rem 0.3rem 0 0;
  background: var(--color-maiolica-blue);
}

.camera-mark__lens {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2rem;
  height: 2rem;
  border: 0.3rem solid var(--color-maiolica-blue);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: inset 0 0 0 0.3rem #ffc83d;
}

.camera-mark--small { flex: 0 0 auto; width: 3.8rem; height: 2.9rem; margin: 0; border-width: 0.2rem; }
.camera-mark--small::before { top: -0.55rem; width: 1.2rem; height: 0.45rem; }
.camera-mark--small .camera-mark__lens { width: 1.5rem; height: 1.5rem; border-width: 0.22rem; box-shadow: inset 0 0 0 0.2rem #ffc83d; }

.access-card__message,
.mission-copy,
.mission-card--success > p:not(.eyebrow) {
  width: min(100%, 31rem);
  margin: 1.3rem auto;
  font-family: var(--font-sans);
  font-size: 1rem;
  line-height: 1.65;
  color: var(--color-ink-muted);
}

.loader {
  width: 2.1rem;
  height: 2.1rem;
  margin: 1.5rem auto 0;
  border: 0.25rem solid rgba(36, 56, 77, 0.14);
  border-top-color: #a34d3e;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.turnstile-slot { min-height: 4.5rem; margin-top: 1rem; }
.text-home { color: var(--color-maiolica-blue); font-family: var(--font-sans); font-weight: 700; text-underline-offset: 0.3em; }

.start-actions,
.review-actions { display: grid; gap: 0.85rem; margin-top: 1.5rem; }

.primary-action,
.secondary-action {
  min-height: 3.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.8rem 1.25rem;
  border-radius: 999px;
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
}

.primary-action { border: 1px solid #d99a2b; color: var(--color-maiolica-blue); background: linear-gradient(#ffda67, #ffc83d); box-shadow: 0 0.6rem 1.3rem rgba(147, 109, 35, 0.2); }
.secondary-action { border: 1px solid rgba(36, 56, 77, 0.24); color: var(--color-maiolica-blue); background: rgba(255, 255, 255, 0.7); }
.primary-action:not(:disabled):active,
.secondary-action:not(:disabled):active { transform: scale(0.98); }
.primary-action:disabled,
.secondary-action:disabled { cursor: not-allowed; opacity: 0.5; }
.action-icon { font-size: 1.35rem; }

.privacy-note,
.review-note {
  margin: 1.2rem auto 0;
  color: var(--color-ink-muted);
  font-family: var(--font-sans);
  font-size: 0.76rem;
  line-height: 1.55;
  text-align: center;
}

.review-heading { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin: 1.6rem 0 1rem; }
.photo-count { padding: 0.35rem 0.65rem; border-radius: 999px; color: var(--color-paper); background: var(--color-maiolica-blue); font-family: var(--font-sans); font-size: 0.75rem; font-weight: 800; }

.photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.photo-tile { position: relative; min-width: 0; }
.photo-tile__preview,
.photo-tile__placeholder,
.camera-preview__image {
  width: 100%;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 1rem;
  background: #dcd4c6;
}
.photo-tile__preview,
.photo-tile__placeholder { aspect-ratio: 1; }
.photo-tile img,
.camera-preview img { width: 100%; height: 100%; object-fit: cover; }
.photo-tile__placeholder { display: grid; place-items: center; color: var(--color-maiolica-blue); font-family: var(--font-sans); font-weight: 800; }
.photo-tile__remove { position: absolute; top: 0.4rem; right: 0.4rem; width: 2rem; height: 2rem; border: 0; border-radius: 50%; color: white; background: rgba(18, 24, 31, 0.82); font-size: 1.4rem; line-height: 1; cursor: pointer; }
.photo-tile__progress { position: absolute; left: 0.5rem; right: 0.5rem; bottom: 0.5rem; height: 0.35rem; overflow: hidden; border-radius: 999px; background: rgba(255, 255, 255, 0.5); }
.photo-tile__progress span { display: block; height: 100%; background: #ffc83d; }
.photo-tile__done { position: absolute; top: 0.45rem; right: 0.45rem; width: 2rem; height: 2rem; display: grid; place-items: center; border-radius: 50%; color: white; background: #477a57; font-family: var(--font-sans); font-weight: 900; }
.photo-tile__error { margin: 0.35rem 0 0; color: #963d32; font-family: var(--font-sans); font-size: 0.68rem; line-height: 1.35; }
.retry-link { padding: 0; border: 0; color: var(--color-maiolica-blue); background: transparent; font-family: var(--font-sans); font-size: 0.76rem; font-weight: 800; text-decoration: underline; cursor: pointer; }

.camera-preview__image { aspect-ratio: 4 / 3; max-height: 54svh; cursor: zoom-in; }
.preparing-card { min-height: 14rem; display: grid; place-content: center; gap: 0.8rem; border-radius: 1rem; background: #e6ded1; color: var(--color-ink-muted); font-family: var(--font-sans); }
.preparing-card .loader { margin: 0 auto; }
.item-error { color: #963d32; font-family: var(--font-sans); text-align: center; }

.overall-progress { margin-top: 1rem; }
.overall-progress > div { height: 0.55rem; overflow: hidden; border-radius: 999px; background: rgba(36, 56, 77, 0.12); }
.overall-progress span { display: block; height: 100%; background: linear-gradient(90deg, #ffc83d, #a34d3e); transition: width 180ms ease; }
.overall-progress p { margin: 0.45rem 0 0; font-family: var(--font-sans); font-size: 0.78rem; text-align: center; }

.success-flash { color: #d99a2b; font-size: 5rem; animation: flash 900ms ease both; }
.visually-hidden { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes flash { 0% { transform: scale(0.3) rotate(-20deg); opacity: 0; } 70% { transform: scale(1.15) rotate(5deg); } 100% { transform: scale(1); opacity: 1; } }

@media (min-width: 580px) {
  .start-actions,
  .review-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .photo-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 420px) {
  .paparazzi-page { padding: 0; align-items: stretch; }
  .access-card,
  .mission-card { min-height: 100svh; display: flex; flex-direction: column; justify-content: center; border: 0; border-radius: 0; padding: max(1.35rem, env(safe-area-inset-top)) 1.15rem max(1.35rem, env(safe-area-inset-bottom)); }
  .mission-card:has(.photo-grid),
  .mission-card:has(.camera-preview) { justify-content: flex-start; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
</style>
