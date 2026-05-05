<script setup lang="ts">
import WeddingSeal from '~/components/art/WeddingSeal.vue'
import AppButton from '~/components/ui/AppButton.vue'
import type { WeddingEvent } from '~/types/wedding'

defineProps<{
  event: WeddingEvent
}>()
</script>

<template>
  <section id="home" class="hero" aria-labelledby="hero-title">
    <div class="hero__content">
      <WeddingSeal class="hero__seal" />
      <h1 id="hero-title">
        <span>{{ event.couple.groom.firstName }}</span>
        <span class="hero__amp">&amp;</span>
        <span>{{ event.couple.bride.firstName }}</span>
      </h1>
      <p class="hero__date">{{ event.date.display }}</p>
      <!--
      <div class="hero__actions">
        <AppButton
          :label="event.rsvp.label"
          :aria-label="event.rsvp.ariaLabel"
          :href="event.rsvp.href"
        />
        <AppButton
          :label="event.minigame.label"
          :aria-label="event.minigame.ariaLabel"
          :href="event.minigame.href"
          variant="secondary"
        />
      </div>
      -->
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 100svh;
  overflow: hidden;
  padding: clamp(1.1rem, 3vw, 2.6rem);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-paper) 28%, transparent) 0%, color-mix(in srgb, var(--color-paper) 22%, transparent) 100%),
    radial-gradient(ellipse 42% 26% at 50% 33%, color-mix(in srgb, var(--color-paper) 78%, transparent) 0%, color-mix(in srgb, var(--color-paper) 46%, transparent) 38%, color-mix(in srgb, var(--color-paper) 12%, transparent) 68%, transparent 84%),
    url("/images/hero-masseria-luco-watercolor-v3.png") center 62% / cover no-repeat,
    var(--color-ivory);
  isolation: isolate;
}

.hero::before {
  content: "";
  position: absolute;
  inset: clamp(0.7rem, 1.4vw, 1.4rem);
  border: 1px solid color-mix(in srgb, var(--color-sage) 28%, transparent);
  pointer-events: none;
  z-index: 2;
}

.hero__content {
  position: relative;
  width: min(100%, 980px);
  min-height: calc(100svh - clamp(2.2rem, 4vw, 5.2rem));
  margin: 0 auto;
  padding-bottom: clamp(1.8rem, 5svh, 3.6rem);
  text-align: center;
  z-index: 1;
}

.hero__seal {
  position: absolute;
  left: 50%;
  bottom: calc(50% + clamp(4.8rem, 8.3vw, 7.7rem));
  transform: translateX(-50%);
  width: clamp(8.8rem, 16vw, 13rem);
  opacity: 0.58;
  filter: contrast(1.02);
}

.hero__content h1 {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100%;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: baseline;
  transform: translate(-50%, -50%);
  gap: 0.03em;
  color: var(--color-maiolica-blue);
  font-family: var(--font-serif);
  font-size: clamp(4.3rem, 10vw, 8.5rem);
  font-weight: 600;
  line-height: 0.9;
  letter-spacing: 0;
  text-shadow: 0 0.06em 0.18em color-mix(in srgb, var(--color-paper) 38%, transparent);
}

.hero__amp {
  color: color-mix(in srgb, var(--color-maiolica-blue) 42%, var(--color-paper));
  font-weight: 400;
  opacity: 0.82;
}

.hero__date {
  position: absolute;
  left: 50%;
  top: calc(50% + clamp(2.7rem, 5.5vw, 4.8rem));
  width: 100%;
  margin: 0;
  transform: translateX(-50%);
  color: color-mix(in srgb, var(--color-maiolica-blue) 68%, #686a64);
  font-family: var(--font-serif);
  font-size: clamp(1.8rem, 4vw, 3rem);
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0;
  text-shadow: 0 0.06em 0.18em color-mix(in srgb, var(--color-paper) 42%, transparent);
}

.hero__actions {
  position: absolute;
  left: 50%;
  bottom: 0;
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  transform: translateX(-50%);
  gap: clamp(0.8rem, 1.8vw, 1.2rem);
  width: min(100%, 44rem);
}

::v-deep(.hero__actions .app-button) {
  flex: 0 0 clamp(10.5rem, 14vw, 12.5rem);
  min-width: clamp(10.5rem, 14vw, 12.5rem);
}

@media (max-width: 760px) {
  .hero {
    min-height: 100svh;
    padding: 1rem;
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--color-paper) 34%, transparent) 0%, color-mix(in srgb, var(--color-paper) 22%, transparent) 100%),
      radial-gradient(ellipse 84% 34% at 50% 34%, color-mix(in srgb, var(--color-paper) 82%, transparent) 0%, color-mix(in srgb, var(--color-paper) 48%, transparent) 42%, color-mix(in srgb, var(--color-paper) 14%, transparent) 72%, transparent 88%),
      url("/images/hero-masseria-luco-watercolor-v3.png") center 72% / cover no-repeat,
      var(--color-ivory);
  }

  .hero__content {
    min-height: calc(100svh - 2rem);
    padding-bottom: clamp(2rem, 6svh, 3rem);
  }

  .hero__seal {
    bottom: calc(50% + clamp(4.2rem, 15vw, 6.2rem));
    width: clamp(7rem, 26vw, 9.2rem);
  }

  .hero__content h1 {
    font-size: clamp(2.75rem, 12vw, 4.4rem);
    line-height: 0.95;
  }

  .hero__date {
    top: calc(50% + clamp(2.7rem, 11vw, 3.8rem));
  }

  .hero__actions {
    width: min(100%, 38rem);
  }

  ::v-deep(.hero__actions .app-button) {
    flex-basis: clamp(9.5rem, 28vw, 12rem);
    min-width: clamp(9.5rem, 28vw, 12rem);
  }
}

@media (max-width: 520px) {
  .hero__actions {
    flex-direction: column;
    width: min(100%, 22rem);
  }
}
</style>
