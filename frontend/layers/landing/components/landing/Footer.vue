<script setup lang="ts">
const currentYear = new Date().getFullYear()
const config = useRuntimeConfig()
const supportEmail = config.public.supportEmail

const navigation = {
  product: [
    { name: 'Browse Airfoils', href: '/search' },
    { name: 'Compare', href: '/performance' },
    { name: 'Upload Airfoil', href: '/upload' },
    { name: 'About', href: '/about' },
  ],
  resources: [
    { name: 'Bug Report', href: '/contact' },
    { name: 'Privacy Policy', href: '/about/privacypolicy' },
    { name: 'Terms of Service', href: '/about/termsofservice' },
  ],
}

const linkClass = 'text-sm text-gray-600 hover:text-gray-900 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
</script>

<template>
  <footer class="border-t border-gray-200 bg-white">
    <div class="page-container py-10">
      <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div class="space-y-3 sm:col-span-2">
          <Logo size="sm" />
          <p class="max-w-xs text-sm text-gray-500">
            Discover, analyze, and compare airfoil performance data. Your comprehensive resource for aerodynamic design.
          </p>
        </div>

        <nav aria-labelledby="footer-product">
          <h2 id="footer-product" class="data-label">
            Product
          </h2>
          <ul role="list" class="mt-3 space-y-2">
            <li v-for="item in navigation.product" :key="item.name">
              <NuxtLink :to="item.href" :class="linkClass">
                {{ item.name }}
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-support">
          <h2 id="footer-support" class="data-label">
            Support
          </h2>
          <ul role="list" class="mt-3 space-y-2">
            <li v-for="item in navigation.resources" :key="item.name">
              <NuxtLink :to="item.href" class="group inline-flex items-center" :class="linkClass">
                <BugIcon v-if="item.name === 'Bug Report'" size="16" class="mr-2 opacity-70 group-hover:opacity-100 transition-opacity" />
                {{ item.name }}
              </NuxtLink>
            </li>
            <li>
              <a :href="`mailto:${supportEmail}`" :class="linkClass">
                Email support
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div class="mt-8 flex flex-col gap-2 border-t border-gray-200 pt-6 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {{ currentYear }} Airfolio. All rights reserved.</p>
        <p>
          Check out the sister site,
          <a href="https://airfolio.live" target="_blank" rel="noopener noreferrer" class="font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">Propfolio</a>
        </p>
      </div>
    </div>
  </footer>
</template>
