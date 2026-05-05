<script setup lang="ts">
import WeddingSeal from '~/components/art/WeddingSeal.vue'
import AppButton from '~/components/ui/AppButton.vue'
import SectionLabel from '~/components/ui/SectionLabel.vue'
import type { WeddingEvent } from '~/types/wedding'

defineProps<{
  event: WeddingEvent
}>()
</script>

<template>
  <section id="conferma" class="final-cta" aria-labelledby="final-title">
    <WeddingSeal class="final-cta__seal" />
    <p class="final-cta__quote">Just as long as you stand, stand by me &hearts;</p>
    <SectionLabel text="Vi aspettiamo!" tone="accent" />
    <h2 id="final-title">
      <span>{{ event.couple.groom.firstName }}</span>
      <em>&amp;</em>
      <span>{{ event.couple.bride.firstName }}</span>
    </h2>
    <p class="final-cta__date">{{ event.date.display }} alle {{ event.date.time }}</p>
    <AppButton
      :label="event.rsvp.label"
      :aria-label="event.rsvp.ariaLabel"
      :href="event.rsvp.href"
    />
  </section>
</template>

<style scoped>
.final-cta {
  position: relative;
  overflow: hidden;
  min-height: 100svh;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto auto auto auto minmax(0, 1fr) auto;
  justify-items: center;
  gap: 1.4rem;
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
  width: clamp(6rem, 14vw, 10rem);
  margin-bottom: 0.6rem;
  opacity: 0.88;
}

.final-cta :deep(.section-label) {
  grid-row: 4;
}

.final-cta h2 {
  grid-row: 5;
  margin: 0;
  display: grid;
  gap: 0;
  color: var(--color-maiolica-blue);
  font-family: var(--font-script);
  font-size: clamp(5rem, 11vw, 10rem);
  font-weight: 400;
  line-height: 0.78;
  text-shadow: 0 0.06em 0.22em rgba(255, 248, 237, 0.62);
}

.final-cta h2 em {
  color: var(--color-accent-deep);
  font-size: 0.36em;
  font-style: normal;
  line-height: 0.8;
}

.final-cta__quote {
  grid-row: 3;
  max-width: min(38rem, 82vw);
  margin: 0;
  color: var(--color-accent-deep);
  font-family: var(--font-serif);
  font-size: clamp(1.55rem, 3vw, 2.45rem);
  font-style: italic;
  line-height: 1.35;
  text-wrap: balance;
  text-shadow: 0 0.08em 0.18em rgba(255, 248, 237, 0.76);
}

.final-cta__date {
  grid-row: 6;
  margin: 0 0 1.2rem;
  color: var(--color-maiolica-blue);
  font-family: var(--font-sans);
  font-size: clamp(1rem, 1.6vw, 1.25rem);
  line-height: 1.6;
  text-shadow: 0 0.08em 0.18em rgba(255, 248, 237, 0.76);
}

.final-cta .app-button {
  grid-row: 8;
  align-self: end;
}
</style>
