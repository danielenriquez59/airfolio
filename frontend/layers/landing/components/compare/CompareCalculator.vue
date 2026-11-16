<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useCalculator, type SummaryRow } from '~/composables/useCalculator'

interface Props {
  summaryData: SummaryRow[]
  designAlpha?: number | null
}

const props = defineProps<Props>()

const { formula, error, getAvailableVariables, calculateResults, getAutocompleteSuggestions } = useCalculator()

// Autocomplete state
const showAutocomplete = ref(false)
const autocompleteSuggestions = ref<Array<{ value: string; label: string }>>([])
const inputRef = ref<HTMLInputElement | null>(null)
const cursorPosition = ref(0)

// Results
const results = ref<Array<{ name: string; value: number; error: string | null }>>([])

// Sort state
const sortColumn = ref<'name' | 'value'>('name')
const sortDirection = ref<'asc' | 'desc'>('asc')

// Debounced calculation
const debouncedCalculate = useDebounceFn(() => {
  results.value = calculateResults(props.summaryData)
}, 300)

// Watch formula changes
watch(formula, () => {
  if (formula.value.trim()) {
    debouncedCalculate()
  } else {
    results.value = []
    error.value = null
  }
})

// Watch summary data changes
watch(() => props.summaryData, () => {
  if (formula.value.trim()) {
    debouncedCalculate()
  }
}, { deep: true })

// Available variables - filter out ldAtDesignAlpha if designAlpha is not defined
const availableVariables = computed(() => {
  const allVars = getAvailableVariables()
  // Only show ldAtDesignAlpha if designAlpha is defined
  if (props.designAlpha === null || props.designAlpha === undefined) {
    return allVars.filter(v => v.value !== 'ldAtDesignAlpha')
  }
  return allVars
})

// Handle input focus/blur for autocomplete
const handleInputFocus = () => {
  updateAutocomplete()
  showAutocomplete.value = true
}

const handleInputBlur = () => {
  // Delay hiding to allow click on suggestion
  setTimeout(() => {
    showAutocomplete.value = false
  }, 200)
}

// Update autocomplete suggestions
const updateAutocomplete = () => {
  if (!inputRef.value) return
  
  const input = inputRef.value
  cursorPosition.value = input.selectionStart || 0
  const suggestions = getAutocompleteSuggestions(formula.value, cursorPosition.value)
  // Filter out ldAtDesignAlpha if designAlpha is not defined
  if (props.designAlpha === null || props.designAlpha === undefined) {
    autocompleteSuggestions.value = suggestions.filter(s => s.value !== 'ldAtDesignAlpha')
  } else {
    autocompleteSuggestions.value = suggestions
  }
}

// Handle input change
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  formula.value = target.value
  updateAutocomplete()
}

// Handle keydown for autocomplete navigation
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    // Could implement keyboard navigation here
    event.preventDefault()
  }
  if (event.key === 'Enter' && showAutocomplete.value && autocompleteSuggestions.value.length > 0) {
    // Insert first suggestion
    insertVariable(autocompleteSuggestions.value[0].value)
    event.preventDefault()
  }
}

// Insert variable at cursor position
const insertVariable = (varName: string) => {
  if (!inputRef.value) return
  
  const input = inputRef.value
  const start = input.selectionStart || 0
  const end = input.selectionEnd || start
  
  // Find word boundaries
  const beforeCursor = formula.value.substring(0, start)
  const afterCursor = formula.value.substring(end)
  
  // Check if we're replacing a partial variable name
  const match = beforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/)
  let newStart = start
  if (match) {
    newStart = start - match[1].length
  }
  
  const newFormula = formula.value.substring(0, newStart) + varName + formula.value.substring(end)
  formula.value = newFormula
  
  // Set cursor position after inserted variable
  setTimeout(() => {
    if (inputRef.value) {
      const newPosition = newStart + varName.length
      inputRef.value.setSelectionRange(newPosition, newPosition)
      inputRef.value.focus()
    }
  }, 0)
  
  showAutocomplete.value = false
}

// Sorted results
const sortedResults = computed(() => {
  const sorted = [...results.value].sort((a, b) => {
    if (sortColumn.value === 'name') {
      const result = a.name.localeCompare(b.name)
      return sortDirection.value === 'asc' ? result : -result
    } else {
      // Sort by value, handling NaN/errors
      if (isNaN(a.value) && isNaN(b.value)) return 0
      if (isNaN(a.value)) return 1
      if (isNaN(b.value)) return -1
      const result = a.value - b.value
      return sortDirection.value === 'asc' ? result : -result
    }
  })
  return sorted
})

