<script setup lang="ts">
interface Props {
  label: string
  name: string
  modelValue: number
  unit: string
  step?: number
  tooltip?: string
}

const props = withDefaults(defineProps<Props>(), {
  step: 0.1
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  if (!isNaN(value)) {
    emit('update:modelValue', value)
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
        type="number"
        :name="name"
        :value="modelValue"
        step="any"
        @input="handleInput"
        class="block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
      />
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <span class="text-slate-500 sm:text-sm">{{ unit }}</span>
      </div>
    </div>
  </div>
</template>


