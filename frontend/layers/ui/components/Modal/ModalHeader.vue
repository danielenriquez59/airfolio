<script setup lang="ts">
import { DialogTitle } from '@headlessui/vue'

interface Props {
  dismissable?: boolean
  titleClass?: string
}

defineProps<Props>()

const api = inject('modal')
</script>

<template>
  <DialogTitle
    as="div"
    class="flex gap-2 justify-between items-center px-5 pt-4"
  >
    <h3
      class="text-base font-semibold leading-6 text-gray-900"
      :class="titleClass"
    >
      <slot />
    </h3>
    <slot v-if="dismissable" name="dismissable">
      <button
        type="button"
        aria-label="Close"
        class="-mr-2 inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        @click="api.close"
      >
        <Icon name="heroicons:x-mark-20-solid" class="h-5 w-5" aria-hidden="true" />
      </button>
    </slot>
  </DialogTitle>
</template>
