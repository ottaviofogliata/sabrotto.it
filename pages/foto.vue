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
const accessMessage = ref('Verifica rapida in corso…')
const turnstileWidget = ref<string>()
const libraryInput = ref<HTMLInputElement>()
const cameraInput = ref<HTMLInputElement>()
const items = ref<PhotoItem[]>([])
const selectionKind = ref<'library' | 'camera'>('library')
const isUploading = ref(false)
const isSuccess = ref(false)
const uploadedCount = ref(0)

useSeoMeta({
  title: 'Missione Paparazzi | Ottavio e Sabrina',
  description: 'La pagina privata per condividere le foto del matrimonio di Ottavio e Sabrina.',
  robots: 'noindex, nofollow, noarchive',
})

const readyItems = computed(() => items.value.filter(item => item.prepared && item.status !== 'uploaded'))
const isPreparing = computed(() => items.value.some(item => item.status === 'preparing'))
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
    await exchangeGuestAccess(turnstileToken)
    history.replaceState(null, '', `${location.pathname}${location.search}`)
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
    accessState.value = 'denied'
    accessMessage.value = error instanceof Error ? error.message : 'Servizio fotografico non disponibile.'
    return
  }
  history.replaceState(null, '', `${location.pathname}${location.search}`)
  accessState.value = 'turnstile'
  accessMessage.value = 'Un controllo anti-bot e la missione può iniziare.'
  await renderTurnstile()
}

function openLibrary() {
  if (accessState.value !== 'authorized') return
  selectionKind.value = 'library'
  libraryInput.value?.click()
}

