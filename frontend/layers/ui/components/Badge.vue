<script setup lang="ts">
const { tone = 'neutral' } = defineProps<{
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info'
}>()

const tones = {
  neutral: 'bg-gray-100 text-gray-700 ring-gray-200',
  primary: 'bg-primary-50 text-primary-700 ring-primary-200',
  success: 'bg-success-50 text-success-700 ring-success-200',
  warning: 'bg-warning-50 text-warning-800 ring-warning-200',
  error: 'bg-error-50 text-error-700 ring-error-200',
  info: 'bg-info-50 text-info-700 ring-info-200',
}
</script>

<template>
  <span class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset" :class="tones[tone]">
    <slot />
  </span>
</template>
