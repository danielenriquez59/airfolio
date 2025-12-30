<script setup lang="ts">
import { tv } from 'tailwind-variants'

const {
  iconSize = '20',
  size,
  variant = 'filled',
  error,
  rows = 4,
} = defineProps<{
  variant?: 'filled' | 'outlined' | 'underline'
  label?: string
  placeholder?: string
  prependIcon?: string
  prependIconClass?: string
  prependIconSize?: string
  appendIcon?: string
  appendIconClass?: string
  appendIconSize?: string
  iconSize?: string
  size?: 'sm' | 'md' | 'lg' | 'auto'
  hint?: string
  error?: boolean
  errorMessage?: string
  outerClass?: string
  wrapperClass?: string
  rows?: number
}>()

const emit = defineEmits<{
  'click:prepend': []
  'click:prependIcon': []
  'click:append': []
  'click:appendIcon': []
}>()

defineOptions({
  inheritAttrs: false,
})

const textarea = tv({
  slots: {
    outer: '',
    label:
      'empty:hidden text-gray-800 font-medioum tracking-wide text-sm mb-1 block focus-within:text-primary-600',
    inner: 'flex items-start',
    prepend: 'empty:hidden h-full flex items-center pl-3 pt-3',
    append: 'empty:hidden h-full flex items-center pr-3 pt-3',
    icon: 'text-gray-500',
    textarea: 'w-full px-3 py-2 placeholder-gray-500 resize-y',
    hint: 'text-gray-500 text-sm mt-1',
    error: 'text-error-600 text-sm mt-1',
    wrapper: '',
  },
  variants: {
    variant: {
      filled: {
        inner:
          'bg-white border rounded-lg focus-within:border-primary-600 focus-within:ring-1 focus-within:ring-primary-600 transition duration-200',
        textarea:
          'px-3 bg-transparent border-none focus:border-none focus:outline-none focus:ring-0 rounded-lg',
      },
      underline: {
        label: 'mb-0',
        inner: 'border-b-2 focus-within:border-primary-600 transition duration-200',
        textarea:
          'px-0 bg-transparent px-0 border-none focus:border-none focus:outline-none focus:ring-0',
      },
      outlined: {
        outer: `border rounded-lg relative
        focus-within:border-primary-600 focus-within:ring-1 focus-within:ring-primary-600
        [&:has(textarea:placeholder-shown)_label]:-translate-y-6 [&:has(textarea:placeholder-shown)_label]:bg-white [&:has(textarea:placeholder-shown)_label]:scale-95 [&:has(textarea:placeholder-shown)_label]:text-gray-800
        [&:has(textarea:not(:placeholder-shown))_label]:-translate-y-6 [&:has(textarea:not(:placeholder-shown))_label]:bg-white [&:has(textarea:not(:placeholder-shown))_label]:scale-95 [&:has(textarea:not(:placeholder-shown))_label]:text-black
        [&:has(:focus-visible)_label]:-translate-y-6 [&:has(:focus-visible)_label]:bg-white [&:has(:focus-visible)_label]:scale-95 [&:has(:focus-visible)_label]:text-black`,
        inner: 'rounded-lg border border-transparent',
        textarea:
          'bg-transparent border-none focus:border-none focus:outline-none focus:ring-0',
        label:
          'absolute top-3 left-2.5 text-gray-500 pointer-events-none transition duration-200 ease-in-out px-1',
      },
    },
    size: {
      sm: {
        textarea: 'text-sm min-h-[80px]',
      },
      md: {
        textarea: 'text-sm min-h-[100px]',
      },
      lg: {
        textarea: 'text-base min-h-[120px]',
      },
      auto: {
        textarea: 'min-h-auto',
      },
    },
    error: {
      true: {
        outer: '',
        inner: '',
        label: '',
        textarea: '',
      },
    },
  },
  defaultVariants: {
    variant: 'filled',
    size: 'md',
  },
  compoundSlots: [
    {
      slots: ['inner'],
      error: true,
      variant: 'filled',
      class: 'border-error-600 focus-within:border-error-600 focus-within:ring-1 focus-within:ring-error-600',
    },
    {
      slots: ['inner'],
      error: true,
      variant: 'underline',
      class: 'border-error-600 focus-within:border-error-600',
    },
    {
      slots: ['outer'],
      error: true,
      variant: 'outlined',
      class: 'border-error-600 focus-within:outline-none focus-within:border-error-600 focus-within:ring-1 focus-within:ring-error-600',
    },
  ],
})

const {
  label: labelClass,
  outer,
  inner,
  prepend: prependClass,
  icon,
  textarea: textareaClassVariant,
  append: appendClass,
  hint: hintClass,
  error: errorClass,
  wrapper,
} = textarea({
  size,
  variant,
  error,
})

const modelValue = defineModel<string>({
  local: true,
})
</script>

<template>
  <div :class="[wrapper(), wrapperClass]">
    <div :class="[outer(), outerClass]">
      <label :class="labelClass()">
        {{ label }}
      </label>
      <div :class="inner()">
        <div :class="prependClass()" @click="emit('click:prepend')">
          <slot name="prepend">
            <Icon
              v-if="prependIcon"
              :name="prependIcon"
              :class="[icon(), prependIconClass]"
              :size="prependIconSize || iconSize"
              @click="emit('click:prependIcon')"
            />
          </slot>
        </div>
        <textarea
          v-model="modelValue"
          :placeholder="placeholder"
          :rows="rows"
          :class="[textareaClassVariant()]"
          v-bind="$attrs"
        />
        <div :class="appendClass()" @click="emit('click:append')">
          <slot name="append">
            <Icon
              v-if="appendIcon"
              :name="appendIcon"
              :class="[icon(), appendIconClass]"
              :size="appendIconSize || iconSize"
              @click="emit('click:appendIcon')"
            />
          </slot>
        </div>
      </div>
    </div>
    <div>
      <slot name="hint" v-bind="{ hint }">
        <div v-if="hint" :class="[hintClass()]">
          {{ hint }}
        </div>
      </slot>
      <slot name="error" v-bind="{ error, errorMessage }">
        <div v-if="error" :class="[errorClass()]">
          {{ errorMessage }}
        </div>
      </slot>
    </div>
  </div>
</template>

<style>
textarea:-webkit-autofill,
textarea:-webkit-autofill:hover,
textarea:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--v-autofill-color);
  -webkit-box-shadow: 0 0 0px 1000px var(--v-autofill-shadow-color) inset;
  transition: background-color 5000s ease-in-out 0s;
  border: none !important;
  border-radius: none !important;
}
</style>


