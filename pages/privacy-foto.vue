<script setup lang="ts">
useSeoMeta({
  title: 'Privacy Missione Paparazzi | Ottavio e Sabrina',
  description: 'Informativa sulla raccolta privata delle fotografie del matrimonio.',
  robots: 'noindex, follow',
})
</script>

<template>
  <main class="privacy-page">
    <article class="privacy-card">
      <a class="privacy-back" href="/">← sabrotto.it</a>
      <p class="privacy-kicker">Ottavio &amp; Sabrina</p>
      <h1>Privacy<br><em>Missione Paparazzi</em></h1>

      <p class="privacy-intro">
        Questa informativa riguarda il servizio privato e facoltativo usato dagli invitati
        per condividere le fotografie del matrimonio.
      </p>

      <section>
        <h2>Dati raccolti e finalità</h2>
        <p>
          Vengono raccolte le fotografie scelte dall’ospite e i soli dati tecnici necessari
          al caricamento, come nome originale del file, formato, dimensioni, data e stato
          dell’invio. Non vengono usati per pubblicità, profilazione o vendita a terzi.
        </p>
      </section>

      <section>
        <h2>Come vengono trattate le foto</h2>
        <p>
          Le immagini vengono compresse direttamente nel browser e convertite in JPEG,
          rimuovendo i metadati EXIF, compresa l’eventuale posizione GPS. Sono poi archiviate
          in una cartella privata di Google Drive degli sposi e mostrate nella gallery privata
          dell’evento.
        </p>
      </section>

      <section>
        <h2>Servizi tecnici</h2>
        <p>
          Cloudflare Pages, Workers, D1 e Turnstile forniscono hosting, protezione anti-bot
          e il piccolo indice tecnico delle fotografie. Google Drive conserva i file nella
          cartella privata. Si applicano anche le rispettive informative di
          <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener noreferrer">Cloudflare</a>
          e <a href="https://policies.google.com/privacy" rel="noopener noreferrer">Google</a>.
        </p>
      </section>

      <section>
        <h2>Accesso, conservazione e cancellazione</h2>
        <p>
          L’accesso avviene tramite collegamenti privati. Le fotografie restano disponibili
          agli sposi per la raccolta e condivisione privata dei ricordi dell’evento e possono
          essere eliminate in qualsiasi momento. Per chiedere informazioni o la cancellazione
          di una foto, scrivi a
          <a href="mailto:ott.fogliata@gmail.com">ott.fogliata@gmail.com</a> indicando, se
          possibile, il momento del caricamento e una breve descrizione dell’immagine.
        </p>
      </section>

      <p class="privacy-updated">Ultimo aggiornamento: 31 agosto 2026</p>
    </article>
  </main>
</template>

<style scoped>
.privacy-page {
  min-height: 100svh;
  padding: clamp(1rem, 4vw, 3rem);
  color: var(--color-maiolica-blue);
  background:
    radial-gradient(circle at 12% 8%, rgba(255, 210, 91, 0.28), transparent 28rem),
    #f5eee2;
}

.privacy-card {
  width: min(100%, 48rem);
  margin: 0 auto;
  padding: clamp(1.4rem, 5vw, 4rem);
  border: 1px solid rgba(36, 56, 77, 0.14);
  border-radius: 2rem;
  background: rgba(255, 250, 240, 0.92);
  box-shadow: 0 1.5rem 4rem rgba(36, 56, 77, 0.1);
}

.privacy-back,
.privacy-card a {
  color: #8b3f35;
  font-family: var(--font-sans);
  font-weight: 700;
  text-underline-offset: 0.22em;
}

.privacy-kicker {
  margin: 2.5rem 0 0.55rem;
  color: #936d23;
  font-family: var(--font-sans);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(2.7rem, 9vw, 5rem);
  font-weight: 600;
  line-height: 0.95;
}

h1 em { color: #a34d3e; font-weight: 500; }

.privacy-intro {
  margin: 1.8rem 0 2.5rem;
  color: var(--color-ink-muted);
  font-family: var(--font-sans);
  font-size: 1.05rem;
  line-height: 1.7;
}

section {
  padding: 1.35rem 0;
  border-top: 1px solid rgba(36, 56, 77, 0.12);
}

h2 { margin: 0 0 0.65rem; font-size: clamp(1.35rem, 4vw, 1.8rem); }
section p {
  margin: 0;
  color: var(--color-ink-muted);
  font-family: var(--font-sans);
  line-height: 1.75;
}

.privacy-updated {
  margin: 2rem 0 0;
  color: rgba(36, 56, 77, 0.55);
  font-family: var(--font-sans);
  font-size: 0.75rem;
}

@media (max-width: 520px) {
  .privacy-page { padding: 0; }
  .privacy-card { min-height: 100svh; border: 0; border-radius: 0; }
}
</style>
