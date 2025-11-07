<script setup lang="ts">
import type { FilterState } from '~/composables/useCompare'

interface Props {
  filters: FilterState
  filteredAirfoils: string[]
  selectedAirfoils: string[]
  totalCount: number
  dataContext?: {
    Re?: number
    Mach?: number
    source?: string
  }
  filterRanges?: {
    smoothness_CM: { min: number; max: number }
    cmAtZero: { min: number; max: number }
    maxLD: { min: number; max: number }
    clMax: { min: number; max: number }
  }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update-filter': [key: keyof FilterState, value: any]
  'set-selected': [names: string[]]
  'toggle-selection': [name: string]
  'select-all': []
  'deselect-all': []
  'reset-filters': []
}>()

// Filter input refs
const maxCMRoughness = ref(props.filters.maxCMRoughness)
const minCMAtZero = ref(props.filters.minCMAtZero)
const minMaxLD = ref(props.filters.minMaxLD)
const minCLMax = ref(props.filters.minCLMax)
const targetCL = ref(props.filters.targetCL)
const targetAOA = ref(props.filters.targetAOA)

// Computed properties for range sliders (handle null values)
const maxCMRoughnessSlider = computed({
  get: () => maxCMRoughness.value ?? (props.filterRanges?.smoothness_CM.max ?? 0),
  set: (val) => { maxCMRoughness.value = val }
})

const minCMAtZeroSlider = computed({
  get: () => minCMAtZero.value ?? (props.filterRanges?.cmAtZero.min ?? 0),
  set: (val) => { minCMAtZero.value = val }
})

const minMaxLDSlider = computed({
  get: () => minMaxLD.value ?? (props.filterRanges?.maxLD.min ?? 0),
  set: (val) => { minMaxLD.value = val }
})

const minCLMaxSlider = computed({
  get: () => minCLMax.value ?? (props.filterRanges?.clMax.min ?? 0),
  set: (val) => { minCLMax.value = val }
})

// Watch filter changes from parent
watch(
  () => props.filters,
  (newFilters) => {
    maxCMRoughness.value = newFilters.maxCMRoughness
    minCMAtZero.value = newFilters.minCMAtZero
    minMaxLD.value = newFilters.minMaxLD
    minCLMax.value = newFilters.minCLMax
    targetCL.value = newFilters.targetCL
    targetAOA.value = newFilters.targetAOA
  },
  { deep: true }
)

// Emit filter updates
watch(maxCMRoughness, (val) => {
  emit('update-filter', 'maxCMRoughness', val || null)
})
watch(minCMAtZero, (val) => {
  emit('update-filter', 'minCMAtZero', val || null)
})
watch(minMaxLD, (val) => {
  emit('update-filter', 'minMaxLD', val || null)
})
watch(minCLMax, (val) => {
  emit('update-filter', 'minCLMax', val || null)
})
watch(targetCL, (val) => {
  emit('update-filter', 'targetCL', val || null)
})
watch(targetAOA, (val) => {
  emit('update-filter', 'targetAOA', val || null)
})

const handleSelectAll = () => {
  emit('select-all')
}

const handleDeselectAll = () => {
  emit('deselect-all')
}

