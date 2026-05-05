<script setup lang="ts">
const isScrolled = ref(false)

function updateHeaderState() {
  isScrolled.value = window.scrollY > 72
}

onMounted(() => {
  updateHeaderState()
  window.addEventListener('scroll', updateHeaderState, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateHeaderState)
})
</script>

<template>
  <header class="site-header" :class="{ 'site-header--scrolled': isScrolled }" aria-label="Navigazione principale">
    <nav class="site-header__nav" aria-label="Sezioni del sito">
      <a href="#invito">Invito</a>
      <a href="#details">Dove</a>
      <a href="#consigli">Consigli</a>
      <a href="#minigame">Minigame</a>
      <a href="#conferma">RSVP</a>
    </nav>
  </header>
</template>

<style scoped>
.site-header {
  position: fixed;
  top: clamp(0.7rem, 1.8vw, 1.1rem);
  left: 50%;
  z-index: 20;
  width: max-content;
  max-width: calc(100% - 2rem);
  min-height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.34rem 0.5rem;
  pointer-events: none;
  border: 1px solid transparent;
  border-radius: 999px;
  transform: translateX(-50%);
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    backdrop-filter 180ms ease;
}

.site-header--scrolled {
  background: color-mix(in srgb, var(--color-paper) 86%, transparent);
  border-color: color-mix(in srgb, var(--color-maiolica-blue) 18%, transparent);
  box-shadow:
    0 18px 42px rgba(36, 56, 77, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.64);
  backdrop-filter: blur(16px);
}

.site-header__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(0.3rem, 1.1vw, 0.9rem);
  pointer-events: auto;
}

.site-header__nav a {
  padding: 0.66rem 0.72rem;
  border-radius: 999px;
  color: color-mix(in srgb, var(--color-maiolica-blue) 86%, var(--color-ink));
  font-family: var(--font-sans);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  line-height: 1;
  text-decoration: none;
  text-shadow:
    0 1px 0 rgba(255, 248, 237, 0.86),
    0 0.18rem 0.8rem rgba(255, 248, 237, 0.8);
  text-transform: uppercase;
  transition:
    background-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.site-header__nav a:hover {
  color: var(--color-maiolica-blue);
  background: color-mix(in srgb, var(--color-paper) 46%, transparent);
  transform: translateY(-1px);
}

.site-header__nav a:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 3px;
  background: color-mix(in srgb, var(--color-paper) 54%, transparent);
}

@media (max-width: 680px) {
  .site-header {
    width: min(calc(100% - 1rem), 26rem);
    padding: 0.28rem 0.34rem;
  }

  .site-header__nav {
    width: 100%;
    justify-content: space-between;
    gap: 0;
  }

  .site-header__nav a {
    padding: 0.58rem 0.38rem;
    font-size: 0.56rem;
    letter-spacing: 0.08em;
  }
}
</style>
