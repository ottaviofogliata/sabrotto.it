<script setup lang="ts">
import WeddingSeal from '~/components/art/WeddingSeal.vue'
import type { WeddingEvent } from '~/types/wedding'

defineProps<{
  event: WeddingEvent
}>()
</script>

<template>
  <section id="conferma" class="final-cta" aria-labelledby="final-quote">
    <WeddingSeal class="final-cta__seal" />
    <p id="final-quote" class="final-cta__quote">
      Just as long as you stand, stand by me <span>&hearts;</span>
    </p>
  </section>
</template>

<style scoped>
.final-cta {
  position: relative;
  overflow: hidden;
  min-height: 100svh;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto minmax(0, 1fr);
  justify-items: center;
  align-items: center;
  gap: clamp(2.2rem, 5vw, 4rem);
  padding: clamp(5rem, 10vw, 9rem) var(--page-gutter) clamp(3rem, 7svh, 5rem);
  text-align: center;
  background:
    linear-gradient(180deg, rgba(255, 248, 237, 0.7) 0%, rgba(255, 248, 237, 0.34) 48%, rgba(247, 240, 230, 0.62) 100%),
    radial-gradient(ellipse at 50% 38%, rgba(255, 248, 237, 0.76) 0%, rgba(255, 248, 237, 0.38) 40%, transparent 68%),
    url("/images/hero-masseria-luco-watercolor.png") center 70% / cover no-repeat,
    var(--color-ivory);
  isolation: isolate;
}

.final-cta::before {
  content: "";
  position: absolute;
  inset: clamp(0.7rem, 1.4vw, 1.4rem);
  border: 1px solid color-mix(in srgb, var(--color-accent) 32%, transparent);
  pointer-events: none;
  z-index: 0;
}

.final-cta > * {
  position: relative;
  z-index: 1;
}

.final-cta__seal {
  grid-row: 2;
  width: clamp(9rem, 21vw, 15rem);
  opacity: 0.88;
}

.final-cta__quote {
  grid-row: 3;
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-serif);
  font-size: clamp(2.2rem, 5vw, 4.8rem);
  font-style: italic;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: 0;
  text-wrap: balance;
  text-shadow: 0 0.08em 0.18em rgba(255, 248, 237, 0.76);
}

.final-cta__quote span {
  color: #b5161d;
}
</style>
