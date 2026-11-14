<script lang="ts" setup>
defineProps<{
  color: string
  icon: any
  count: string | number
  text: string
}>()
</script>

<template>
  <div
    class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
  >
    <div
      class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
      :class="color"
    >
      <Icon :name="icon" class="h-5 w-5" aria-hidden="true" />
    </div>
    <div class="min-w-0">
      <div class="data-label">
        {{ text }}
      </div>
      <div class="num truncate text-xl font-semibold text-gray-900">
        {{ count }}
      </div>
    </div>
  </div>
</template>
