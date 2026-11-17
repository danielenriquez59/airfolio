<script setup lang="ts">
import { Bars3Icon } from '@heroicons/vue/24/outline'
import type { NavigationItem } from '~~/types'

defineProps<{
  navigation: NavigationItem[]
}>()

const mobileMenu = useMobileMenu()

const supabase = useSupabaseClient()
const session = useSupabaseSession()
// false until mounted so the pre-rendered (signed-out) HTML hydrates without a mismatch
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
const user = computed(() => session.value?.user)
// Google sign-in supplies a picture; email accounts fall back to their initial.
const avatarUrl = computed(() => user.value?.user_metadata?.avatar_url || user.value?.user_metadata?.picture)
const avatarFailed = ref(false)

async function handleSignOut() {
  // 'local' clears this browser even when the network call would fail
  await supabase.auth.signOut({ scope: 'local' })
  await navigateTo('/')
}

const route = useRoute()
// Signing in from the navbar returns the user to the page they were on.
const loginLink = computed(() => ['/', '/login'].includes(route.path) ? '/login' : `/login?redirect=${encodeURIComponent(route.fullPath)}`)
const isActive = (to?: string) => !!to && (route.path === to || (to !== '/' && route.path.startsWith(`${to}/`)))
</script>

<template>
  <nav class="page-container flex h-14 items-center gap-6" aria-label="Main">
    <!-- Logo and right side share the spare width equally, which centers the links -->
    <div class="flex flex-1">
      <NuxtLink to="/" class="flex shrink-0 items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Airfolio home">
        <Logo size="sm" />
      </NuxtLink>
    </div>
    <div class="hidden items-center gap-1 lg:flex">
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
    <div class="flex flex-1 items-center justify-end gap-2">
      <template v-if="mounted">
        <VDropdown v-if="user" right>
          <template #activator>
            <VDropdownButton
              as="button"
              type="button"
              class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-sm font-semibold uppercase text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              aria-label="Account menu"
            >
              <img v-if="avatarUrl && !avatarFailed" :src="avatarUrl" alt="" class="h-full w-full object-cover" referrerpolicy="no-referrer" @error="avatarFailed = true">
              <template v-else>
                {{ user.email?.[0] }}
              </template>
            </VDropdownButton>
          </template>
          <p class="truncate border-b border-gray-200 px-2 py-2 text-xs text-gray-500">
            {{ user.email }}
          </p>
          <VDropdownItem to="/account" icon="heroicons:user-circle" text="Account" />
          <VDropdownItem icon="heroicons:arrow-right-on-rectangle" text="Sign out" @click="handleSignOut" />
        </VDropdown>
        <VButton v-else :to="loginLink" color="primary" size="sm">
          Sign in
        </VButton>
      </template>
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
