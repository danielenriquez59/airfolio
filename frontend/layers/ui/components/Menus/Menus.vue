<script setup lang="ts">
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue'
import MenusItem from './MenusItem.vue'

export type MenuPlacement = 'top' | 'bottom' | 'left' | 'right' | 'bottom-right' | 'right-child'

type MenuItem = InstanceType<typeof MenusItem>['$props']

const props = withDefaults(defineProps<{
  title?: string
  to?: MenuItem['to']
  items?: MenuItem[]
  placement?: MenuPlacement
  isChild?: boolean
}>(), {
  placement: 'bottom',
})

const placementClass: Record<MenuPlacement, string> = {
  'top': 'bottom-0',
  'bottom': '',
  'left': 'left-0',
  'right': 'right-0',
  'bottom-right': 'bottom-0 right-0',
  'right-child': 'right-auto top-9 lg:-right-[105%] lg:-top-2',
}

const route = useRoute()
const isActive = computed(() => (props.to ? route.path === props.to : false))
// Highlight a parent menu when the current route is one of its items
const childActive = computed(() => props.items?.some(i => typeof i.to === 'string' && i.to === route.path) ?? false)
const menuPlacement = props.isChild ? 'right-child' : props.placement
</script>

<template>
  <Popover class="relative inline">
    <slot name="activator">
      <PopoverButton
        class="inline-flex items-center gap-1 rounded-md text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        :class="[
          isChild
            ? 'justify-between px-3 py-2 w-full text-left text-gray-700 hover:bg-gray-100'
            : 'px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100',
          { '!text-primary-700 bg-primary-50': isActive || childActive },
        ]"
      >
        {{ title }}
        <Icon v-if="items?.length || $slots.default" :name="isChild ? 'heroicons:chevron-right-20-solid' : 'heroicons:chevron-down-20-solid'" class="h-4 w-4" aria-hidden="true" />
      </PopoverButton>
    </slot>
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-1 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-1 opacity-0"
    >
      <PopoverPanel
        v-if="items?.length || $slots.default"
        v-slot="{ close }"
        class="absolute mt-2 z-40 bg-white border border-gray-200 shadow-lg p-1 w-60 rounded-lg"
        :class="placementClass[menuPlacement]"
      >
        <div class="flex flex-col">
          <slot>
            <template v-for="(item, idx) in items" :key="item.title || item.header || idx">
              <div v-if="item.divider" class="border-t border-gray-200 my-1 -mx-1" />
              <div v-else-if="item.header" class="data-label select-none px-3 pt-2 pb-1">
                {{ item.header }}
              </div>
              <Menus
                v-else-if="item.children" :title="item.title" :to="item.to" :items="item.children" :placement="item.placement"
                is-child
              />
              <MenusItem
                v-else
                v-bind="item"
                @click="item.onClick ? item.onClick(close) : close()"
              />
            </template>
          </slot>
        </div>
      </PopoverPanel>
    </transition>
  </Popover>
</template>
