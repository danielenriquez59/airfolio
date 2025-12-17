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
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
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
  
  hooks: {
    async 'nitro:config'(nitroConfig) {
      try {
        // Fetch all airfoil names from Supabase at build time
        const supabaseUrl = process.env.SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_KEY

        if (!supabaseUrl || !supabaseKey) {
          console.warn('⚠️  SUPABASE_URL or SUPABASE_KEY not set. Skipping airfoil pre-rendering. Dynamic airfoil pages will not be pre-rendered.')
          return
        }

        console.log('📡 Fetching airfoils for pre-rendering...')
        const response = await fetch(`${supabaseUrl}/rest/v1/airfoils?select=name`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        })

        if (!response.ok) {
          console.warn(`⚠️  Failed to fetch airfoils: ${response.status} ${response.statusText}`)
          return
        }

        const airfoils = await response.json()
        const airfoilRoutes = airfoils.map((airfoil: { name: string }) => 
          `/airfoils/${encodeURIComponent(airfoil.name)}`
        )

        console.log(`✅ Pre-rendering ${airfoilRoutes.length} airfoil pages...`)
        
        // Add airfoil routes to prerender list
        if (!nitroConfig.prerender) {
          nitroConfig.prerender = { routes: [] }
        }
        if (!nitroConfig.prerender.routes) {
          nitroConfig.prerender.routes = []
        }
        
        nitroConfig.prerender.routes.push(...airfoilRoutes)
      } catch (error) {
        console.error('❌ Error fetching airfoils for pre-rendering:', error instanceof Error ? error.message : error)
        // Don't fail the build, just log the error
      }
    }
  },
  
  nitro: {
    preset: 'static',
    prerender: {
      failOnError: false,
      crawlLinks: true,
    },
  },
})