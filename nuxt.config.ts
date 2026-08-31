export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      turnstileSiteKey: '1x00000000000000000000AA',
    },
  },
  app: {
    head: {
      htmlAttrs: {
        lang: 'it',
      },
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'Il sito del matrimonio di Ottavio Fogliata e Sabrina de Palma, a Martina Franca il 12 settembre 2026.',
        },
      ],
      title: 'Ottavio e Sabrina | 12 settembre 2026',
    },
  },
  compatibilityDate: '2026-04-25',
  css: [
    '~/assets/css/palette.css',
    '~/assets/css/typography.css',
    '~/assets/css/base.css',
  ],
  devtools: { enabled: true },
  routeRules: {
    '/minigame/**': {
      headers: {
        'cache-control': 'no-store, no-cache, must-revalidate',
        pragma: 'no-cache',
      },
    },
    '/foto': {
      headers: {
        'cache-control': 'no-store, no-cache, must-revalidate',
        'x-robots-tag': 'noindex, nofollow, noarchive',
      },
    },
    '/gallery': {
      headers: {
        'cache-control': 'no-store, no-cache, must-revalidate',
        'x-robots-tag': 'noindex, nofollow, noarchive',
      },
    },
  },
  ssr: true,
})
