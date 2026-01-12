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
    nCrit?: number
    alphaMin?: number
    alphaMax?: number
    source?: string
  }
  filterRanges?: {
    smoothness_CM: { min: number; max: number }
    cmAtZero: { min: number; max: number }
    maxLD: { min: number; max: number }
    clMax: { min: number; max: number }
  }
  performanceMode?: 'performance' | 'detail'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update-filter': [key: keyof FilterState, value: any]
  'set-selected': [names: string[]]
  'toggle-selection': [name: string]
  'select-all': []
  'deselect-all': []
  'reset-filters': []
  'reset-analysis': []
  'update-performance-mode': [mode: 'performance' | 'detail']
}>()

// Filter input refs
const maxCMRoughness = ref(props.filters.maxCMRoughness)
const minCMAtZero = ref(props.filters.minCMAtZero)
const minMaxLD = ref(props.filters.minMaxLD)
const maxMaxLD = ref(props.filters.maxMaxLD)
const minCLMax = ref(props.filters.minCLMax)
const maxCLMax = ref(props.filters.maxCLMax)
const targetCL = ref(props.filters.targetCL)
const targetAOA = ref(props.filters.targetAOA)

// Track which filters are enabled - INITIALIZE ONCE, don't recalculate from props
const filterEnabled = reactive({
  maxCMRoughness: props.filters.maxCMRoughness !== null,
  minCMAtZero: props.filters.minCMAtZero !== null,
  maxLD: props.filters.minMaxLD !== null || props.filters.maxMaxLD !== null,
  clMax: props.filters.minCLMax !== null || props.filters.maxCLMax !== null,
  // Design CL and α are paired - enabled if EITHER has a value initially
  targetDesign: props.filters.targetCL !== null || props.filters.targetAOA !== null,
})

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
  set: (val) => {
    minMaxLD.value = val
    // Ensure max is always >= min
    if (maxMaxLD.value !== null && val > maxMaxLD.value) {
      maxMaxLD.value = val
    }
  }
})

const maxMaxLDSlider = computed({
  get: () => maxMaxLD.value ?? (props.filterRanges?.maxLD.max ?? 0),
  set: (val) => {
    maxMaxLD.value = val
    // Ensure min is always <= max
    if (minMaxLD.value !== null && val < minMaxLD.value) {
      minMaxLD.value = val
    }
  }
})

const minCLMaxSlider = computed({
  get: () => minCLMax.value ?? (props.filterRanges?.clMax.min ?? 0),
  set: (val) => {
    minCLMax.value = val
    // Ensure max is always >= min
    if (maxCLMax.value !== null && val > maxCLMax.value) {
      maxCLMax.value = val
    }
  }
})

const maxCLMaxSlider = computed({
  get: () => maxCLMax.value ?? (props.filterRanges?.clMax.max ?? 0),
  set: (val) => {
    maxCLMax.value = val
    // Ensure min is always <= max
    if (minCLMax.value !== null && val < minCLMax.value) {
      minCLMax.value = val
    }
  }
})

// Watch filter changes from parent - UPDATE VALUES ONLY, not enabled state
watch(
  () => props.filters,
  (newFilters) => {
    maxCMRoughness.value = newFilters.maxCMRoughness
    minCMAtZero.value = newFilters.minCMAtZero
    minMaxLD.value = newFilters.minMaxLD
    maxMaxLD.value = newFilters.maxMaxLD
    minCLMax.value = newFilters.minCLMax
    maxCLMax.value = newFilters.maxCLMax
    targetCL.value = newFilters.targetCL
    targetAOA.value = newFilters.targetAOA

    // DO NOT recalculate enabled state from values - let user control it via checkbox
    // Only update enabled state if ALL values for a filter become null (filter was cleared externally)
    if (newFilters.maxCMRoughness === null) filterEnabled.maxCMRoughness = false
    if (newFilters.minCMAtZero === null) filterEnabled.minCMAtZero = false
    if (newFilters.minMaxLD === null && newFilters.maxMaxLD === null) filterEnabled.maxLD = false
    if (newFilters.minCLMax === null && newFilters.maxCLMax === null) filterEnabled.clMax = false
    if (newFilters.targetCL === null && newFilters.targetAOA === null) filterEnabled.targetDesign = false
  },
  { deep: true }
)

