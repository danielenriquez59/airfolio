<script setup lang="ts">
import type { PropType } from 'vue'
import { computed } from 'vue'
import { buttonVariants } from '../../utils/buttons'

const props = defineProps({
  type: {
    type: String,
    default: undefined,
  },
  color: {
    type: String as PropType<'primary' | 'secondary' | 'warning' | 'error' | 'success' | 'light' | 'dark' | 'neutral'>,
    default: 'light',
  },
  rounded: {
    type: Boolean,
    default: false,
  },
  variant: {
    type: String as PropType<'primary' | 'tertiary' | 'ghost'>,
    default: 'primary',
    validator: (v: string) => ['primary', 'tertiary', 'ghost'].includes(v),
  },
  block: {
    type: Boolean,
    default: false,
  },
  to: {
    type: [String, Object],
    default: undefined,
  },
  href: {
    type: String,
    default: undefined,
  },
  size: {
    type: String as PropType<'xs' | 'sm' | 'md' | 'lg'>,
    default: 'md',
    validator: (v: string) => ['xs', 'sm', 'md', 'lg'].includes(v),
  },
  shadow: {
    type: [Boolean, String] as PropType<boolean | 'sm' | 'md' | 'lg' | 'xl'>,
    default: false,
    validator: (v: boolean | string) => [true, false, 'sm', 'md', 'lg', 'xl'].includes(v),
  },
})

const tag = computed(() => (props.to ? 'nuxt-link' : props.href ? 'a' : 'button'))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :href="href"
    :type="type"
    :class="buttonVariants({
      size,
      color,
      rounded,
      variant,
      shadow,
      block,
    })"
  >
    <slot />
  </component>
</template>
