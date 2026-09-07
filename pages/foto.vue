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
const challengeIdeas = [
  'Una foto con gli sposi',
  'Una foto di gruppo del tuo tavolo',
  'Un brindisi',
  'Un abbraccio',
  'Una risata',
  'Un selfie',
  'Qualcuno che canta',
  'Un bacio degli sposi',
  'Un bacio agli sposi',
  'La sposa con le sue testimoni',
  'Lo sposo con i suoi testimoni',
  'Dai sfogo alla tua creatività',
]

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

            <section class="challenge-board" aria-labelledby="challenge-title">
              <p class="challenge-board__eyebrow">Lasciati ispirare</p>
              <h2 id="challenge-title">La lista della missione</h2>
              <ul>
                <li v-for="idea in challengeIdeas" :key="idea">{{ idea }}</li>
              </ul>
            </section>

            <p class="projection-note">
              Le foto verranno proiettate durante la serata, per condividere sorrisi, emozioni e momenti indimenticabili.
            </p>
            <p class="privacy-note">Le immagini vengono ottimizzate sul tuo telefono e inviate alla cartella privata degli sposi.</p>
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
  --photo-olive: #65694a;
  --photo-olive-dark: #54583d;
  --photo-olive-deep: #454a34;
  --photo-ivory: #f0ede2;
  --photo-paper: #e7e3d9;
  --photo-ink: #252820;
  --photo-error: #f4c6b9;
  position: relative;
  isolation: isolate;
  min-height: 100svh;
  min-width: 320px;
  display: grid;
  place-items: start center;
  overflow: clip;
  padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
  color: var(--photo-ivory);
  background:
    radial-gradient(circle at 14% 8%, rgba(255, 255, 255, 0.5), transparent 26rem),
    linear-gradient(145deg, #ddd9d2 0%, #cec9c1 100%);
}

.paparazzi-page::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -2;
  opacity: 0.22;
  background-image:
    repeating-linear-gradient(15deg, rgba(255, 255, 255, 0.16) 0 1px, transparent 1px 5px),
    repeating-linear-gradient(105deg, rgba(55, 54, 47, 0.06) 0 1px, transparent 1px 7px);
}

.paper-shell {
  width: min(100%, 46rem);
  min-height: calc(100svh - max(1.5rem, env(safe-area-inset-top) + env(safe-area-inset-bottom)));
  display: grid;
  grid-template-columns: clamp(3.25rem, 10vw, 5.5rem) minmax(0, 1fr);
  gap: clamp(0.5rem, 1.7vw, 0.9rem);
  padding: 0.85rem 0.85rem 0.85rem 0;
  border: 1px solid rgba(52, 54, 45, 0.1);
  border-radius: 22rem 22rem 1.4rem 1.4rem;
  background: var(--photo-paper);
  box-shadow: 0 1.5rem 4rem rgba(46, 45, 40, 0.24), inset 0 1px rgba(255, 255, 255, 0.75);
}

.paper-spine {
  min-height: 38rem;
  display: grid;
  grid-template-rows: auto minmax(4rem, 1fr) auto;
  justify-items: center;
  gap: 1rem;
  padding: clamp(4rem, 12vw, 7rem) 0 1.1rem;
  color: var(--photo-ink);
}

.paper-spine__phrase {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-family: var(--font-serif);
  font-size: clamp(0.56rem, 1.8vw, 0.73rem);
  letter-spacing: 0.19em;
  text-transform: uppercase;
  white-space: nowrap;
}

.paper-spine__rule {
  width: 1px;
  min-height: 5rem;
  background: currentColor;
}

.paper-spine__date {
  display: grid;
  gap: 0.34rem;
  font-family: var(--font-serif);
  font-size: clamp(1.15rem, 4vw, 1.65rem);
  line-height: 1;
  letter-spacing: 0.08em;
}

.journey-panel {
  position: relative;
  min-width: 0;
  min-height: calc(100% - clamp(3.25rem, 10vw, 5rem));
  margin-top: clamp(3.25rem, 10vw, 5rem);
  overflow: hidden;
  border-radius: 18rem 18rem 0.72rem 0.72rem;
  background: var(--photo-olive);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.12);
}

.journey-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.17;
  background-image:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.18) 0 0.7px, transparent 0.9px),
    radial-gradient(circle at 75% 65%, rgba(0, 0, 0, 0.16) 0 0.6px, transparent 0.8px);
  background-size: 5px 5px, 7px 7px;
}

.access-card,
.mission-card {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 100%;
  padding: clamp(5rem, 18vw, 8.5rem) clamp(1.15rem, 5.5vw, 3.4rem) clamp(2rem, 6vw, 3.4rem);
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
  padding-top: clamp(4.4rem, 15vw, 7.2rem);
}