// Emit filter updates (only when enabled)
watch(maxCMRoughness, (val) => {
  emit('update-filter', 'maxCMRoughness', filterEnabled.maxCMRoughness ? val : null)
})
watch(minCMAtZero, (val) => {
  emit('update-filter', 'minCMAtZero', filterEnabled.minCMAtZero ? val : null)
})
watch(minMaxLD, (val) => {
  emit('update-filter', 'minMaxLD', filterEnabled.maxLD ? val : null)
})
watch(maxMaxLD, (val) => {
  emit('update-filter', 'maxMaxLD', filterEnabled.maxLD ? val : null)
})
watch(minCLMax, (val) => {
  emit('update-filter', 'minCLMax', filterEnabled.clMax ? val : null)
})
watch(maxCLMax, (val) => {
  emit('update-filter', 'maxCLMax', filterEnabled.clMax ? val : null)
})
watch(targetCL, (val) => {
  emit('update-filter', 'targetCL', filterEnabled.targetDesign ? val : null)
})
watch(targetAOA, (val) => {
  emit('update-filter', 'targetAOA', filterEnabled.targetDesign ? val : null)
})

// Watch enabled state changes
watch(() => filterEnabled.maxCMRoughness, (enabled) => {
  emit('update-filter', 'maxCMRoughness', enabled ? maxCMRoughness.value : null)
})
watch(() => filterEnabled.minCMAtZero, (enabled) => {
  emit('update-filter', 'minCMAtZero', enabled ? minCMAtZero.value : null)
})
watch(() => filterEnabled.maxLD, (enabled) => {
  emit('update-filter', 'minMaxLD', enabled ? minMaxLD.value : null)
  emit('update-filter', 'maxMaxLD', enabled ? maxMaxLD.value : null)
})
watch(() => filterEnabled.clMax, (enabled) => {
  emit('update-filter', 'minCLMax', enabled ? minCLMax.value : null)
  emit('update-filter', 'maxCLMax', enabled ? maxCLMax.value : null)
})
// Design CL and α are paired - update both together
watch(() => filterEnabled.targetDesign, (enabled) => {
  emit('update-filter', 'targetCL', enabled ? targetCL.value : null)
  emit('update-filter', 'targetAOA', enabled ? targetAOA.value : null)
})

// Search functionality for Analyzed Airfoils
const searchQuery = ref('')
const showSelectedOnly = ref(false)

// Filter the airfoils based on search query and selected-only mode
const visibleAirfoils = computed(() => {
  let result = props.filteredAirfoils

  // Filter to show only selected airfoils if in that mode
  if (showSelectedOnly.value) {
    result = result.filter(name => props.selectedAirfoils.includes(name))
  }

  // Further filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(name =>
      name.toLowerCase().includes(query)
    )
  }

  return result
})

const handleSelectAll = () => {
  if (searchQuery.value.trim()) {
    // Select all visible airfoils
    const newSelection = new Set([...props.selectedAirfoils, ...visibleAirfoils.value])
    emit('set-selected', Array.from(newSelection))
  } else {
    emit('select-all')
  }
}

const handleDeselectAll = () => {
  if (searchQuery.value.trim()) {
    // Deselect all visible airfoils
    const visibleSet = new Set(visibleAirfoils.value)
    const newSelection = props.selectedAirfoils.filter(name => !visibleSet.has(name))
    emit('set-selected', newSelection)
  } else {
    emit('deselect-all')
  }
}

const handleShowSelected = () => {
  showSelectedOnly.value = !showSelectedOnly.value
  // Clear search when toggling selected view
  if (showSelectedOnly.value) {
    searchQuery.value = ''
  }
}

const handleResetFilters = () => {
  emit('reset-filters')
}

