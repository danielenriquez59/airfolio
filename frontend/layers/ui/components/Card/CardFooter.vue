<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    bordered?: boolean
  }>(),
  {
    bordered: false,
  },
)
</script>

<template>
  <div class="px-4 pb-3 text-sm text-gray-600">
    <slot />
  </div>
</template>
