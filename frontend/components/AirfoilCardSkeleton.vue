<script setup lang="ts">
interface Props {
  /** Show thumbnail variant */
  thumbnail?: boolean
}

withDefaults(defineProps<Props>(), {
  thumbnail: false,
})

// Match the aspect ratio from AirfoilCard
const aspectRatio = 5
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white" aria-hidden="true">
    <div class="border-b border-gray-100 px-3 py-2">
      <div class="w-full animate-pulse rounded bg-gray-200" :style="{ aspectRatio: `${aspectRatio} / 1` }" />
    </div>
    <div class="flex flex-1 flex-col gap-2 p-3">
      <div class="flex items-start justify-between gap-2">
        <div class="h-5 w-1/2 animate-pulse rounded bg-gray-200" />
        <div class="h-5 w-14 animate-pulse rounded-full bg-gray-200" />
      </div>
      <div class="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
      <div class="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-gray-100 pt-2">
        <div v-for="i in 4" :key="i">
          <div class="h-4 w-14 animate-pulse rounded bg-gray-100" />
          <div class="mt-0.5 h-5 w-12 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    </div>
  </div>
</template>