const handleResetAnalysis = () => {
  emit('reset-analysis')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Combined Info Card -->
    <div class="bg-white rounded-lg shadow p-4">
      <div class="space-y-2 text-sm">
        <div v-if="dataContext && dataContext.Re" class="flex justify-between">
          <span class="text-gray-600">Reynolds Number:</span>
          <span class="font-semibold text-gray-900">{{ dataContext.Re.toLocaleString() }}</span>
        </div>
        <div v-if="dataContext && dataContext.Mach !== undefined" class="flex justify-between">
          <span class="text-gray-600">Mach Number:</span>
          <span class="font-semibold text-gray-900">{{ dataContext.Mach }}</span>
        </div>
        <div v-if="dataContext && dataContext.nCrit !== undefined" class="flex justify-between">
          <span class="text-gray-600">N_crit:</span>
          <span class="font-semibold text-gray-900">{{ dataContext.nCrit }}</span>
        </div>
        <div v-if="dataContext && (dataContext.alphaMin !== undefined || dataContext.alphaMax !== undefined)" class="flex justify-between">
          <span class="text-gray-600">Alpha Range:</span>
          <span class="font-semibold text-gray-900">
            {{ dataContext.alphaMin !== undefined ? dataContext.alphaMin : '—' }}° to {{ dataContext.alphaMax !== undefined ? dataContext.alphaMax : '—' }}°
          </span>
        </div>
        <div v-if="dataContext && (dataContext.Re || dataContext.Mach !== undefined || dataContext.nCrit !== undefined || dataContext.alphaMin !== undefined || dataContext.alphaMax !== undefined)" class="pt-2 mt-2 border-t border-gray-200"></div>
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
        <!-- Target CL and Target α (Paired Filter) -->
        <div>
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <input
              type="checkbox"
              v-model="filterEnabled.targetDesign"
              class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            Design CL & α
          </label>
          <div class="grid grid-cols-2 gap-4">
            <!-- Target CL -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Design CL</label>
              <VInput
                :model-value="targetCL ?? undefined"
                @update:model-value="targetCL = $event as number | null"
                type="number"
                step="0.01"
                placeholder="No target"
                size="sm"
                wrapper-class="w-full"
                :disabled="!filterEnabled.targetDesign"
              />
              <p class="mt-1 text-xs text-gray-500">
                Tolerance: ±0.1
              </p>
            </div>

            <!-- Target α -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1 whitespace-nowrap">Design α (deg)</label>
              <VInput
                :model-value="targetAOA ?? undefined"
                @update:model-value="targetAOA = $event as number | null"
                type="number"
                step="0.5"
                placeholder="No target"
                size="sm"
                wrapper-class="w-full"
                :disabled="!filterEnabled.targetDesign"
              />
              <p class="mt-1 text-xs text-gray-500">
                Tolerance: ±0.5°
              </p>
            </div>
          </div>
        </div>

        <!-- Max L/D Range -->
        <div v-if="filterRanges">
          <div class="flex items-center justify-between mb-1">
            <label class="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                v-model="filterEnabled.maxLD"
                class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              Max L/D Range
            </label>
            <span class="text-sm font-semibold text-indigo-600">
              <template v-if="minMaxLD !== null || maxMaxLD !== null">
                {{ minMaxLD !== null ? minMaxLD.toFixed(1) : filterRanges.maxLD.min.toFixed(1) }} - {{ maxMaxLD !== null ? maxMaxLD.toFixed(1) : filterRanges.maxLD.max.toFixed(1) }}
              </template>
              <template v-else>No limit</template>
            </span>
          </div>
          <!-- Min slider -->
          <div class="space-y-1">
            <div class="flex justify-between text-xs text-gray-600">
              <span>Min</span>
              <span>{{ minMaxLD !== null ? minMaxLD.toFixed(1) : filterRanges.maxLD.min.toFixed(1) }}</span>
            </div>
            <input
              v-model.number="minMaxLDSlider"
              type="range"
              :min="filterRanges.maxLD.min"
              :max="filterRanges.maxLD.max"
              step="0.1"
              :disabled="!filterEnabled.maxLD"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <!-- Max slider -->
          <div class="space-y-1 mt-2">
            <div class="flex justify-between text-xs text-gray-600">
              <span>Max</span>
              <span>{{ maxMaxLD !== null ? maxMaxLD.toFixed(1) : filterRanges.maxLD.max.toFixed(1) }}</span>
            </div>
            <input
              v-model.number="maxMaxLDSlider"
              type="range"
              :min="filterRanges.maxLD.min"
              :max="filterRanges.maxLD.max"
              step="0.1"
              :disabled="!filterEnabled.maxLD"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div class="flex justify-between mt-1">
            <span class="text-xs text-gray-500">{{ filterRanges.maxLD.min.toFixed(1) }}</span>
            <span class="text-xs text-gray-500">{{ filterRanges.maxLD.max.toFixed(1) }}</span>
          </div>
        </div>
        <div v-else>
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <input
              type="checkbox"
              v-model="filterEnabled.maxLD"
              class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            Max L/D Range
          </label>
          <div class="grid grid-cols-2 gap-2">
            <VInput
              :model-value="minMaxLD ?? undefined"
              @update:model-value="minMaxLD = $event as number | null"
              type="number"
              step="0.1"
              placeholder="Min"
              size="sm"
              wrapper-class="w-full"
              :disabled="!filterEnabled.maxLD"
            />
            <VInput
              :model-value="maxMaxLD ?? undefined"
              @update:model-value="maxMaxLD = $event as number | null"
              type="number"
              step="0.1"
              placeholder="Max"
              size="sm"
              wrapper-class="w-full"
              :disabled="!filterEnabled.maxLD"
            />
          </div>
        </div>

        <!-- CL Max Range -->
        <div v-if="filterRanges">
          <div class="flex items-center justify-between mb-1">
            <label class="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                v-model="filterEnabled.clMax"
                class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              CL Max Range
            </label>
            <span class="text-sm font-semibold text-indigo-600">
              <template v-if="minCLMax !== null || maxCLMax !== null">
                {{ minCLMax !== null ? minCLMax.toFixed(2) : filterRanges.clMax.min.toFixed(2) }} - {{ maxCLMax !== null ? maxCLMax.toFixed(2) : filterRanges.clMax.max.toFixed(2) }}
              </template>
              <template v-else>No limit</template>
            </span>
          </div>
          <!-- Min slider -->
          <div class="space-y-1">
            <div class="flex justify-between text-xs text-gray-600">
              <span>Min</span>
              <span>{{ minCLMax !== null ? minCLMax.toFixed(2) : filterRanges.clMax.min.toFixed(2) }}</span>
            </div>
            <input
              v-model.number="minCLMaxSlider"
              type="range"
              :min="filterRanges.clMax.min"
              :max="filterRanges.clMax.max"
              step="0.01"
              :disabled="!filterEnabled.clMax"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <!-- Max slider -->
          <div class="space-y-1 mt-2">
            <div class="flex justify-between text-xs text-gray-600">
              <span>Max</span>
              <span>{{ maxCLMax !== null ? maxCLMax.toFixed(2) : filterRanges.clMax.max.toFixed(2) }}</span>
            </div>
            <input
              v-model.number="maxCLMaxSlider"
              type="range"
              :min="filterRanges.clMax.min"
              :max="filterRanges.clMax.max"
              step="0.01"
              :disabled="!filterEnabled.clMax"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div class="flex justify-between mt-1">
            <span class="text-xs text-gray-500">{{ filterRanges.clMax.min.toFixed(2) }}</span>
            <span class="text-xs text-gray-500">{{ filterRanges.clMax.max.toFixed(2) }}</span>
          </div>
        </div>
        <div v-else>
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <input
              type="checkbox"
              v-model="filterEnabled.clMax"
              class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            CL Max Range
          </label>
          <div class="grid grid-cols-2 gap-2">
            <VInput
              :model-value="minCLMax ?? undefined"
              @update:model-value="minCLMax = $event as number | null"
              type="number"
              step="0.01"
              placeholder="Min"
              size="sm"
              wrapper-class="w-full"
              :disabled="!filterEnabled.clMax"
            />
            <VInput
              :model-value="maxCLMax ?? undefined"
              @update:model-value="maxCLMax = $event as number | null"
              type="number"
              step="0.01"
              placeholder="Max"
              size="sm"
              wrapper-class="w-full"
              :disabled="!filterEnabled.clMax"
            />
          </div>
        </div>

        <!-- Max CM Roughness -->
        <div v-if="filterRanges">
          <div class="flex items-center justify-between mb-1">
            <label class="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                v-model="filterEnabled.maxCMRoughness"
                class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
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
            :disabled="!filterEnabled.maxCMRoughness"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <input
              type="checkbox"
              v-model="filterEnabled.maxCMRoughness"
              class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            Max CM Roughness (smoothness_CM ≤)
          </label>
          <VInput
            :model-value="maxCMRoughness ?? undefined"
            @update:model-value="maxCMRoughness = $event as number | null"
            type="number"
            step="0.01"
            placeholder="No limit"
            size="sm"
            wrapper-class="w-full"
            :disabled="!filterEnabled.maxCMRoughness"
          />
          <p class="mt-1 text-xs text-gray-500">
            Lower values = smoother moment curve
          </p>
        </div>

        <!-- Min CM at α = 0° -->
        <div v-if="filterRanges">
          <div class="flex items-center justify-between mb-1">
            <label class="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                v-model="filterEnabled.minCMAtZero"
                class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
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
            :disabled="!filterEnabled.minCMAtZero"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div class="flex justify-between mt-1">
            <span class="text-xs text-gray-500">{{ filterRanges.cmAtZero.min.toFixed(3) }}</span>
            <span class="text-xs text-gray-500">{{ filterRanges.cmAtZero.max.toFixed(3) }}</span>
          </div>
        </div>
        <div v-else>
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <input
              type="checkbox"
              v-model="filterEnabled.minCMAtZero"
              class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            Min CM at α = 0°
          </label>
          <VInput
            :model-value="minCMAtZero ?? undefined"
            @update:model-value="minCMAtZero = $event as number | null"
            type="number"
            step="0.01"
            placeholder="No limit"
            size="sm"
            wrapper-class="w-full"
            :disabled="!filterEnabled.minCMAtZero"
          />
        </div>

        <!-- Rendering Mode -->
        <div class="pt-4 border-t border-gray-200">
          <div class="space-y-2">
            <div class="flex items-center gap-1 mb-1">
              <label class="block text-xs text-gray-600">Rendering Mode</label>
              <div class="group relative">
                <Icon name="heroicons:question-mark-circle" class="h-4 w-4 text-gray-400 cursor-help" />
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  Performance mode reduces data points for faster rendering with large datasets.
                  <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
            <select
              :value="performanceMode || 'performance'"
              @change="emit('update-performance-mode', ($event.target as HTMLSelectElement).value as 'performance' | 'detail')"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="performance">Performance (Recommended)</option>
              <option value="detail">High Detail</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Airfoil Selection Section -->
    <div class="bg-white rounded-lg shadow p-4">
      <h2 class="text-lg font-semibold text-gray-900 mb-2">Analyzed Airfoils</h2>
      
      <!-- Search Bar -->
      <div class="mb-3">
        <div class="relative rounded-md shadow-sm">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Icon name="heroicons:magnifying-glass" class="h-4 w-4 text-gray-400" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            class="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Search airfoils..."
          />
        </div>
      </div>

      <div class="flex gap-2 mb-4">
        <button
          type="button"
          class="text-xs text-indigo-600 hover:text-indigo-800"
          @click="handleSelectAll"
        >
          Show All
        </button>
        <span class="text-gray-300">|</span>
        <button
          type="button"
          class="text-xs text-indigo-600 hover:text-indigo-800"
          @click="handleDeselectAll"
        >
          Hide All
        </button>
        <span class="text-gray-300">|</span>
        <button
          type="button"
          :class="[
            'text-xs transition-colors',
            showSelectedOnly
              ? 'text-red-600 hover:text-red-800'
              : 'text-indigo-600 hover:text-indigo-800'
          ]"
          @click="handleShowSelected"
        >
          {{ showSelectedOnly ? 'Show All' : 'Show Selected' }}
        </button>
      </div>

      <div v-if="filteredAirfoils.length === 0" class="text-sm text-gray-500 text-center py-4">
        No airfoils match the current filters. Try relaxing your filter criteria.
      </div>

      <div v-else class="space-y-2 max-h-96 overflow-y-auto">
        <label
          v-for="name in visibleAirfoils"
          :key="name"
          class="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
        >
          <input
            type="checkbox"
            :checked="selectedAirfoils.includes(name)"
            class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            @change="emit('toggle-selection', name)"
          />
          <span class="text-sm text-gray-700 flex-1">{{ name.toUpperCase() }}</span>
        </label>
      </div>

      <!-- Reset Analysis Button -->
      <div class="pt-4 border-t border-gray-200 mt-4">
        <button
          type="button"
          class="w-full px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          @click="handleResetAnalysis"
        >
          Reset Analysis
        </button>
      </div>
    </div>
  </div>
</template>

