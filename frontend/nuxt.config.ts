export default defineNuxtConfig({
  ssr: true, // Disable SSR - run as SPA (client-side only)

  alias: {
    '@': './',
  },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
      meta: [
        { property: 'og:title', content: 'Airfolio' },
        { property: 'og:description', content: 'Search, analyze, and compare airfoil performance with NN-powered analysis tools.' },
        { property: 'og:image', content: 'https://airfolio.live/og-image.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: 'https://airfolio.live/og-image.png' },
      ],
    },
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
    // pages are generated as <route>/index.html, which Netlify serves at the slash form without a redirect
    trailingSlash: true,
  },
  sitemap: {
    sources: [
      '/api/sitemap-urls',
    ],
    // the only <img> found on pages is the Buy me a coffee button; the home image is set in routeRules
    discoverImages: false,
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
      'Inter': [400, 500, 600, 700],
      'JetBrains Mono': [400, 500, 600],
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
    'nitro:config': async function (nitroConfig) {
      try {
        // Fetch all airfoil names from Supabase at build time
        const supabaseUrl = process.env.SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_KEY

        if (!supabaseUrl || !supabaseKey) {
          console.warn('⚠️  SUPABASE_URL or SUPABASE_KEY not set. Skipping airfoil pre-rendering. Dynamic airfoil pages will not be pre-rendered.')
          return
        }

        // eslint-disable-next-line no-console
        console.log('📡 Fetching airfoils for pre-rendering...')
        // Supabase returns at most 1000 rows per request, so page until a short page
        const airfoils: { name: string }[] = []
        for (let offset = 0; ; offset += 1000) {
          const response = await fetch(`${supabaseUrl}/rest/v1/airfoils?select=name&order=name&offset=${offset}&limit=1000`, {
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
          })

          if (!response.ok) {
            console.warn(`⚠️  Failed to fetch airfoils: ${response.status} ${response.statusText}`)
            return
          }

          const page = await response.json()
          airfoils.push(...page)
          if (page.length < 1000)
            break
        }
        const airfoilRoutes = airfoils.map((airfoil: { name: string }) =>
          `/airfoils/${encodeURIComponent(airfoil.name)}`,
        )

        // eslint-disable-next-line no-console
        console.log(`✅ Pre-rendering ${airfoilRoutes.length} airfoil pages...`)

        // Add airfoil routes to prerender list
        if (!nitroConfig.prerender)
          nitroConfig.prerender = { routes: [] }

        if (!nitroConfig.prerender.routes)
          nitroConfig.prerender.routes = []

        nitroConfig.prerender.routes.push(...airfoilRoutes)
      }
      catch (error) {
        console.error('❌ Error fetching airfoils for pre-rendering:', error instanceof Error ? error.message : error)
        // Don't fail the build, just log the error
      }
    },
  },

  routeRules: {
    '/': { sitemap: { images: [{ loc: '/og-image.png' }] } },
    // Old URL of the 2D analysis page, for the dev server; Netlify redirects it in netlify.toml
    '/tools/mfoil': { redirect: { to: '/tools/numerical-analysis-2d', statusCode: 301 } },
    '/cst-visualizer': { redirect: { to: '/tools/airfoil-generator?series=cst', statusCode: 301 } },
    '/tools/naca-generator': { redirect: { to: '/tools/airfoil-generator', statusCode: 301 } },
  },

  nitro: {
    preset: 'static',
    prerender: {
      failOnError: false,
      crawlLinks: true,
      // /account is only linked when signed in, so crawling never finds it
      routes: ['/login', '/account'],
      // a generated redirect page at tools/mfoil/ would shadow the netlify.toml rule and drop the query string
      ignore: ['/tools/mfoil', '/cst-visualizer', '/tools/naca-generator'],
    },
  },
})
