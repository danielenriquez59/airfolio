<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'

const props = defineProps<{
  storageKey: string
}>()

const notes = useLocalStorage(props.storageKey, '')
</script>

<template>
  <div class="h-full">
    <label for="compare-notes" class="sr-only">Design notes</label>
    <textarea
      id="compare-notes"
      v-model="notes"
      class="h-96 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      placeholder="This is a place for you to store your airfoil design notes! These notes persist in your local cache."
    ></textarea>
  </div>
</template>
