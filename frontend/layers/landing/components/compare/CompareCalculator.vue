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
    <div class="bg-white rounded-lg border border-gray-200 p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Objective Function Calculator</h3>
      <p class="text-sm text-gray-600 mb-4">Use the calculator below to define an objective function to understand the trade space</p>
      
      <div class="space-y-4">
        <!-- Formula Input -->
        <div class="relative">
          <label for="formula-input" class="block text-sm font-medium text-gray-700 mb-2">
            Enter formula (e.g., <code class="text-xs bg-gray-100 px-1 py-0.5 rounded">CLmax * 10 + maxLD / 10</code>)
          </label>
          <div class="relative">
            <input
              id="formula-input"
              ref="inputRef"
              v-model="formula"
              type="text"
              class="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
              placeholder="Enter formula..."
              @input="handleInput"
              @focus="handleInputFocus"
              @blur="handleInputBlur"
              @keydown="handleKeydown"
            />
            
            <!-- Autocomplete Dropdown -->
            <div
              v-if="showAutocomplete && autocompleteSuggestions.length > 0"
              class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
            >
              <div
                v-for="suggestion in autocompleteSuggestions"
                :key="suggestion.value"
                class="px-4 py-2 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                @mousedown.prevent="insertVariable(suggestion.value)"
              >
                <div class="flex items-center justify-between">
                  <span class="font-mono text-sm text-gray-900">{{ suggestion.value }}</span>
                  <span class="text-xs text-gray-500 ml-2">{{ suggestion.label }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Error Message -->
          <p v-if="error" class="mt-2 text-sm text-red-600">
            {{ error }}
          </p>
        </div>

        <!-- Available Variables -->
        <div>
          <p class="text-sm font-medium text-gray-700 mb-2">Available Variables:</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="variable in availableVariables"
              :key="variable.value"
              type="button"
              class="inline-flex items-center px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
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
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Results</h3>
      
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 bg-white rounded-lg border border-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  :class="{ 'bg-gray-100': sortColumn === 'name' }"
                  @click="handleSort('name')"
                >
                  <div class="flex items-center justify-between">
                    <span>Airfoil Name</span>
                    <Icon
                      v-if="sortColumn === 'name'"
                      :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                      class="h-4 w-4 ml-2"
                    />
                  </div>
                </th>
                <th
                  scope="col"
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  :class="{ 'bg-gray-100': sortColumn === 'value' }"
                  @click="handleSort('value')"
                >
                  <div class="flex items-center justify-between">
                    <span>Calculated Value</span>
                    <Icon
                      v-if="sortColumn === 'value'"
                      :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                      class="h-4 w-4 ml-2"
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr
                v-for="result in sortedResults"
                :key="result.name"
                class="hover:bg-gray-50 transition-colors"
              >
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ result.name }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                  <span v-if="result.error" class="text-red-600">{{ result.error }}</span>
                  <span v-else>{{ formatNumber(result.value) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!formula.trim()" class="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <Icon name="heroicons:calculator" class="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <p class="text-gray-500">Enter a formula above to see calculated results for each airfoil.</p>
    </div>

    <!-- No Results State -->
    <div v-else-if="formula.trim() && results.length === 0 && !error" class="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <p class="text-gray-500">No results to display. Please select airfoils from the sidebar.</p>
    </div>
  </div>
</template>