function openCamera() {
  if (accessState.value !== 'authorized') return
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

  // Reserve every slot immediately so overlapping picker actions cannot exceed
  // the batch limit. Each item must be reactive because preparation mutates it
  // after it has already been inserted in the selection.
  const pendingItems = accepted.map(source => ({
    source,
    item: reactive<PhotoItem>({
      id: makeId(),
      sourceName: source.name,
      status: 'preparing',
      prepareProgress: 0,
      uploadProgress: 0,
    }),
  }))
  items.value.push(...pendingItems.map(({ item }) => item))

  for (const { source, item } of pendingItems) {
    try {
      item.prepared = await preparePhoto(source, progress => { item.prepareProgress = progress })
      if (!items.value.some(candidate => candidate.id === item.id)) continue
      item.previewUrl = URL.createObjectURL(item.prepared.file)
      item.status = 'ready'
    } catch (error) {
      if (!items.value.some(candidate => candidate.id === item.id)) continue
      item.status = 'error'
      item.error = error instanceof Error ? error.message : 'Non riesco a preparare questa foto.'
    }
  }
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
    <div class="paper-shell">
      <aside class="paper-spine" aria-hidden="true">
        <span class="paper-spine__phrase">Love is the secret ingredient</span>
        <span class="paper-spine__rule" />
        <time class="paper-spine__date" datetime="2026-09-12">
          <span>12</span><span>09</span><span>26</span>
        </time>
      </aside>

      <div class="journey-panel">
        <section v-if="accessState === 'denied'" class="access-card" aria-live="polite">
          <header class="brand-lockup">
            <p class="brand-kicker">Fotochallenge</p>
            <h1>Missione Paparazzi</h1>
          </header>
          <div class="status-seal" aria-hidden="true">!</div>
          <p class="access-card__message">{{ accessMessage }}</p>
          <a class="text-home" href="/">Torna all’invito</a>
        </section>

        <section v-else-if="isSuccess" class="mission-card mission-card--success" aria-live="polite">
          <header class="brand-lockup">
            <p class="brand-kicker">Foto ricevute</p>
            <h1>Missione compiuta!</h1>
          </header>
          <div class="success-seal" aria-hidden="true">
            <svg viewBox="0 0 64 64" role="presentation">
              <circle cx="32" cy="32" r="28" />
              <path d="m19 33 8 8 18-20" />
            </svg>
          </div>
          <p class="mission-copy">
            {{ uploadedCount === 1 ? 'La tua foto è pronta per la gallery.' : `Le tue ${uploadedCount} foto sono pronte per la gallery.` }}
          </p>
          <button class="primary-action" type="button" @click="startAgain">
            <span>Carica altre foto</span>
          </button>
          <p class="projection-note">La tua missione continua: ogni momento può diventare un ricordo prezioso.</p>
        </section>

        <section v-else class="mission-card" :class="{ 'mission-card--review': items.length }">
          <header class="brand-lockup">
            <p class="brand-kicker">Fotochallenge</p>
            <h1>Missione Paparazzi</h1>
          </header>

          <template v-if="!items.length">
            <p class="mission-copy">
              Contribuisci a rendere indimenticabile questo giorno speciale e crea ricordi preziosi per gli sposi.
            </p>

            <div class="start-actions">
              <button class="primary-action" type="button" :disabled="accessState !== 'authorized'" @click="openLibrary">
                <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3v11m0-11 4 4m-4-4L8 7M5 13v6h14v-6" />
                </svg>
                <span>Carica foto</span>
              </button>
              <button class="secondary-action" type="button" :disabled="accessState !== 'authorized'" @click="openCamera">
                <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h3l1.5-2h7L17 7h3v12H4z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Scatta una foto</span>
              </button>
            </div>

            <div v-if="accessState !== 'authorized'" class="inline-verification" aria-live="polite">
              <div v-if="accessState === 'checking'" class="loader" aria-hidden="true" />
              <p>{{ accessMessage }}</p>
              <div v-if="accessState === 'turnstile'" id="photo-turnstile" class="turnstile-slot" />
            </div>

            <p class="projection-note">
              Le foto verranno proiettate durante la serata, per condividere sorrisi, emozioni e momenti indimenticabili.
            </p>
          </template>

          <template v-else>
            <div class="review-heading">
              <div>
                <p class="section-kicker">Anteprima</p>
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
      </div>
    </div>

    <input ref="libraryInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp,image/avif,.heic,.heif" multiple @change="onLibraryChange">
    <input ref="cameraInput" class="visually-hidden" type="file" accept="image/*" capture="environment" @change="onCameraChange">
  </main>
</template>

<style scoped>
.paparazzi-page {
  --photo-olive: #656a49;
  --photo-olive-light: #777d56;
  --photo-olive-dark: #505537;
  --photo-olive-deep: #343824;
  --photo-ivory: #f5f0e4;
  --photo-accent: #f1dc96;
  --photo-ink: #272a1d;
  --photo-error: #f4c6b9;
  position: relative;
  isolation: isolate;
  min-height: 100svh;
  min-width: 320px;
  display: grid;
  place-items: stretch center;
  overflow: clip;
  color: var(--photo-ivory);
  background:
    radial-gradient(circle at 50% -8rem, rgba(255, 255, 255, 0.12), transparent 28rem),
    var(--photo-olive);
}

.paparazzi-page::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -2;
  opacity: 0.09;
  background-image:
    radial-gradient(circle at 20% 25%, #fff 0 0.6px, transparent 0.8px),
    radial-gradient(circle at 75% 65%, #111 0 0.55px, transparent 0.75px);
  background-size: 6px 6px, 8px 8px;
}

.paper-shell {
  position: relative;
  width: min(100%, 36rem);
  min-height: 100svh;
  overflow: hidden;
  background: var(--photo-olive);
}

.paper-spine {
  position: absolute;
  top: max(1rem, env(safe-area-inset-top));
  right: max(1.1rem, env(safe-area-inset-right));
  left: max(1.1rem, env(safe-area-inset-left));
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: rgba(245, 240, 228, 0.8);
}

.paper-spine__phrase {
  font-family: var(--font-serif);
  font-size: 0.63rem;
  letter-spacing: 0.17em;
  text-transform: uppercase;
  white-space: nowrap;
}

.paper-spine__rule {
  height: 1px;
  flex: 1;
  background: rgba(245, 240, 228, 0.34);
}

.paper-spine__date {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-family: var(--font-serif);
  font-size: 0.78rem;
  line-height: 1;
  letter-spacing: 0.1em;
}

.paper-spine__date span:not(:last-child)::after { content: "/"; margin-left: 0.25rem; opacity: 0.55; }

.journey-panel {
  position: relative;
  min-width: 0;
  min-height: 100svh;
}

.journey-panel::before {
  content: "";
  position: absolute;
  top: 3.5rem;
  left: 50%;
  width: calc(100% - 2.2rem);
  height: 13rem;
  transform: translateX(-50%);
  border: 1px solid rgba(245, 240, 228, 0.23);
  border-bottom: 0;
  border-radius: 50% 50% 0 0;
  pointer-events: none;
}

.access-card,
.mission-card {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 100svh;
  padding: max(7.1rem, calc(env(safe-area-inset-top) + 6.2rem)) max(1.2rem, env(safe-area-inset-right)) max(2.2rem, env(safe-area-inset-bottom)) max(1.2rem, env(safe-area-inset-left));
}

.access-card,
.mission-card--success {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.mission-card--review {
  padding-top: max(6.5rem, calc(env(safe-area-inset-top) + 5.6rem));
}

.brand-lockup {
  text-align: center;
}

.brand-kicker,
.section-kicker {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.brand-lockup h1 {
  max-width: 7em;
  margin: 0.4rem auto 0;
  font-family: var(--font-script);
  font-size: clamp(3.8rem, 16.5vw, 5.6rem);
  font-weight: 400;
  line-height: 0.84;
  text-wrap: balance;
}

.mission-card--review .brand-lockup h1 {
  font-size: clamp(3.35rem, 14vw, 4.8rem);
}

.review-heading h2 {
  margin: 0.15rem 0 0;
  font-family: var(--font-serif);
  font-weight: 500;
  line-height: 0.98;
}

.review-heading h2 { font-size: clamp(2rem, 8vw, 2.8rem); }

.access-card__message,
.mission-copy,
.projection-note {
  width: min(100%, 28rem);
  margin: 1.3rem auto 0;
  font-family: var(--font-serif);
  font-size: clamp(1.05rem, 4.5vw, 1.28rem);
  line-height: 1.4;
  text-align: center;
}

.projection-note {
  margin-top: 1.5rem;
  font-size: clamp(1.08rem, 4.4vw, 1.22rem);
  font-style: normal;
  font-weight: 500;
  line-height: 1.45;
  text-align: center;
}

.status-seal {
  width: 3.9rem;
  height: 3.9rem;
  display: grid;
  place-items: center;
  margin: 2rem auto 0.4rem;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-family: var(--font-serif);
  font-size: 2rem;
}

.loader {
  width: 1.8rem;
  height: 1.8rem;
  margin: 0 auto;
  border: 0.2rem solid rgba(240, 237, 226, 0.22);
  border-top-color: var(--photo-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.turnstile-slot { min-height: 4.5rem; margin-top: 0.85rem; }
.inline-verification {
  width: min(100%, 28rem);
  margin: 1.35rem auto 0;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(245, 240, 228, 0.18);
  border-radius: 0.9rem;
  background: rgba(39, 42, 29, 0.12);
  text-align: center;
}
.inline-verification p { margin: 0.55rem 0 0; font-family: var(--font-serif); font-size: 0.9rem; }
.text-home { color: inherit; font-family: var(--font-serif); font-size: 1.05rem; font-weight: 600; text-underline-offset: 0.3em; }

.start-actions,
.review-actions {
  width: min(100%, 28rem);
  display: grid;
  gap: 0.75rem;
  margin: 1.4rem auto 0;
}

.start-actions { animation: actions-in 280ms ease both; }

.primary-action,
.secondary-action {
  min-height: 4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  padding: 0.85rem 1.15rem;
  border-radius: 1rem;
  font-family: var(--font-sans);
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, color 160ms ease;
}

.primary-action {
  border: 1px solid var(--photo-accent);
  color: var(--photo-ink);
  background: var(--photo-accent);
  box-shadow: 0 0.55rem 1.25rem rgba(28, 31, 19, 0.28), inset 0 1px rgba(255, 255, 255, 0.45);
}
.secondary-action {
  border: 1px solid var(--photo-ivory);
  color: var(--photo-olive-deep);
  background: var(--photo-ivory);
  box-shadow: 0 0.45rem 1rem rgba(28, 31, 19, 0.18), inset 0 1px rgba(255, 255, 255, 0.7);
}
.primary-action:not(:disabled):hover { background: #f8e6a6; }
.secondary-action:not(:disabled):hover { background: #fffaf0; }
.primary-action:focus-visible,
.secondary-action:focus-visible,
.photo-tile__preview:focus-visible,
.camera-preview__image:focus-visible,
.retry-link:focus-visible,
.text-home:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
.primary-action:not(:disabled):active,
.secondary-action:not(:disabled):active { transform: translateY(2px); box-shadow: none; }
.primary-action:disabled,
.secondary-action:disabled {
  border-color: rgba(245, 240, 228, 0.14);
  color: rgba(245, 240, 228, 0.38);
  background: rgba(245, 240, 228, 0.08);
  box-shadow: none;
  cursor: not-allowed;
}
.action-icon { width: 1.3rem; height: 1.3rem; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }

.review-note {
  width: min(100%, 28rem);
  margin: 1.1rem auto 0;
  color: rgba(245, 240, 228, 0.64);
  font-family: var(--font-sans);
  font-size: 0.7rem;
  line-height: 1.5;
  text-align: center;
}

.review-heading { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin: 2rem 0 1rem; padding-top: 1.2rem; border-top: 1px solid rgba(245, 240, 228, 0.18); }
.photo-count { padding: 0.4rem 0.7rem; border-radius: 999px; color: var(--photo-ink); background: var(--photo-accent); font-family: var(--font-sans); font-size: 0.7rem; font-weight: 700; }

.photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.photo-tile { position: relative; min-width: 0; }
.photo-tile__preview,
.photo-tile__placeholder,
.camera-preview__image {
  width: 100%;
  padding: 0;
  overflow: hidden;
  border: 2px solid rgba(245, 240, 228, 0.75);
  border-radius: 0.8rem;
  background: var(--photo-olive-dark);
}
.photo-tile__preview,
.photo-tile__placeholder { aspect-ratio: 1; }
.photo-tile img,
.camera-preview img { width: 100%; height: 100%; object-fit: cover; }
.photo-tile__placeholder { display: grid; place-items: center; color: var(--photo-ivory); font-family: var(--font-serif); font-weight: 700; }
.photo-tile__remove { position: absolute; top: 0.45rem; right: 0.45rem; width: 2rem; height: 2rem; border: 1px solid rgba(69, 74, 52, 0.18); border-radius: 50%; color: var(--photo-olive-deep); background: rgba(245, 240, 228, 0.96); font-size: 1.35rem; line-height: 1; cursor: pointer; box-shadow: 0 0.2rem 0.5rem rgba(28, 31, 19, 0.22); }
.photo-tile__progress { position: absolute; left: 0.5rem; right: 0.5rem; bottom: 0.5rem; height: 0.35rem; overflow: hidden; border-radius: 999px; background: rgba(255, 255, 255, 0.5); }
.photo-tile__progress span { display: block; height: 100%; background: var(--photo-ivory); }
.photo-tile__done { position: absolute; top: 0.45rem; right: 0.45rem; width: 2rem; height: 2rem; display: grid; place-items: center; border: 1px solid var(--photo-ivory); border-radius: 50%; color: var(--photo-olive-deep); background: var(--photo-ivory); font-family: var(--font-serif); font-weight: 700; }
.photo-tile__error { margin: 0.45rem 0 0; color: var(--photo-error); font-family: var(--font-serif); font-size: 0.78rem; line-height: 1.3; }
.retry-link { padding: 0; border: 0; color: var(--photo-ivory); background: transparent; font-family: var(--font-serif); font-size: 0.86rem; font-weight: 700; text-decoration: underline; text-underline-offset: 0.2em; cursor: pointer; }

.camera-preview__image { aspect-ratio: 4 / 3; max-height: 54svh; cursor: zoom-in; }
.preparing-card { min-height: 14rem; display: grid; place-content: center; gap: 0.8rem; border: 1px solid rgba(245, 240, 228, 0.25); border-radius: 0.8rem; background: var(--photo-olive-dark); color: var(--photo-ivory); font-family: var(--font-serif); }
.preparing-card .loader { margin: 0 auto; }
.item-error { color: var(--photo-error); font-family: var(--font-serif); text-align: center; }

.overall-progress { margin-top: 1rem; }
.overall-progress > div { height: 0.45rem; overflow: hidden; border-radius: 999px; background: rgba(240, 237, 226, 0.2); }
.overall-progress span { display: block; height: 100%; background: var(--photo-accent); transition: width 180ms ease; }
.overall-progress p { margin: 0.5rem 0 0; font-family: var(--font-serif); font-size: 0.88rem; text-align: center; }

.success-seal { width: 5rem; margin: 1.7rem auto 0.2rem; animation: seal-in 650ms ease both; }
.success-seal svg { width: 100%; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
.mission-card--success .primary-action { width: min(100%, 22rem); margin-top: 1.6rem; }
.visually-hidden { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes actions-in { from { transform: translateY(0.4rem); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes seal-in { 0% { transform: scale(0.6) rotate(-8deg); opacity: 0; } 70% { transform: scale(1.06) rotate(2deg); } 100% { transform: scale(1); opacity: 1; } }

@media (min-width: 600px) {
  .paparazzi-page {
    place-items: start center;
    padding: 1.25rem;
    background: #dedbd2;
  }
  .paper-shell {
    min-height: calc(100svh - 2.5rem);
    border: 1px solid rgba(39, 42, 29, 0.1);
    border-radius: 2rem;
    box-shadow: 0 1.5rem 4rem rgba(39, 42, 29, 0.2);
  }
  .journey-panel,
  .access-card,
  .mission-card { min-height: calc(100svh - 2.5rem); }
  .start-actions,
  .review-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .photo-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 370px) {
  .paper-spine__phrase { max-width: 10rem; overflow: hidden; text-overflow: ellipsis; }
  .brand-lockup h1 { font-size: 3.5rem; }
  .access-card,
  .mission-card { padding-right: 1rem; padding-left: 1rem; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
</style>
