<script lang="ts" setup>
const props
  = defineProps<{
    icon?: any
    appendIcon?: any
    text?: string
    child?: boolean
    parent?: boolean
  }>()
</script>

<template>
  <nuxt-link
    class="
      px-3
      py-2
      text-sm
      text-gray-700
      transition-colors
      hover:bg-gray-100
      hover:text-gray-900
      focus-visible:outline-none
      focus-visible:ring-2
      focus-visible:ring-primary-500
      [&.router-link-exact-active]:bg-primary-50
      [&.router-link-exact-active]:text-primary-700
      rounded-lg
      flex
      gap-2
      items-center
      w-full
    "
  >
    <div v-if="child" class="w-5" />
    <Icon v-else-if="icon" class="w-5 h-5" :name="icon" />
    <span class="flex-grow">
      <slot>{{ text }}</slot>
    </span>
    <Icon v-if="parent" name="ri:arrow-right-s-line" class="w-5 h-5 text-gray-400" />
    <div v-else-if="appendIcon" class="w-5 h-5" :class="appendIcon" />
  </nuxt-link>
</template>
