export default defineNuxtConfig({
  ssr: true, // Disable SSR - run as SPA (client-side only)
  
  alias: {
    '@': './',
  },
  
  modules: [
    '@nuxt/content',
    '@nuxt/icon',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/i18n',
    '@nuxtjs/google-fonts',
    '@nuxtjs/fontaine',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/supabase',
    '@nuxtjs/sitemap',
    '@nuxtjs/robots',
  ],
  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL,
    name: 'Airfolio',
  },
  sitemap: {
    sources: [
      '/api/sitemap-urls'
    ],
  },
  i18n: {
    locales: ['en', 'id'],
    defaultLocale: 'en',
    vueI18n: './i18n.config.ts',
  },
  runtimeConfig: {
    public: {
      gaId: '',
      backendUrl: process.env.BACKEND_URL || 'http://localhost:8000',
      supportEmail: process.env.NUXT_PUBLIC_SUPPORT_EMAIL || 'deenriquez92@gmail.com',
    },
  },
  googleFonts: {
    prefetch: true,
    preconnect: true,
    families: {
      Inter: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    },
  },
  content: {
    highlight: {
      theme: {
        default: 'github-dark',
      },
    },
    preload: ['json', 'js', 'ts', 'html', 'css', 'vue', 'diff', 'shell', 'markdown', 'yaml', 'bash', 'ini'],
  },

  vite: {
    vue: {
      script: {
        propsDestructure: true,
      },
    },
    optimizeDeps: {
      include: ['cookie-es'],
    },
  },

  supabase: {
    redirect: false,
    clientOptions: {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    },
  },

  devtools: {
    enabled: true,
  },
})