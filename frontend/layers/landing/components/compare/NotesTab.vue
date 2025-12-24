<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'

const props = defineProps<{
  storageKey: string
}>()

const notes = useLocalStorage(props.storageKey, '')
</script>

<template>
  <div class="h-full">
    <textarea
      v-model="notes"
      class="w-full h-96 p-4 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-500"
      placeholder="This is a place for you to store your airfoil design notes! These notes persist in your local cache."
    ></textarea>
  </div>
</template>

