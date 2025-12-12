<script setup lang="ts">
interface Props {
  modelValue: boolean
  label?: string
  leftLabel?: string
  rightLabel?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const toggle = () => {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggle()
  }
}

const sizeClasses = {
  sm: {
    track: 'h-5 w-9',
    thumb: 'h-4 w-4',
    translate: 'translate-x-4',
  },
  md: {
    track: 'h-6 w-11',
    thumb: 'h-5 w-5',
    translate: 'translate-x-5',
  },
  lg: {
    track: 'h-7 w-14',
    thumb: 'h-6 w-6',
    translate: 'translate-x-7',
  },
}

const currentSize = sizeClasses[props.size]
</script>

<template>
  <div class="flex items-center gap-3">
    <label
      v-if="label"
      class="text-sm font-medium text-gray-700"
    >
      {{ label }}
    </label>
    
    <div class="flex items-center gap-2">
      <span
        v-if="leftLabel"
        :class="[
          'text-sm font-medium transition-colors',
          !modelValue ? 'text-gray-900' : 'text-gray-500'
        ]"
      >
        {{ leftLabel }}
      </span>
      
      <button
        type="button"
        role="switch"
        :aria-checked="modelValue"
        :aria-label="label || 'Toggle switch'"
        :disabled="disabled"
        :class="[
          'relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
          currentSize.track,
          modelValue ? 'bg-indigo-600' : 'bg-gray-200',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        ]"
        @click="toggle"
        @keydown="handleKeydown"
      >
        <span
          :class="[
            'inline-block rounded-full bg-white shadow transform transition-transform',
            currentSize.thumb,
            modelValue ? currentSize.translate : 'translate-x-0.5'
          ]"
        />
      </button>
      
      <span
        v-if="rightLabel"
        :class="[
          'text-sm font-medium transition-colors',
          modelValue ? 'text-gray-900' : 'text-gray-500'
        ]"
      >
        {{ rightLabel }}
      </span>
    </div>
  </div>
</template>

