<script setup lang="ts">
const { variant = 'empty', icon } = defineProps<{
  variant?: 'loading' | 'empty' | 'error'
  title?: string
  description?: string
  /** Override the default icon (any @nuxt/icon name); ignored for loading */
  icon?: string
}>()

const defaultIcons = {
  empty: 'heroicons:inbox',
  error: 'heroicons:exclamation-triangle',
}
</script>

<template>
  <div
    class="flex flex-col items-center justify-center px-4 py-10 text-center"
    :role="variant === 'error' ? 'alert' : variant === 'loading' ? 'status' : undefined"
  >
    <div
      v-if="variant === 'loading'"
      class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600"
      aria-hidden="true"
    />
    <Icon
      v-else
      :name="icon || defaultIcons[variant]"
      class="h-8 w-8"
      :class="variant === 'error' ? 'text-error-600' : 'text-gray-400'"
      aria-hidden="true"
    />
    <p v-if="title" class="mt-3 text-sm font-medium" :class="variant === 'error' ? 'text-error-700' : 'text-gray-900'">
      {{ title }}
    </p>
    <span v-else-if="variant === 'loading'" class="sr-only">Loading</span>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-gray-500">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-4 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
