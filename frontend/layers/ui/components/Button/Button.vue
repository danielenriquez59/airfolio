<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, resolveComponent, useAttrs } from 'vue'
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

const attrs = useAttrs()
const NuxtLink = resolveComponent('NuxtLink')
// A disabled link renders as a disabled <button> so it can't be followed
const isLink = computed(() => !!(props.to || props.href) && (attrs.disabled == null || attrs.disabled === false))
const tag = computed(() => (!isLink.value ? 'button' : props.to ? NuxtLink : 'a'))
</script>

<template>
  <component
    :is="tag"
    :to="isLink ? to : undefined"
    :href="isLink && !to ? href : undefined"
    :type="isLink ? undefined : type"
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
