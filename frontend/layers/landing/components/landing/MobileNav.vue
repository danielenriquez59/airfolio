<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline'
import {
  Dialog, DialogPanel,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from '@headlessui/vue'
import type { NavigationItem } from '~~/types'

defineProps<{
  navigation: NavigationItem[]
}>()

const mobileMenu = useMobileMenu()

const route = useRoute()
const isActive = (to?: string) => !!to && (route.path === to || (to !== '/' && route.path.startsWith(`${to}/`)))

function linkClass(to?: string) {
  return [
    'block rounded-lg px-3 py-2 text-base font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
    isActive(to) ? 'bg-primary-50 text-primary-700' : 'text-gray-900 hover:bg-gray-100',
  ]
}
</script>

<template>
  <ClientOnly>
    <Dialog as="div" class="lg:hidden" :open="mobileMenu" @close="mobileMenu = false">
      <div class="fixed inset-0 z-40 bg-gray-900/20" aria-hidden="true" />
      <DialogPanel class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white sm:max-w-sm sm:border-l sm:border-gray-200">
        <div class="flex h-14 items-center justify-between border-b border-gray-200 px-4 sm:px-6">
          <NuxtLink to="/" aria-label="Airfolio home" class="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" @click="mobileMenu = false">
            <Logo size="sm" />
          </NuxtLink>
          <button
            type="button"
            class="-mr-2 rounded-md p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Close menu"
            @click="mobileMenu = false"
          >
            <XMarkIcon class="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <nav class="space-y-1 px-4 py-4 sm:px-6" aria-label="Main">
          <template v-for="item in navigation" :key="item.title">
            <Disclosure v-if="item.children" v-slot="{ open }" :default-open="item.children.some(c => isActive(c.to))">
              <DisclosureButton class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-base font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                {{ item.title }}
                <Icon name="heroicons:chevron-down-20-solid" class="h-5 w-5 text-gray-400 transition-transform" :class="{ 'rotate-180': open }" aria-hidden="true" />
              </DisclosureButton>
              <DisclosurePanel class="ml-3 space-y-1 border-l border-gray-200 pl-3">
                <template v-for="(child, idx) in item.children" :key="child.title || child.header || idx">
                  <div v-if="child.header" class="data-label px-3 pb-1 pt-3">
                    {{ child.header }}
                  </div>
                  <NuxtLink
                    v-else-if="child.to"
                    :to="child.to"
                    :class="linkClass(child.to)"
                    @click="mobileMenu = false"
                  >
                    {{ child.title }}
                  </NuxtLink>
                </template>
              </DisclosurePanel>
            </Disclosure>
            <NuxtLink
              v-else
              :to="item.to"
              :class="linkClass(item.to)"
              @click="mobileMenu = false"
            >
              {{ item.title }}
            </NuxtLink>
          </template>
        </nav>
      </DialogPanel>
    </Dialog>
  </ClientOnly>
</template>
