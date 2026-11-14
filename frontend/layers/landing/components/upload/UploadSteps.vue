<script setup lang="ts">
defineProps<{ current: 1 | 2 }>()

const steps = ['Details & coordinates', 'Review & submit']
</script>

<template>
  <ol class="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm" aria-label="Upload progress">
    <li
      v-for="(step, i) in steps"
      :key="step"
      class="flex items-center gap-2"
      :aria-current="current === i + 1 ? 'step' : undefined"
    >
      <Icon v-if="i > 0" name="heroicons:chevron-right-20-solid" class="h-4 w-4 text-gray-400" aria-hidden="true" />
      <span
        class="num inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
        :class="current === i + 1 ? 'bg-primary-600 text-white' : current > i + 1 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'"
      >
        <Icon v-if="current > i + 1" name="heroicons:check-20-solid" class="h-4 w-4" aria-hidden="true" />
        <template v-else>{{ i + 1 }}</template>
      </span>
      <span :class="current === i + 1 ? 'font-medium text-gray-900' : 'text-gray-500'">{{ step }}</span>
    </li>
  </ol>
</template>
