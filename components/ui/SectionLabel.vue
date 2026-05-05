<script setup lang="ts">
defineProps<{
  text: string
  tone?: 'dark' | 'accent'
}>()
</script>

<template>
  <p class="section-label" :class="`section-label--${tone ?? 'dark'}`">
    {{ text }}
  </p>
</template>

<style scoped>
.section-label {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1.4;
  text-transform: uppercase;
}

.section-label--dark {
  color: var(--color-ink-muted);
}

.section-label--accent {
  color: var(--color-accent);
}
</style>
