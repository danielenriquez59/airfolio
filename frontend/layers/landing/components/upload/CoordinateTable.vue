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
  <div class="space-y-3">
    <div class="max-h-80 overflow-auto rounded-lg border border-gray-200">
      <table class="w-full border-collapse text-sm">
        <thead class="sticky top-0 z-10 bg-gray-50">
          <tr class="border-b border-gray-200">
            <th scope="col" class="data-label w-10 px-2 py-2 text-right">
              #
            </th>
            <th scope="col" class="data-label px-2 py-2 text-right">
              X
            </th>
            <th scope="col" class="data-label px-2 py-2 text-right">
              Y
            </th>
            <th scope="col" class="w-10 px-2 py-2">
              <span class="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="rows.length === 0">
            <td colspan="4" class="px-3 py-6 text-center text-sm text-gray-500">
              No coordinates added yet
            </td>
          </tr>
          <tr
            v-for="(row, index) in rows"
            :key="index"
            class="hover:bg-gray-50"
          >
            <td class="num px-2 py-1 text-right text-xs text-gray-500">
              {{ index + 1 }}
            </td>
            <td class="px-1 py-1">
              <input
                type="number"
                :value="row.x"
                step="any"
                placeholder="0.0"
                :aria-label="`${surface} surface X, row ${index + 1}`"
                :aria-invalid="!isValidCoordinate(row.x) || undefined"
                class="num no-spinner h-8 w-full rounded-lg border border-gray-300 px-2 text-right text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                @input="updateCell(index, 'x', ($event.target as HTMLInputElement).value)"
              >
            </td>
            <td class="px-1 py-1">
              <input
                type="number"
                :value="row.y"
                step="any"
                placeholder="0.0"
                :aria-label="`${surface} surface Y, row ${index + 1}`"
                :aria-invalid="!isValidCoordinate(row.y) || undefined"
                class="num no-spinner h-8 w-full rounded-lg border border-gray-300 px-2 text-right text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                @input="updateCell(index, 'y', ($event.target as HTMLInputElement).value)"
              >
            </td>
            <td class="px-1 py-1 text-center">
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-error-50 hover:text-error-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                :aria-label="`Delete ${surface} row ${index + 1}`"
                title="Delete row"
                @click="removeRow(index)"
              >
                <Icon name="heroicons:trash-20-solid" class="h-4 w-4" aria-hidden="true" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <VButton
        type="button"
        color="light"
        size="sm"
        :disabled="rows.length >= maxRows"
        @click="addRow"
      >
        <Icon name="heroicons:plus-20-solid" class="h-4 w-4" aria-hidden="true" />
        Add row
      </VButton>
      <VButton
        v-if="rows.length > 0"
        type="button"
        color="light"
        size="sm"
        @click="clearAll"
      >
        Clear all
      </VButton>
      <span class="ml-auto text-xs text-gray-500">
        <span class="num">{{ rows.length }}</span> row{{ rows.length !== 1 ? 's' : '' }} (max <span class="num">{{ maxRows }}</span>)
      </span>
    </div>

    <div v-if="hasErrors" class="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-800" role="alert">
      Some coordinates contain invalid values. Please check and correct them.
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
