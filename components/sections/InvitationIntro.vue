<script setup lang="ts">
import AppButton from '~/components/ui/AppButton.vue'
import SectionLabel from '~/components/ui/SectionLabel.vue'
import type { WeddingEvent } from '~/types/wedding'

defineProps<{
  event: WeddingEvent
}>()
</script>

<template>
  <section id="invito" class="intro" aria-labelledby="intro-title">
    <div class="intro__inner">
      <SectionLabel :text="event.invitation.eyebrow" />
      <h2 id="intro-title">
        {{ event.invitation.headline }}<span class="intro__heart" aria-hidden="true">♥</span>
      </h2>
      <p class="intro__deadline">
        <strong>
          Rispondi al nostro invito
          <span class="intro__deadline-date">entro il 15 luglio</span>.
        </strong>
        <span>{{ event.invitation.deadlineDetail }}</span>
      </p>
      <AppButton
        :label="event.rsvp.label"
        :aria-label="event.rsvp.ariaLabel"
        :href="event.rsvp.href"
      />
    </div>
  </section>
</template>

<style scoped>
.intro {
  padding: clamp(6rem, 12vw, 11rem) var(--page-gutter);
  background: var(--color-ivory);
}

.intro__inner {
  --intro-cta-gap: clamp(2.8rem, 5vw, 4rem);

  width: min(100%, 860px);
  margin: 0 auto;
  text-align: center;
}

.intro h2 {
  margin: 1.8rem 0 0;
  color: var(--color-ink);
  font-size: clamp(3.1rem, 7vw, 6.8rem);
  font-weight: 500;
  line-height: 1.02;
}

.intro__heart {
  display: inline-block;
  margin-left: 0.12em;
  color: #b33b2f;
  font-size: 0.56em;
  line-height: 1;
  vertical-align: 0.16em;
  transform: rotate(-9deg);
  text-shadow: 0 0.08em 0.24em rgba(179, 59, 47, 0.22);
}

.intro p {
  width: min(100%, 720px);
  margin: clamp(2rem, 5vw, 4rem) auto 0;
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: clamp(1.05rem, 1.55vw, 1.35rem);
  line-height: 1.95;
}

.intro__deadline {
  margin: var(--intro-cta-gap) auto 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-accent-deep);
}

.intro__deadline strong {
  display: block;
  font-weight: 700;
}

.intro__deadline-date {
  position: relative;
  display: inline-block;
  z-index: 0;
}

.intro__deadline-date::after {
  content: "";
  position: absolute;
  left: -0.08em;
  right: -0.08em;
  bottom: 0.1em;
  height: 0.28em;
  z-index: -1;
  background: color-mix(in srgb, var(--color-gold-soft) 82%, transparent);
  border-radius: 48% 42% 52% 38%;
  clip-path: polygon(0 52%, 8% 38%, 19% 48%, 31% 34%, 45% 45%, 58% 32%, 72% 44%, 86% 34%, 100% 48%, 100% 82%, 86% 74%, 71% 86%, 54% 76%, 38% 88%, 21% 75%, 7% 86%, 0 78%);
  transform: rotate(-1.2deg);
  opacity: 0.9;
}

.intro__deadline > span {
  display: block;
  font-weight: 400;
}

.intro .app-button {
  margin-top: var(--intro-cta-gap);
}
</style>
