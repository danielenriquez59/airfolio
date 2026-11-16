<script setup lang="ts">
defineProps<{
  label: string
  value?: string | number | null
  unit?: string
  hint?: string
}>()
</script>

<template>
  <div class="min-w-0">
    <dt class="data-label truncate">
      {{ label }}
    </dt>
    <dd class="mt-1 flex items-baseline gap-1">
      <span class="font-mono text-lg font-medium tabular-nums text-gray-900">
        <slot>{{ value ?? '—' }}</slot>
      </span>
      <span v-if="unit" class="text-sm text-gray-500">{{ unit }}</span>
    </dd>
    <dd v-if="hint" class="mt-0.5 text-xs text-gray-500">
      {{ hint }}
    </dd>
  </div>
</template>
