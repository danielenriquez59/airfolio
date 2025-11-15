<script setup lang="ts">
const currentYear = new Date().getFullYear()

const navigation = {
  product: [
    { name: 'Browse Airfoils', href: '/search' },
    { name: 'Compare', href: '/performance' },
    { name: 'About', href: '/about' },
  ],
  resources: [
    { name: 'Documentation', href: '/docs' },
    { name: 'Support', href: '/contact' },
  ],
  // legal: [
  //   { name: 'Privacy Policy', href: '/privacy' },
  //   { name: 'Terms of Service', href: '/terms' },
  //   { name: 'Cookie Policy', href: '/cookies' },
  // ],
}
</script>

<template>
  <footer class="bg-white border-t border-gray-200">
    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div class="xl:grid xl:grid-cols-3 xl:gap-8">
        <!-- Logo and Description -->
        <div class="space-y-8">
          <Logo size="md" />
          <p class="text-sm text-gray-500 max-w-xs">
            Discover, analyze, and compare airfoil performance data. Your comprehensive resource for aerodynamic design.
          </p>
        </div>

        <!-- Navigation Links -->
        <div class="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
          <div class="md:grid md:grid-cols-2 md:gap-8">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                Product
              </h3>
              <ul role="list" class="mt-4 space-y-4">
                <li v-for="item in navigation.product" :key="item.name">
                  <NuxtLink
                    :to="item.href"
                    class="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    {{ item.name }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
            <div class="mt-10 md:mt-0">
              <h3 class="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                Resources
              </h3>
              <ul role="list" class="mt-4 space-y-4">
                <li v-for="item in navigation.resources" :key="item.name">
                  <NuxtLink
                    :to="item.href"
                    class="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    {{ item.name }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
          </div>
          <!-- <div class="md:grid md:grid-cols-2 md:gap-8">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                Legal
              </h3>
              <ul role="list" class="mt-4 space-y-4">
                <li v-for="item in navigation.legal" :key="item.name">
                  <NuxtLink
                    :to="item.href"
                    class="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    {{ item.name }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
          </div> -->
        </div>
      </div>

      <!-- Copyright -->
      <div class="mt-12 border-t border-gray-200 pt-8">
        <p class="text-sm text-gray-400 text-center xl:text-left">
          &copy; {{ currentYear }} Airfolio. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
</template>
