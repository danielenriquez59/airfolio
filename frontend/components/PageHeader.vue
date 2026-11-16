<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
  eyebrow?: string
}

defineProps<Props>()
</script>

<template>
  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0">
      <div v-if="eyebrow || $slots.eyebrow" class="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
        <slot name="eyebrow">
          {{ eyebrow }}
        </slot>
      </div>
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-200">
        {{ title }}
      </h1>
      <p v-if="subtitle || $slots.subtitle" class="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
        <slot name="subtitle">
          {{ subtitle }}
        </slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
      <slot name="actions" />
    </div>
  </div>
</template>
