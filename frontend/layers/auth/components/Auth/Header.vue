<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
}>()
</script>

<template>
  <div class="mb-6 space-y-1 text-center">
    <h1 class="text-xl font-semibold tracking-tight text-gray-900">
      {{ title }}
    </h1>
    <p class="text-sm text-gray-500">
      {{ subtitle }}
    </p>
  </div>
</template>
