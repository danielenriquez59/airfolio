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
  <div class="flex flex-col mb-3">
    <label class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
      {{ label }}
      <span v-if="tooltip" class="text-slate-400 cursor-help" :title="tooltip">ⓘ</span>
    </label>
    <div class="relative rounded-md shadow-sm">
      <input
        ref="inputRef"
        type="text"
        inputmode="decimal"
        :name="name"
        v-model="localValue"
        @focus="handleFocus"
        @input="handleInput"
        @blur="handleBlur"
        @keydown="handleKeydown"
        class="block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
      />
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <span class="text-slate-500 sm:text-sm">{{ unit }}</span>
      </div>
    </div>
  </div>
</template>