const handleResetFilters = () => {
  emit('reset-filters')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Data Context Info Card -->
    <div v-if="dataContext" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 class="text-sm font-semibold text-blue-900 mb-2">Analysis Context</h3>
      <div class="text-xs text-blue-800 space-y-1">
        <p v-if="dataContext.Re">
          <span class="font-medium">Reynolds Number:</span> {{ dataContext.Re.toLocaleString() }}
        </p>
        <p v-if="dataContext.Mach !== undefined">
          <span class="font-medium">Mach Number:</span> {{ dataContext.Mach }}
        </p>
        <p v-if="dataContext.source">
          <span class="font-medium">Source:</span> {{ dataContext.source }}
        </p>
      </div>
    </div>

    <!-- Counts Info Card -->
    <div class="bg-white rounded-lg shadow p-4">
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-600">Total Airfoils:</span>
          <span class="font-semibold text-gray-900">{{ totalCount }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Available after filtering:</span>
          <span class="font-semibold text-indigo-600">{{ filteredAirfoils.length }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Selected:</span>
          <span class="font-semibold text-green-600">{{ selectedAirfoils.length }}</span>
        </div>
      </div>
    </div>

    <!-- Filters Section -->
    <div class="bg-white rounded-lg shadow p-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Filters</h2>
        <button
          type="button"
          class="text-xs text-indigo-600 hover:text-indigo-800"
          @click="handleResetFilters"
        >
          Reset All
        </button>
      </div>

      <div class="space-y-4">
        <!-- Target CL and Target AOA -->
        <div class="grid grid-cols-2 gap-4">
          <!-- Target CL -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Design CL</label>
            <VInput
              v-model.number="targetCL"
              type="number"
              step="0.01"
              placeholder="No target"
              size="sm"
              wrapper-class="w-full"
            />
            <p class="mt-1 text-xs text-gray-500">
              Tolerance: ±0.1
            </p>
          </div>

          <!-- Target AOA -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Design AOA (deg)</label>
            <VInput
              v-model.number="targetAOA"
              type="number"
              step="0.5"
              placeholder="No target"
              size="sm"
              wrapper-class="w-full"
            />
            <p class="mt-1 text-xs text-gray-500">
              Tolerance: ±0.5°
            </p>
          </div>
        </div>

        <!-- Min Max L/D -->
        <div v-if="filterRanges">
          <div class="flex items-center justify-between mb-1">
            <label class="block text-sm font-medium text-gray-700">Min Max L/D</label>
            <span class="text-sm font-semibold text-indigo-600">
              {{ minMaxLD !== null && minMaxLD !== undefined ? minMaxLD.toFixed(2) : 'No limit' }}
            </span>
          </div>
          <input
            v-model.number="minMaxLDSlider"
            type="range"
            :min="filterRanges.maxLD.min"
            :max="filterRanges.maxLD.max"
            step="0.1"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div class="flex justify-between mt-1">
            <span class="text-xs text-gray-500">{{ filterRanges.maxLD.min.toFixed(2) }}</span>
            <span class="text-xs text-gray-500">{{ filterRanges.maxLD.max.toFixed(2) }}</span>
          </div>
        </div>
        <div v-else>
          <label class="block text-sm font-medium text-gray-700 mb-1">Min Max L/D</label>
          <VInput
            v-model.number="minMaxLD"
            type="number"
            step="0.1"
            placeholder="No limit"
            size="sm"
            wrapper-class="w-full"
          />
        </div>

        <!-- Min CL Max -->
        <div v-if="filterRanges">
          <div class="flex items-center justify-between mb-1">
            <label class="block text-sm font-medium text-gray-700">Min CL Max</label>
            <span class="text-sm font-semibold text-indigo-600">
              {{ minCLMax !== null && minCLMax !== undefined ? minCLMax.toFixed(3) : 'No limit' }}
            </span>
          </div>
          <input
            v-model.number="minCLMaxSlider"
            type="range"
            :min="filterRanges.clMax.min"
            :max="filterRanges.clMax.max"
            step="0.01"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div class="flex justify-between mt-1">
            <span class="text-xs text-gray-500">{{ filterRanges.clMax.min.toFixed(3) }}</span>
            <span class="text-xs text-gray-500">{{ filterRanges.clMax.max.toFixed(3) }}</span>
          </div>
        </div>
        <div v-else>
          <label class="block text-sm font-medium text-gray-700 mb-1">Min CL Max</label>
          <VInput
            v-model.number="minCLMax"
            type="number"
            step="0.01"
            placeholder="No limit"
            size="sm"
            wrapper-class="w-full"
          />
        </div>

        <!-- Max CM Roughness -->
        <div v-if="filterRanges">
          <div class="flex items-center justify-between mb-1">
            <label class="block text-sm font-medium text-gray-700">
              Max CM Roughness (smoothness_CM ≤)
            </label>
            <span class="text-sm font-semibold text-indigo-600">
              {{ maxCMRoughness !== null && maxCMRoughness !== undefined ? maxCMRoughness.toFixed(3) : 'No limit' }}
            </span>
          </div>
          <input
            v-model.number="maxCMRoughnessSlider"
            type="range"
            :min="filterRanges.smoothness_CM.min"
            :max="filterRanges.smoothness_CM.max"
            step="0.01"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div class="flex justify-between mt-1">
            <span class="text-xs text-gray-500">{{ filterRanges.smoothness_CM.min.toFixed(3) }}</span>
            <span class="text-xs text-gray-500">{{ filterRanges.smoothness_CM.max.toFixed(3) }}</span>
          </div>
          <p class="mt-1 text-xs text-gray-500">
            Lower values = smoother moment curve
          </p>
        </div>
        <div v-else>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Max CM Roughness (smoothness_CM ≤)
          </label>
          <VInput
            v-model.number="maxCMRoughness"
            type="number"
            step="0.01"
            placeholder="No limit"
            size="sm"
            wrapper-class="w-full"
          />
          <p class="mt-1 text-xs text-gray-500">
            Lower values = smoother moment curve
          </p>
        </div>

        <!-- Min CM at α = 0° -->
        <div v-if="filterRanges">
          <div class="flex items-center justify-between mb-1">
            <label class="block text-sm font-medium text-gray-700">
              Min CM at α = 0°
            </label>
            <span class="text-sm font-semibold text-indigo-600">
              {{ minCMAtZero !== null && minCMAtZero !== undefined ? minCMAtZero.toFixed(3) : 'No limit' }}
            </span>
          </div>
          <input
            v-model.number="minCMAtZeroSlider"
            type="range"
            :min="filterRanges.cmAtZero.min"
            :max="filterRanges.cmAtZero.max"
            step="0.01"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <div class="flex justify-between mt-1">
            <span class="text-xs text-gray-500">{{ filterRanges.cmAtZero.min.toFixed(3) }}</span>
            <span class="text-xs text-gray-500">{{ filterRanges.cmAtZero.max.toFixed(3) }}</span>
          </div>
        </div>
        <div v-else>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Min CM at α = 0°
          </label>
          <VInput
            v-model.number="minCMAtZero"
            type="number"
            step="0.01"
            placeholder="No limit"
            size="sm"
            wrapper-class="w-full"
          />
        </div>
      </div>
    </div>

    <!-- Airfoil Selection Section -->
    <div class="bg-white rounded-lg shadow p-4">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Selection</h2>
        <div class="flex gap-2">
          <button
            type="button"
            class="text-xs text-indigo-600 hover:text-indigo-800"
            @click="handleSelectAll"
          >
            Select All
          </button>
          <span class="text-gray-300">|</span>
          <button
            type="button"
            class="text-xs text-indigo-600 hover:text-indigo-800"
            @click="handleDeselectAll"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div v-if="filteredAirfoils.length === 0" class="text-sm text-gray-500 text-center py-4">
        No airfoils match the current filters. Try relaxing your filter criteria.
      </div>

      <div v-else class="space-y-2 max-h-96 overflow-y-auto">
        <label
          v-for="name in filteredAirfoils"
          :key="name"
          class="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
        >
          <input
            type="checkbox"
            :checked="selectedAirfoils.includes(name)"
            class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            @change="emit('toggle-selection', name)"
          />
          <span class="text-sm text-gray-700 flex-1">{{ name }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

