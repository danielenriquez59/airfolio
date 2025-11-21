export default defineNuxtConfig({
  ssr: true, // Disable SSR - run as SPA (client-side only)
  
  alias: {
    '@': './',
  },
  
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },
  
  modules: [
    '@nuxt/content',
    '@nuxt/icon',
    '@nuxtjs/tailwindcss',
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
  nitro: {
    preset: 'static',
    prerender: {
      failOnError: false,
    },
  },
})