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
  'update-performance-mode': [mode: 'performance' | 'detail']
}>()

// Filter input refs
const maxCMRoughness = ref(props.filters.maxCMRoughness)
const minCMAtZero = ref(props.filters.minCMAtZero)
const minMaxLD = ref(props.filters.minMaxLD)
const minCLMax = ref(props.filters.minCLMax)
const targetCL = ref(props.filters.targetCL)
const targetAOA = ref(props.filters.targetAOA)

// Track which filters are enabled - INITIALIZE ONCE, don't recalculate from props
const filterEnabled = reactive({
  maxCMRoughness: props.filters.maxCMRoughness !== null,
  minCMAtZero: props.filters.minCMAtZero !== null,
  minMaxLD: props.filters.minMaxLD !== null,
  minCLMax: props.filters.minCLMax !== null,
  // Design CL and AOA are paired - enabled if EITHER has a value initially
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
  set: (val) => { minMaxLD.value = val }
})

const minCLMaxSlider = computed({
  get: () => minCLMax.value ?? (props.filterRanges?.clMax.min ?? 0),
  set: (val) => { minCLMax.value = val }
})

// Watch filter changes from parent - UPDATE VALUES ONLY, not enabled state
watch(
  () => props.filters,
  (newFilters) => {
    maxCMRoughness.value = newFilters.maxCMRoughness
    minCMAtZero.value = newFilters.minCMAtZero
    minMaxLD.value = newFilters.minMaxLD
    minCLMax.value = newFilters.minCLMax
    targetCL.value = newFilters.targetCL
    targetAOA.value = newFilters.targetAOA
    
    // DO NOT recalculate enabled state from values - let user control it via checkbox
    // Only update enabled state if ALL values for a filter become null (filter was cleared externally)
    if (newFilters.maxCMRoughness === null) filterEnabled.maxCMRoughness = false
    if (newFilters.minCMAtZero === null) filterEnabled.minCMAtZero = false
    if (newFilters.minMaxLD === null) filterEnabled.minMaxLD = false
    if (newFilters.minCLMax === null) filterEnabled.minCLMax = false
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
  emit('update-filter', 'minMaxLD', filterEnabled.minMaxLD ? val : null)
})
watch(minCLMax, (val) => {
  emit('update-filter', 'minCLMax', filterEnabled.minCLMax ? val : null)
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
watch(() => filterEnabled.minMaxLD, (enabled) => {
  emit('update-filter', 'minMaxLD', enabled ? minMaxLD.value : null)
})
watch(() => filterEnabled.minCLMax, (enabled) => {
  emit('update-filter', 'minCLMax', enabled ? minCLMax.value : null)
})
// Design CL and AOA are paired - update both together
watch(() => filterEnabled.targetDesign, (enabled) => {
  emit('update-filter', 'targetCL', enabled ? targetCL.value : null)
  emit('update-filter', 'targetAOA', enabled ? targetAOA.value : null)
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
        <div v-if="dataContext && (dataContext.Re || dataContext.Mach !== undefined)" class="pt-2 mt-2 border-t border-gray-200"></div>
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
        <!-- Target CL and Target AOA (Paired Filter) -->
        <div>
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <input
              type="checkbox"
              v-model="filterEnabled.targetDesign"
              class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            Design CL & AOA
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

            <!-- Target AOA -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1 whitespace-nowrap">Design AOA (deg)</label>
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

        <!-- Min Max L/D -->
        <div v-if="filterRanges">
          <div class="flex items-center justify-between mb-1">
            <label class="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                v-model="filterEnabled.minMaxLD"
                class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              Min Max L/D
            </label>
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
            :disabled="!filterEnabled.minMaxLD"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div class="flex justify-between mt-1">
            <span class="text-xs text-gray-500">{{ filterRanges.maxLD.min.toFixed(2) }}</span>
            <span class="text-xs text-gray-500">{{ filterRanges.maxLD.max.toFixed(2) }}</span>
          </div>
        </div>
        <div v-else>
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <input
              type="checkbox"
              v-model="filterEnabled.minMaxLD"
              class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            Min Max L/D
          </label>
          <VInput
            :model-value="minMaxLD ?? undefined"
            @update:model-value="minMaxLD = $event as number | null"
            type="number"
            step="0.1"
            placeholder="No limit"
            size="sm"
            wrapper-class="w-full"
            :disabled="!filterEnabled.minMaxLD"
          />
        </div>

        <!-- Min CL Max -->
        <div v-if="filterRanges">
          <div class="flex items-center justify-between mb-1">
            <label class="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                v-model="filterEnabled.minCLMax"
                class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              Min CL Max
            </label>
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
            :disabled="!filterEnabled.minCLMax"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div class="flex justify-between mt-1">
            <span class="text-xs text-gray-500">{{ filterRanges.clMax.min.toFixed(3) }}</span>
            <span class="text-xs text-gray-500">{{ filterRanges.clMax.max.toFixed(3) }}</span>
          </div>
        </div>
        <div v-else>
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <input
              type="checkbox"
              v-model="filterEnabled.minCLMax"
              class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            Min CL Max
          </label>
          <VInput
            :model-value="minCLMax ?? undefined"
            @update:model-value="minCLMax = $event as number | null"
            type="number"
            step="0.01"
            placeholder="No limit"
            size="sm"
            wrapper-class="w-full"
            :disabled="!filterEnabled.minCLMax"
          />
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
            <label class="block text-xs text-gray-600 mb-1">Rendering Mode</label>
            <select
              :value="performanceMode || 'performance'"
              @change="emit('update-performance-mode', ($event.target as HTMLSelectElement).value as 'performance' | 'detail')"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="performance">Performance (Recommended)</option>
              <option value="detail">High Detail</option>
            </select>
            <p class="text-xs text-gray-500 mt-1">
              Performance mode reduces data points for faster rendering with large datasets.
            </p>
          </div>
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

