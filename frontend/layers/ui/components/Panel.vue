<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  /** Remove body padding (tables, plots that run edge to edge) */
  flush?: boolean
  /** Heading element for the title, to keep the page outline correct */
  as?: 'h2' | 'h3' | 'h4'
}>(), {
  as: 'h2',
})
</script>

<template>
  <section class="rounded-xl border border-gray-200 bg-white">
    <div
      v-if="title || description || $slots.title || $slots.actions"
      class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-gray-200 px-4 py-3 sm:px-5"
    >
      <div class="min-w-0">
        <component :is="as" class="text-base font-semibold text-gray-900">
          <slot name="title">
            {{ title }}
          </slot>
        </component>
        <p v-if="description" class="mt-0.5 text-sm text-gray-500">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <div :class="flush ? 'overflow-hidden rounded-b-xl' : 'p-4 sm:p-5'">
      <slot />
    </div>
  </section>
</template>
