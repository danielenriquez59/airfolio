<script setup lang="ts">
interface Props {
  label: string
  name: string
  modelValue: number
  unit: string
  tooltip?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

// Local state for the input - completely independent while typing
const inputRef = ref<HTMLInputElement | null>(null)
const localValue = ref(String(props.modelValue))
const isFocused = ref(false)

// Only sync from parent when NOT focused (prevents interference while typing)
watch(() => props.modelValue, (newVal) => {
  if (!isFocused.value) {
    localValue.value = String(newVal)
  }
})

const handleFocus = () => {
  isFocused.value = true
}

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  localValue.value = target.value
}

const handleBlur = () => {
  isFocused.value = false
  const value = parseFloat(localValue.value)
  if (!isNaN(value) && isFinite(value)) {
    localValue.value = String(value)
    emit('update:modelValue', value)
  } else {
    // Reset to model value if invalid
    localValue.value = String(props.modelValue)
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  // Submit on Enter
  if (event.key === 'Enter') {
    inputRef.value?.blur()
  }
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-3">
    <label :for="`input-${name}`" class="flex min-w-0 items-center gap-1 text-sm text-gray-700">
      {{ label }}
      <span v-if="tooltip" class="shrink-0 cursor-help text-gray-400" :title="tooltip">
        <Icon name="heroicons:information-circle" class="h-4 w-4" aria-hidden="true" />
      </span>
    </label>
    <div class="relative">
      <input
        :id="`input-${name}`"
        ref="inputRef"
        v-model="localValue"
        type="text"
        inputmode="decimal"
        :name="name"
        :aria-describedby="tooltip ? `input-${name}-hint` : undefined"
        class="num block h-9 w-full rounded-lg border border-gray-300 pl-3 pr-14 text-right text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        @focus="handleFocus"
        @input="handleInput"
        @blur="handleBlur"
        @keydown="handleKeydown"
      >
      <span class="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center text-xs text-gray-500">{{ unit }}</span>
    </div>
    <p v-if="tooltip" :id="`input-${name}-hint`" class="sr-only">
      {{ tooltip }}
    </p>
  </div>
</template>
