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

// Local string state for free-form typing
const localValue = ref(String(props.modelValue))

// Sync local value when modelValue changes externally
watch(() => props.modelValue, (newVal) => {
  // Only update if different to avoid cursor jumping
  if (parseFloat(localValue.value) !== newVal) {
    localValue.value = String(newVal)
  }
})

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  localValue.value = target.value

  // Emit if valid number
  const value = parseFloat(target.value)
  if (!isNaN(value)) {
    emit('update:modelValue', value)
  }
}

const handleBlur = () => {
  // On blur, clean up the display value
  const value = parseFloat(localValue.value)
  if (!isNaN(value)) {
    localValue.value = String(value)
    emit('update:modelValue', value)
  } else {
    // Reset to model value if invalid
    localValue.value = String(props.modelValue)
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
        type="text"
        inputmode="decimal"
        :name="name"
        :value="localValue"
        @input="handleInput"
        @blur="handleBlur"
        class="block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
      />
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <span class="text-slate-500 sm:text-sm">{{ unit }}</span>
      </div>
    </div>
  </div>
</template>
