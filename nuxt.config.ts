// Sitio SPA (Vue 3) servido como estático + API REST en Netlify Functions
export default defineNuxtConfig({
  compatibilityDate: '2026-01-01',

  // El frontend consume la API REST en el navegador, por lo que no necesita SSR.
  ssr: false,
  modules: [],

  css: ['~/assets/css/main.css'],

  nitro: {
    // Preset explícito: la salida siempre queda en .output/public (local y Netlify).
    preset: 'static',
    // Durante `npm run dev` se reenvía /api al servidor local de funciones.
    devProxy: {
      '/api': {
        target: 'http://127.0.0.1:8787/api',
        changeOrigin: false,
      },
    },
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'Premios Nobel — Catálogo de galardonados',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Catálogo temático de los Premios Nobel: galardonados, categorías y países. Proyecto 2 — MongoDB, Netlify Functions y JWT.',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700;800&display=swap',
        },
      ],
    },
  },
})
