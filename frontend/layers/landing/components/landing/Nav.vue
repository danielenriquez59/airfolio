<script setup lang="ts">
import { Bars3Icon } from '@heroicons/vue/24/outline'
import type { NavigationItem } from '~~/types'
import { useAuthStore } from '~~/stores/auth'

defineProps<{
  navigation: NavigationItem[]
}>()

const mobileMenu = useMobileMenu()

const auth = useAuthStore()

const route = useRoute()
const isActive = (to?: string) => !!to && (route.path === to || (to !== '/' && route.path.startsWith(`${to}/`)))
</script>

<template>
  <nav class="page-container flex h-14 items-center gap-6" aria-label="Main">
    <NuxtLink to="/" class="flex shrink-0 items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Airfolio home">
      <Logo size="sm" />
    </NuxtLink>
    <div class="hidden flex-1 items-center gap-1 lg:flex">
      <template v-for="item in navigation" :key="item.title">
        <VMenus v-if="item.children" :items="item.children" :title="item.title" :to="item.to" />
        <NuxtLink
          v-else
          :to="item.to"
          class="rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          :class="isActive(item.to) ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
          :aria-current="isActive(item.to) ? 'page' : undefined"
        >
          {{ item.title }}
        </NuxtLink>
      </template>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <NuxtLink
        v-if="auth.loggedIn"
        to="/admin"
        class="hidden rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:inline-flex"
      >
        Admin <span aria-hidden="true">&rarr;</span>
      </NuxtLink>
      <button
        type="button"
        class="-mr-2 inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden"
        aria-label="Open main menu"
        :aria-expanded="mobileMenu"
        @click="mobileMenu = true"
      >
        <Bars3Icon class="h-6 w-6" aria-hidden="true" />
      </button>
    </div>
  </nav>
</template>
