<script setup lang="ts">
import type { AirfoilListItem } from '~/composables/useAirfoils'

interface Props {
  airfoils: AirfoilListItem[]
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
const showSelectedOnly = ref(false)

// Filter airfoils based on search query
const displayedAirfoils = computed(() => {
  let filtered = props.airfoils

  // Filter by selected-only mode
  if (showSelectedOnly.value) {
    filtered = filtered.filter(airfoil => props.modelValue.includes(airfoil.id))
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const searchTerm = searchQuery.value.trim().toLowerCase()
    filtered = filtered.filter(airfoil =>
      airfoil.name.toLowerCase().includes(searchTerm)
      || (airfoil.display_name?.toLowerCase().includes(searchTerm) ?? false),
    )
  }

  return filtered
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
  }
  else {
    // Select (only if under max)
    if (currentSelection.length < props.maxSelection) {
      currentSelection.push(airfoilId)
    }
  }

  emit('update:modelValue', currentSelection)
}

// Deselect all
const deselectAll = () => {
  emit('update:modelValue', [])
}

/** Toggle selected-only filter and clear the search input. */
const toggleShowSelected = () => {
  showSelectedOnly.value = !showSelectedOnly.value
  searchQuery.value = ''
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
  <div class="rounded-xl border border-gray-200 bg-white p-4">
    <!-- Header -->
    <div class="mb-3 flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-gray-900">Select Airfoils</h3>
      <VBadge :tone="isValidSelection ? 'success' : selectedCount === 0 ? 'error' : 'warning'">
        <span class="num">{{ selectedCount }} / {{ maxSelection }}</span> selected
      </VBadge>
    </div>

    <!-- Search Input -->
    <div class="mb-3">
      <VInput
        v-model="searchQuery"
        type="text"
        placeholder="Search airfoils by name..."
        size="sm"
        prepend-icon="heroicons:magnifying-glass-20-solid"
        icon-size="16"
        aria-label="Search airfoils by name"
      />
    </div>

    <!-- Batch Actions -->
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
      <div class="flex items-center gap-2">
        <VButton
          type="button"
          variant="ghost"
          color="primary"
          size="xs"
          class="font-medium"
          @click="deselectAll"
        >
          Deselect All
        </VButton>
        <span class="text-gray-300" aria-hidden="true">|</span>
        <VButton
          type="button"
          variant="ghost"
          color="primary"
          size="xs"
          class="font-medium"
          @click="toggleShowSelected"
        >
          {{ showSelectedOnly ? 'Show All' : 'Show Selected' }}
        </VButton>
      </div>
      <span v-if="searchQuery.trim() || showSelectedOnly" class="text-xs text-gray-500">
        Showing <span class="num">{{ displayedAirfoils.length }}</span> of <span class="num">{{ airfoils.length }}</span>
      </span>
    </div>

    <!-- Loading State -->
    <VStateBlock v-if="isLoading" variant="loading" description="Loading airfoils..." />

    <!-- Empty State -->
    <VStateBlock v-else-if="airfoils.length === 0" description="No airfoils match the current filters." />

    <!-- Airfoil List -->
    <div v-else class="-mx-1 max-h-96 space-y-0.5 overflow-y-auto">
      <label
        v-for="airfoil in displayedAirfoils"
        :key="airfoil.id"
        class="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors"
        :class="[
          isSelected(airfoil.id)
            ? 'bg-primary-50 hover:bg-primary-100'
            : 'hover:bg-gray-50',
          selectedCount >= maxSelection && !isSelected(airfoil.id)
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer',
        ]"
      >
        <input
          type="checkbox"
          :checked="isSelected(airfoil.id)"
          :disabled="selectedCount >= maxSelection && !isSelected(airfoil.id)"
          class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
          @change="toggleSelection(airfoil.id)"
        >
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium uppercase text-gray-900">
            {{ airfoil.name }}
          </div>
          <div class="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
            <span v-if="airfoil.thickness_pct !== null">
              Thickness <span class="num">{{ formatPercentage(airfoil.thickness_pct) }}</span>
            </span>
            <span v-if="airfoil.camber_pct !== null">
              Camber <span class="num">{{ formatPercentage(airfoil.camber_pct) }}</span>
            </span>
          </div>
        </div>
      </label>
    </div>

    <!-- Validation Message -->
    <p
      v-if="selectedCount > maxSelection"
      class="mt-3 border-t border-gray-200 pt-3 text-center text-xs text-warning-700"
    >
      Maximum {{ maxSelection }} airfoils allowed. Please deselect some airfoils.
    </p>
  </div>
</template>
