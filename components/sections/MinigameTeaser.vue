<script setup lang="ts">
import AppButton from '~/components/ui/AppButton.vue'
import type { WeddingEvent } from '~/types/wedding'

defineProps<{
  event: WeddingEvent
}>()
</script>

<template>
  <section id="minigame" class="minigame-teaser" aria-labelledby="minigame-title">
    <div class="minigame-teaser__panel">
      <p class="minigame-teaser__eyebrow">Bonus level</p>
      <h2 id="minigame-title">Gioca a Sabrotto 16bit!</h2>
      <p class="minigame-teaser__copy">
        Sfida gli altri invitati, scala la classifica e arriva alla festa
        già in modalità campione.
      </p>
      <AppButton
        :label="event.minigame.label"
        :aria-label="event.minigame.ariaLabel"
        :href="event.minigame.href"
        variant="secondary"
      />
      <a
        class="minigame-teaser__leaderboard-link"
        href="/minigame/leaderboard.html"
        aria-label="Apri la classifica top 50 del minigioco"
      >
        Top 50 del gioco
      </a>
    </div>
  </section>
</template>

<style scoped>
.minigame-teaser {
  position: relative;
  overflow: hidden;
  padding: clamp(5rem, 10vw, 9rem) var(--page-gutter);
  background:
    linear-gradient(90deg, rgba(255, 248, 237, 0.06) 1px, transparent 1px),
    linear-gradient(180deg, rgba(255, 248, 237, 0.06) 1px, transparent 1px),
    linear-gradient(180deg, rgba(23, 32, 39, 0.22) 0%, rgba(22, 33, 35, 0.28) 52%, rgba(24, 42, 31, 0.5) 100%),
    url("/images/minigame-trulli-sunrise-16bit.png");
  background-size:
    18px 18px,
    18px 18px,
    auto,
    cover;
  background-position:
    0 0,
    0 0,
    center,
    center;
  color: var(--color-paper);
}

.minigame-teaser::before,
.minigame-teaser::after {
  content: "";
  position: absolute;
  width: 7rem;
  height: 7rem;
  border: 0.8rem solid rgba(255, 248, 237, 0.12);
  image-rendering: pixelated;
}

.minigame-teaser::before {
  top: 2rem;
  left: clamp(1rem, 6vw, 5rem);
  clip-path: polygon(0 0, 100% 0, 100% 28%, 28% 28%, 28% 100%, 0 100%);
}

.minigame-teaser::after {
  right: clamp(1rem, 6vw, 5rem);
  bottom: 2rem;
  clip-path: polygon(72% 0, 100% 0, 100% 100%, 0 100%, 0 72%, 72% 72%);
}

.minigame-teaser__panel {
  position: relative;
  z-index: 2;
  width: min(100%, 780px);
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 4rem);
  border: 3px solid rgba(255, 248, 237, 0.72);
  background:
    linear-gradient(135deg, rgba(255, 248, 237, 0.12), rgba(255, 248, 237, 0.04)),
    rgba(23, 20, 15, 0.18);
  box-shadow:
    0.55rem 0.55rem 0 rgba(0, 0, 0, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  text-align: center;
}

.minigame-teaser__eyebrow {
  margin: 0 0 1.2rem;
  color: var(--color-gold-soft);
  font-family: var(--font-pixel);
  font-size: clamp(0.62rem, 1vw, 0.78rem);
  letter-spacing: 0.08em;
  line-height: 1.8;
  text-transform: uppercase;
}

.minigame-teaser h2 {
  margin: 0;
  color: var(--color-paper);
  font-family: var(--font-pixel);
  font-size: clamp(1.35rem, 4.2vw, 3rem);
  font-weight: 400;
  line-height: 1.45;
  text-shadow:
    0.1em 0.1em 0 rgba(0, 0, 0, 0.24),
    -0.05em 0.05em 0 rgba(74, 164, 232, 0.28);
}

.minigame-teaser__copy {
  width: min(100%, 36rem);
  margin: clamp(1.4rem, 3vw, 2rem) auto 0;
  color: color-mix(in srgb, var(--color-paper) 86%, var(--color-sage-light));
  font-family: var(--font-sans);
  font-size: clamp(1rem, 1.35vw, 1.2rem);
  line-height: 1.8;
}

.minigame-teaser .app-button {
  display: flex;
  width: fit-content;
  margin: clamp(1.6rem, 3.4vw, 2.4rem) auto 0;
  min-height: 3.35rem;
  padding: 0 clamp(1.35rem, 3vw, 2.2rem);
  border: 0;
  border-radius: 0;
  clip-path: polygon(0 10px, 10px 10px, 10px 0, calc(100% - 10px) 0, calc(100% - 10px) 10px, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 10px calc(100% - 10px), 0 calc(100% - 10px));
  color: #172433;
  background: #ffc83d;
  font-family: var(--font-pixel);
  font-size: clamp(0.68rem, 0.92vw, 0.82rem);
  font-weight: 400;
  letter-spacing: 0.07em;
  line-height: 1.5;
  image-rendering: pixelated;
  text-shadow: 2px 2px 0 rgba(255, 244, 159, 0.8);
  box-shadow:
    0 0 0 4px #253849,
    0 0 0 7px #fff4bd,
    8px 8px 0 rgba(18, 25, 36, 0.5),
    inset 5px 5px 0 #ffe875,
    inset -5px -5px 0 #e56f2f;
}

.minigame-teaser .app-button:hover {
  color: #172433;
  background: #ffdf45;
  transform: translate(2px, 2px);
  border-color: transparent;
  box-shadow:
    0 0 0 4px #253849,
    0 0 0 7px #fff4bd,
    5px 5px 0 rgba(18, 25, 36, 0.5),
    inset 5px 5px 0 #fff08a,
    inset -5px -5px 0 #ef7d32;
}

.minigame-teaser__leaderboard-link {
  display: block;
  width: fit-content;
  margin: clamp(1rem, 2vw, 1.35rem) auto 0;
  color: color-mix(in srgb, var(--color-paper) 88%, var(--color-gold-soft));
  font-family: var(--font-sans);
  font-size: clamp(0.88rem, 1vw, 0.98rem);
  font-weight: 700;
  letter-spacing: 0.12em;
  line-height: 1.4;
  text-transform: uppercase;
  text-underline-offset: 0.35em;
}

.minigame-teaser__leaderboard-link:hover {
  color: var(--color-paper);
}
</style>
