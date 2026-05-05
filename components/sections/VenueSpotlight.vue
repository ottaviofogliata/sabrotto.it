<script setup lang="ts">
import SectionLabel from '~/components/ui/SectionLabel.vue'
import type { WeddingVenue } from '~/types/wedding'

defineProps<{
  venue: WeddingVenue
}>()

const tips = [
  'Anche se il 12 settembre è ancora estate, la sera può rinfrescare: porta qualcosa da mettere sulle spalle al tramonto.',
  'Saremo in masseria, quindi consigliamo tacchi comodi. Se non vuoi rinunciare ai tacchi a spillo, non preoccuparti: ti forniremo una comoda alternativa.',
  'Vi aspettiamo carichi e con la voglia di far festa: al vino e alla musica pensiamo noi! :)',
]
</script>

<template>
  <section id="consigli" class="spotlight" aria-labelledby="spotlight-title">
    <div class="spotlight__copy">
      <SectionLabel text="La festa" />
      <h2 id="spotlight-title">Consigli utili</h2>
      <ul class="spotlight__tips">
        <li v-for="tip in tips" :key="tip">{{ tip }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.spotlight {
  min-height: 86svh;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  background: linear-gradient(180deg, var(--color-sage-dark) 0%, color-mix(in srgb, var(--color-sage-dark) 88%, var(--color-ink)) 100%);
}

.spotlight__copy {
  width: min(100%, 980px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: 0 auto;
  padding: clamp(4rem, 7vw, 7rem) var(--page-gutter);
}

.spotlight h2 {
  margin: 1.5rem 0 0;
  color: var(--color-paper);
  font-size: clamp(3.5rem, 8vw, 7.5rem);
  font-weight: 500;
  line-height: 0.94;
}

.spotlight__tips {
  max-width: 42rem;
  margin: clamp(1.8rem, 4vw, 3rem) 0 0;
  padding: 0;
  list-style: none;
}

.spotlight__tips li {
  position: relative;
  padding-left: 1.6rem;
  color: color-mix(in srgb, var(--color-paper) 86%, var(--color-sage-light));
  color: color-mix(in srgb, var(--color-paper) 86%, var(--color-sage-light));
  font-family: var(--font-sans);
  font-size: clamp(1.04rem, 1.45vw, 1.28rem);
  line-height: 1.85;
}

.spotlight__tips li + li {
  margin-top: 0.95rem;
}

.spotlight__tips li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.92em;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: var(--color-gold-soft);
  transform: translateY(-50%);
}

.spotlight .section-label {
  color: color-mix(in srgb, var(--color-paper) 76%, var(--color-accent));
}

@media (max-width: 860px) {
  .spotlight {
    grid-template-columns: 1fr;
  }

  .spotlight__copy {
    min-height: 32rem;
  }
}
</style>
