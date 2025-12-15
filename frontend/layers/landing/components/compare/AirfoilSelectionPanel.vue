<script setup lang="ts">
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

interface Props {
  airfoils: Airfoil[]
  modelValue: string[] // Selected airfoil IDs
  maxSelection?: number
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxSelection: 300,
  isLoading: false,
})

const emit = defineEmits<{
  'update:modelValue': [ids: string[]]
}>()

const searchQuery = ref('')

// Filter airfoils based on search query
const displayedAirfoils = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.airfoils
  }
  const searchTerm = searchQuery.value.trim().toLowerCase()
  return props.airfoils.filter(airfoil =>
    airfoil.name.toLowerCase().includes(searchTerm)
  )
})

// Selected count
const selectedCount = computed(() => props.modelValue.length)

// Validation state
const isValidSelection = computed(() => {
  return selectedCount.value > 0 && selectedCount.value <= props.maxSelection
})

// Toggle airfoil selection
const toggleSelection = (airfoilId: string) => {
  const currentSelection = [...props.modelValue]
  const index = currentSelection.indexOf(airfoilId)
  
  if (index >= 0) {
    // Deselect
    currentSelection.splice(index, 1)
  } else {
    // Select (only if under max)
    if (currentSelection.length < props.maxSelection) {
      currentSelection.push(airfoilId)
    }
  }
  
  emit('update:modelValue', currentSelection)
}

// Select all visible
const selectAllVisible = () => {
  const visibleIds = displayedAirfoils.value.map(a => a.id)
  const currentSelection = [...props.modelValue]
  const newSelection = [...new Set([...currentSelection, ...visibleIds])]
  
  // Limit to maxSelection
  if (newSelection.length > props.maxSelection) {
    emit('update:modelValue', newSelection.slice(0, props.maxSelection))
  } else {
    emit('update:modelValue', newSelection)
  }
}

// Deselect all
const deselectAll = () => {
  emit('update:modelValue', [])
}

// Check if airfoil is selected
const isSelected = (airfoilId: string) => {
  return props.modelValue.includes(airfoilId)
}

// Format percentage
const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A'
  return (value * 100).toFixed(1) + '%'
}
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-semibold text-gray-900">Select Airfoils</h3>
      <div class="flex items-center gap-2">
        <span
          :class="[
            'text-xs font-medium px-2 py-1 rounded',
            isValidSelection
              ? 'bg-green-100 text-green-800'
              : selectedCount === 0
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          ]"
        >
          {{ selectedCount }} / {{ maxSelection }} selected
        </span>
      </div>
    </div>

    <!-- Search Input -->
    <div class="mb-4">
      <VInput
        v-model="searchQuery"
        type="text"
        placeholder="Search airfoils by name..."
        size="sm"
        prepend-icon="heroicons:magnifying-glass-20-solid"
      />
    </div>

    <!-- Batch Actions -->
    <div class="mb-4 pb-4 border-b border-gray-200">
      <div class="flex items-center gap-2 mb-2">
        <button
          type="button"
          class="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          @click="selectAllVisible"
        >
          Select All Visible
        </button>
        <span class="text-gray-300">|</span>
        <button
          type="button"
          class="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          @click="deselectAll"
        >
          Deselect All
        </button>
      </div>
      <div v-if="searchQuery.trim()" class="text-xs text-gray-500">
        Showing {{ displayedAirfoils.length }} of {{ airfoils.length }}
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
      <p class="mt-2 text-sm text-gray-600">Loading airfoils...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="airfoils.length === 0" class="text-center py-8">
      <p class="text-sm text-gray-500">No airfoils match the current filters.</p>
    </div>

    <!-- Airfoil List -->
    <div v-else class="max-h-96 overflow-y-auto space-y-1">
      <div
        v-for="airfoil in displayedAirfoils"
        :key="airfoil.id"
        :class="[
          'flex items-center gap-3 p-2 rounded cursor-pointer transition-colors',
          isSelected(airfoil.id)
            ? 'bg-indigo-50 hover:bg-indigo-100'
            : 'hover:bg-gray-50',
          selectedCount >= maxSelection && !isSelected(airfoil.id)
            ? 'opacity-50 cursor-not-allowed'
            : ''
        ]"
        @click="toggleSelection(airfoil.id)"
      >
        <input
          type="checkbox"
          :checked="isSelected(airfoil.id)"
          :disabled="selectedCount >= maxSelection && !isSelected(airfoil.id)"
          class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50 pointer-events-none"
        />
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-900 truncate uppercase">
            {{ airfoil.name }}
          </div>
          <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span v-if="airfoil.thickness_pct !== null">
              Thickness: {{ formatPercentage(airfoil.thickness_pct) }}
            </span>
            <span v-if="airfoil.camber_pct !== null">
              Camber: {{ formatPercentage(airfoil.camber_pct) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Validation Message -->
    <div v-if="!isValidSelection" class="mt-4 pt-4 border-t border-gray-200">
      <p
        :class="[
          'text-xs text-center',
          selectedCount === 0 ? 'text-red-600' : 'text-yellow-600'
        ]"
      >
        <span v-if="selectedCount === 0">
          Please select at least 1 airfoil to analyze.
        </span>
        <span v-else>
          Maximum {{ maxSelection }} airfoils allowed. Please deselect some airfoils.
        </span>
      </p>
    </div>
  </div>
</template>