// Handle sort
const handleSort = (column: 'name' | 'value') => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

// Format number for display
const formatNumber = (value: number, decimals = 6): string => {
  if (isNaN(value) || !isFinite(value)) return 'N/A'
  return value.toFixed(decimals)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Formula Input Section -->
    <div>
      <h3 class="text-base font-semibold text-gray-900">Objective Function Calculator</h3>
      <p class="mb-4 mt-0.5 text-sm text-gray-500">Use the calculator below to define an objective function to understand the trade space</p>

      <div class="space-y-4">
        <!-- Formula Input -->
        <div class="relative">
          <label for="formula-input" class="mb-1 block text-sm font-medium text-gray-700">
            Enter formula (e.g., <code class="rounded bg-gray-100 px-1 py-0.5 text-xs">CLmax * 10 + maxLD / 10</code>)
          </label>
          <div class="relative">
            <input
              id="formula-input"
              ref="inputRef"
              v-model="formula"
              type="text"
              class="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 font-mono text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Enter formula..."
              @input="handleInput"
              @focus="handleInputFocus"
              @blur="handleInputBlur"
              @keydown="handleKeydown"
            />

            <!-- Autocomplete Dropdown -->
            <div
              v-if="showAutocomplete && autocompleteSuggestions.length > 0"
              class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            >
              <div
                v-for="suggestion in autocompleteSuggestions"
                :key="suggestion.value"
                class="flex cursor-pointer items-center justify-between px-3 py-1.5 hover:bg-primary-50"
                @mousedown.prevent="insertVariable(suggestion.value)"
              >
                <span class="font-mono text-sm text-gray-900">{{ suggestion.value }}</span>
                <span class="ml-2 text-xs text-gray-500">{{ suggestion.label }}</span>
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <p v-if="error" class="mt-1 text-sm text-error-600">
            {{ error }}
          </p>
        </div>

        <!-- Available Variables -->
        <div>
          <p class="data-label mb-2">Available variables</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="variable in availableVariables"
              :key="variable.value"
              type="button"
              class="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-primary-300 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              @click="insertVariable(variable.value)"
            >
              <span class="font-mono">{{ variable.value }}</span>
              <span class="ml-1 text-gray-500">({{ variable.label }})</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Results Table -->
    <div v-if="results.length > 0">
      <h3 class="mb-3 text-base font-semibold text-gray-900">Results</h3>

      <div class="max-h-[60vh] overflow-auto rounded-lg border border-gray-200">
        <table class="min-w-full text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                :aria-sort="sortColumn === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
                class="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 p-0 text-left"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-1 px-3 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                  :class="{ 'text-gray-900': sortColumn === 'name' }"
                  @click="handleSort('name')"
                >
                  Airfoil Name
                  <Icon
                    :name="sortColumn === 'name' ? (sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down') : 'heroicons:chevron-up-down'"
                    class="h-3.5 w-3.5 shrink-0"
                    :class="sortColumn === 'name' ? 'text-primary-600' : 'text-gray-400'"
                    aria-hidden="true"
                  />
                </button>
              </th>
              <th
                scope="col"
                :aria-sort="sortColumn === 'value' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
                class="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 p-0 text-right"
              >
                <button
                  type="button"
                  class="flex w-full items-center justify-end gap-1 px-3 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                  :class="{ 'text-gray-900': sortColumn === 'value' }"
                  @click="handleSort('value')"
                >
                  Calculated Value
                  <Icon
                    :name="sortColumn === 'value' ? (sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down') : 'heroicons:chevron-up-down'"
                    class="h-3.5 w-3.5 shrink-0"
                    :class="sortColumn === 'value' ? 'text-primary-600' : 'text-gray-400'"
                    aria-hidden="true"
                  />
                </button>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="result in sortedResults"
              :key="result.name"
              class="hover:bg-gray-50"
            >
              <td class="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                {{ result.name }}
              </td>
              <td class="whitespace-nowrap px-3 py-2 text-right text-gray-700">
                <span v-if="result.error" class="text-error-600">{{ result.error }}</span>
                <span v-else class="num">{{ formatNumber(result.value) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty State -->
    <VStateBlock
      v-else-if="!formula.trim()"
      icon="heroicons:calculator"
      description="Enter a formula above to see calculated results for each airfoil."
      class="rounded-lg border border-dashed border-gray-300"
    />

    <!-- No Results State -->
    <VStateBlock
      v-else-if="formula.trim() && results.length === 0 && !error"
      description="No results to display. Please select airfoils from the sidebar."
      class="rounded-lg border border-dashed border-gray-300"
    />
  </div>
</template>
