<script setup lang="ts">
interface CoordinatePair {
  x: number | ''
  y: number | ''
}

interface Props {
  modelValue: CoordinatePair[]
  surface: 'upper' | 'lower'
  maxRows?: number
}

interface Emits {
  (e: 'update:modelValue', value: CoordinatePair[]): void
}

const props = withDefaults(defineProps<Props>(), {
  maxRows: 100,
})

const emit = defineEmits<Emits>()

const rows = computed({
  get: () => props.modelValue,
  set: (val) => {
    emit('update:modelValue', val)
  },
})

const addRow = () => {
  if (rows.value.length < props.maxRows) {
    rows.value = [...rows.value, { x: '', y: '' }]
  }
}

const removeRow = (index: number) => {
  rows.value = rows.value.filter((_, i) => i !== index)
}

const updateCell = (index: number, field: 'x' | 'y', value: string) => {
  const newRows = [...rows.value]
  // Store the raw string value to preserve typing like "0.0", "1.", etc.
  // Will be converted to number during validation/submission
  if (value === '') {
    newRows[index] = { ...newRows[index], [field]: '' }
  } else {
    newRows[index] = { ...newRows[index], [field]: value as any }
  }
  rows.value = newRows
}

const clearAll = () => {
  rows.value = []
}

const isValidCoordinate = (value: number | '' | string): boolean => {
  if (value === '') return true
  const num = typeof value === 'string' ? parseFloat(value) : value
  return !isNaN(num) && isFinite(num)
}

const hasErrors = computed(() => {
  return rows.value.some(row => !isValidCoordinate(row.x) || !isValidCoordinate(row.y))
})
</script>

<template>
  <div class="space-y-4">
    <div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr class="border-b-2 border-gray-300">
            <th class="text-left px-3 py-2 text-sm font-semibold text-gray-900">X</th>
            <th class="text-left px-3 py-2 text-sm font-semibold text-gray-900">Y</th>
            <th class="text-center px-3 py-2 text-sm font-semibold text-gray-900 w-12">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rows.length === 0" class="border-b border-gray-200">
            <td colspan="3" class="text-center px-3 py-8 text-sm text-gray-500">
              No coordinates added yet
            </td>
          </tr>
          <tr
            v-for="(row, index) in rows"
            :key="index"
            class="border-b border-gray-200 hover:bg-gray-50"
          >
            <td class="px-3 py-2">
              <input
                type="number"
                :value="row.x"
                step="any"
                placeholder="0.0"
                class="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 no-spinner"
                @input="updateCell(index, 'x', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-3 py-2">
              <input
                type="number"
                :value="row.y"
                step="any"
                placeholder="0.0"
                class="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 no-spinner"
                @input="updateCell(index, 'y', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-3 py-2 text-center">
              <button
                type="button"
                class="text-gray-400 hover:text-red-600 transition-colors"
                title="Delete row"
                @click="removeRow(index)"
              >
                <Icon name="heroicons:trash-20-solid" class="h-5 w-5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex gap-2">
      <button
        type="button"
        :disabled="rows.length >= maxRows"
        class="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        @click="addRow"
      >
        Add Row
      </button>
      <button
        v-if="rows.length > 0"
        type="button"
        class="px-3 py-2 bg-gray-300 text-gray-900 text-sm font-medium rounded hover:bg-gray-400 transition-colors"
        @click="clearAll"
      >
        Clear All
      </button>
    </div>

    <div v-if="hasErrors" class="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
      Some coordinates contain invalid values. Please check and correct them.
    </div>

    <div class="text-xs text-gray-500">
      {{ rows.length }} coordinate{{ rows.length !== 1 ? 's' : '' }} entered (max: {{ maxRows }})
    </div>
  </div>
</template>

<style scoped>
/* Hide spinner arrows on number inputs */
input.no-spinner::-webkit-outer-spin-button,
input.no-spinner::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input.no-spinner[type=number] {
  -moz-appearance: textfield;
}
</style>

