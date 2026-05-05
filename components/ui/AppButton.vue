<script setup lang="ts">
defineProps<{
  label: string
  ariaLabel?: string
  href?: string
  variant?: 'primary' | 'secondary' | 'ghost'
}>()
</script>

<template>
  <a
    v-if="href"
    class="app-button"
    :class="`app-button--${variant ?? 'primary'}`"
    :href="href"
    :aria-label="ariaLabel ?? label"
    :target="href?.startsWith('http') ? '_blank' : undefined"
    :rel="href?.startsWith('http') ? 'noopener noreferrer' : undefined"
  >
    <span>{{ label }}</span>
  </a>
  <button
    v-else
    class="app-button"
    :class="`app-button--${variant ?? 'primary'}`"
    type="button"
    :aria-label="ariaLabel ?? label"
  >
    <span>{{ label }}</span>
  </button>
</template>

<style scoped>
.app-button {
  --button-yellow: #ffc83d;
  --button-yellow-light: #ffd765;
  --button-yellow-dark: #d99a2b;

  position: relative;
  overflow: hidden;
  min-height: 3.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 clamp(1.6rem, 3vw, 2.6rem);
  border: 1px solid color-mix(in srgb, var(--button-yellow-dark) 78%, var(--color-paper));
  border-radius: 999px;
  color: var(--color-maiolica-blue);
  background: linear-gradient(180deg, var(--button-yellow-light) 0%, var(--button-yellow) 100%);
  font-family: var(--font-serif);
  font-size: clamp(1.65rem, 2vw, 2.15rem);
  font-style: normal;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1.08;
  text-transform: none;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 180ms ease,
    background 180ms ease,
    border-color 180ms ease,
    color 180ms ease,
    box-shadow 180ms ease;
  box-shadow:
    0 0.55rem 1.25rem rgba(36, 56, 77, 0.16),
    0 0.12rem 0 color-mix(in srgb, var(--button-yellow-dark) 64%, transparent);
}

.app-button::before {
  content: none;
}

.app-button::after {
  content: none;
}

.app-button span {
  position: relative;
  z-index: 2;
}

.app-button:hover {
  transform: translateY(-2px);
  color: var(--color-maiolica-blue);
  background: linear-gradient(180deg, #ffdd72 0%, #ffd04d 100%);
  border-color: color-mix(in srgb, var(--button-yellow-dark) 88%, var(--color-paper));
  box-shadow:
    0 0.7rem 1.45rem rgba(36, 56, 77, 0.18),
    0 0.14rem 0 color-mix(in srgb, var(--button-yellow-dark) 72%, transparent);
}

.app-button:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 4px;
}

.app-button--ghost {
  color: var(--color-maiolica-blue);
  background: linear-gradient(180deg, var(--button-yellow-light) 0%, var(--button-yellow) 100%);
  border-color: color-mix(in srgb, var(--button-yellow-dark) 78%, var(--color-paper));
}

.app-button--ghost:hover {
  color: var(--color-maiolica-blue);
  background: linear-gradient(180deg, #ffdd72 0%, #ffd04d 100%);
  border-color: color-mix(in srgb, var(--button-yellow-dark) 88%, var(--color-paper));
}

.app-button--secondary {
  color: var(--color-maiolica-blue);
  background: linear-gradient(180deg, var(--button-yellow-light) 0%, var(--button-yellow) 100%);
  border-color: color-mix(in srgb, var(--button-yellow-dark) 78%, var(--color-paper));
}

.app-button--secondary::before {
  content: none;
}

.app-button--secondary::after {
  content: none;
}

.app-button--secondary:hover {
  color: var(--color-maiolica-blue);
  background: linear-gradient(180deg, #ffdd72 0%, #ffd04d 100%);
  border-color: color-mix(in srgb, var(--button-yellow-dark) 88%, var(--color-paper));
}
</style>