.brand-lockup {
  text-align: center;
}

.brand-kicker,
.section-kicker,
.challenge-board__eyebrow {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(0.72rem, 2.4vw, 0.93rem);
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.brand-lockup h1 {
  max-width: 10em;
  margin: 0.35rem auto 0;
  font-family: var(--font-script);
  font-size: clamp(3.25rem, 13vw, 6.25rem);
  font-weight: 400;
  line-height: 0.88;
}

.mission-card--review .brand-lockup h1 {
  font-size: clamp(2.75rem, 10vw, 5rem);
}

.review-heading h2,
.challenge-board h2 {
  margin: 0.15rem 0 0;
  font-family: var(--font-serif);
  font-weight: 500;
  line-height: 0.98;
}

.review-heading h2 { font-size: clamp(2rem, 7.5vw, 3.25rem); }
.challenge-board h2 { font-size: clamp(1.7rem, 6vw, 2.5rem); }

.access-card__message,
.mission-copy,
.projection-note {
  width: min(100%, 31rem);
  margin: 1.35rem auto 0;
  font-family: var(--font-serif);
  font-size: clamp(1.05rem, 3.7vw, 1.32rem);
  line-height: 1.35;
  text-align: center;
}

.projection-note {
  margin-top: 2rem;
  font-style: italic;
  font-weight: 600;
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
  width: 2.1rem;
  height: 2.1rem;
  margin: 1.5rem auto 0;
  border: 0.2rem solid rgba(240, 237, 226, 0.22);
  border-top-color: var(--photo-ivory);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.turnstile-slot { min-height: 4.5rem; margin-top: 1rem; }
.inline-verification { margin: 1.2rem -0.2rem 0; text-align: center; }
.inline-verification .loader { margin-top: 0.8rem; }
.inline-verification p { margin: 0.8rem 0 0; font-family: var(--font-serif); font-size: 0.95rem; }
.text-home { color: inherit; font-family: var(--font-serif); font-size: 1.05rem; font-weight: 600; text-underline-offset: 0.3em; }

.start-actions,
.review-actions { display: grid; gap: 0.75rem; margin-top: 1.45rem; }

.primary-action,
.secondary-action {
  min-height: 3.65rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  padding: 0.75rem 1.15rem;
  border-radius: 999px;
  font-family: var(--font-serif);
  font-size: 1.08rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: transform 160ms ease, background 160ms ease, color 160ms ease, opacity 160ms ease;
}

.primary-action { border: 1px solid var(--photo-ivory); color: var(--photo-olive-deep); background: var(--photo-ivory); }
.secondary-action { border: 1px solid rgba(240, 237, 226, 0.72); color: var(--photo-ivory); background: transparent; }
.primary-action:focus-visible,
.secondary-action:focus-visible,
.photo-tile__preview:focus-visible,
.camera-preview__image:focus-visible,
.retry-link:focus-visible,
.text-home:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
.primary-action:not(:disabled):active,
.secondary-action:not(:disabled):active { transform: scale(0.98); }
.primary-action:disabled,
.secondary-action:disabled { cursor: not-allowed; opacity: 0.5; }
.action-icon { width: 1.3rem; height: 1.3rem; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }

.privacy-note,
.review-note {
  margin: 1.2rem auto 0;
  color: rgba(240, 237, 226, 0.75);
  font-family: var(--font-serif);
  font-size: 0.83rem;
  line-height: 1.45;
  text-align: center;
}

.challenge-board {
  margin-top: 2.2rem;
  padding: 1.5rem 0 0;
  border-top: 1px solid rgba(240, 237, 226, 0.35);
  text-align: center;
}

.challenge-board ul {
  width: min(100%, 27rem);
  margin: 1.1rem auto 0;
  padding: 0;
  list-style: none;
  text-align: left;
}

.challenge-board li {
  position: relative;
  padding-left: 1.1rem;
  font-family: var(--font-serif);
  font-size: clamp(0.98rem, 3.5vw, 1.14rem);
  line-height: 1.42;
}

.challenge-board li::before {
  content: "·";
  position: absolute;
  left: 0.2rem;
  font-weight: 700;
}

.review-heading { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin: 2rem 0 1rem; padding-top: 1.4rem; border-top: 1px solid rgba(240, 237, 226, 0.35); }
.photo-count { padding: 0.35rem 0.7rem; border: 1px solid rgba(240, 237, 226, 0.7); border-radius: 999px; color: var(--photo-ivory); font-family: var(--font-serif); font-size: 0.82rem; font-weight: 700; }

.photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.photo-tile { position: relative; min-width: 0; }
.photo-tile__preview,
.photo-tile__placeholder,
.camera-preview__image {
  width: 100%;
  padding: 0;
  overflow: hidden;
  border: 3px solid var(--photo-ivory);
  border-radius: 0.5rem;
  background: var(--photo-olive-dark);
}
.photo-tile__preview,
.photo-tile__placeholder { aspect-ratio: 1; }
.photo-tile img,
.camera-preview img { width: 100%; height: 100%; object-fit: cover; }
.photo-tile__placeholder { display: grid; place-items: center; color: var(--photo-ivory); font-family: var(--font-serif); font-weight: 700; }
.photo-tile__remove { position: absolute; top: 0.45rem; right: 0.45rem; width: 2rem; height: 2rem; border: 1px solid rgba(69, 74, 52, 0.18); border-radius: 50%; color: var(--photo-olive-deep); background: rgba(240, 237, 226, 0.95); font-size: 1.35rem; line-height: 1; cursor: pointer; }
.photo-tile__progress { position: absolute; left: 0.5rem; right: 0.5rem; bottom: 0.5rem; height: 0.35rem; overflow: hidden; border-radius: 999px; background: rgba(255, 255, 255, 0.5); }
.photo-tile__progress span { display: block; height: 100%; background: var(--photo-ivory); }
.photo-tile__done { position: absolute; top: 0.45rem; right: 0.45rem; width: 2rem; height: 2rem; display: grid; place-items: center; border: 1px solid var(--photo-ivory); border-radius: 50%; color: var(--photo-olive-deep); background: var(--photo-ivory); font-family: var(--font-serif); font-weight: 700; }
.photo-tile__error { margin: 0.45rem 0 0; color: var(--photo-error); font-family: var(--font-serif); font-size: 0.78rem; line-height: 1.3; }
.retry-link { padding: 0; border: 0; color: var(--photo-ivory); background: transparent; font-family: var(--font-serif); font-size: 0.86rem; font-weight: 700; text-decoration: underline; text-underline-offset: 0.2em; cursor: pointer; }

.camera-preview__image { aspect-ratio: 4 / 3; max-height: 54svh; cursor: zoom-in; }
.preparing-card { min-height: 14rem; display: grid; place-content: center; gap: 0.8rem; border: 1px solid rgba(240, 237, 226, 0.4); border-radius: 0.5rem; background: var(--photo-olive-dark); color: var(--photo-ivory); font-family: var(--font-serif); }
.preparing-card .loader { margin: 0 auto; }
.item-error { color: var(--photo-error); font-family: var(--font-serif); text-align: center; }

.overall-progress { margin-top: 1rem; }
.overall-progress > div { height: 0.45rem; overflow: hidden; border-radius: 999px; background: rgba(240, 237, 226, 0.2); }
.overall-progress span { display: block; height: 100%; background: var(--photo-ivory); transition: width 180ms ease; }
.overall-progress p { margin: 0.5rem 0 0; font-family: var(--font-serif); font-size: 0.88rem; text-align: center; }

.success-seal { width: 5rem; margin: 1.7rem auto 0.2rem; animation: seal-in 650ms ease both; }
.success-seal svg { width: 100%; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
.mission-card--success .primary-action { width: min(100%, 22rem); margin-top: 1.6rem; }
.visually-hidden { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes seal-in { 0% { transform: scale(0.6) rotate(-8deg); opacity: 0; } 70% { transform: scale(1.06) rotate(2deg); } 100% { transform: scale(1); opacity: 1; } }

@media (min-width: 580px) {
  .start-actions,
  .review-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .photo-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .challenge-board ul { columns: 2; column-gap: 2rem; }
  .challenge-board li { break-inside: avoid; }
}

@media (max-width: 420px) {
  .paparazzi-page { padding: 0.45rem; }
  .paper-shell { grid-template-columns: 2.8rem minmax(0, 1fr); gap: 0.35rem; padding: 0.5rem 0.5rem 0.5rem 0; border-radius: 14rem 14rem 0.9rem 0.9rem; }
  .paper-spine { padding-top: 4.25rem; }
  .journey-panel { margin-top: 3.25rem; border-radius: 12rem 12rem 0.48rem 0.48rem; }
  .access-card,
  .mission-card { padding-right: 1rem; padding-left: 1rem; }
  .mission-card--review { padding-top: 4.1rem; }
}

@media (max-width: 350px) {
  .paper-shell { grid-template-columns: 2.35rem minmax(0, 1fr); }
  .paper-spine__phrase { font-size: 0.5rem; letter-spacing: 0.13em; }
  .brand-lockup h1 { font-size: 2.9rem; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
</style>
