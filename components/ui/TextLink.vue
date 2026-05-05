<script setup lang="ts">
defineProps<{
  href: string
  label: string
}>()
</script>

<template>
  <a class="text-link" :href="href" target="_blank" rel="noopener noreferrer">
    {{ label }}
  </a>
</template>

<style scoped>
.text-link {
  color: var(--color-accent);
  font-family: var(--font-sans);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.4;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.28em;
}

.text-link:hover {
  color: var(--color-accent-deep);
}

.text-link:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 4px;
}
</style>
