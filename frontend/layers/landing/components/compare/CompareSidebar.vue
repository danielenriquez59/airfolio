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
  filterRanges: {
    smoothness_CM: { min: number; max: number }
    cmAtZero: { min: number; max: number }
    maxLD: { min: number; max: number }
    clMax: { min: number; max: number }
    ldWidth: { min: number; max: number }
  }
  performanceMode?: 'performance' | 'detail'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update-filter': [key: keyof FilterState, value: any]
  'reset-filters': []
  'update-performance-mode': [mode: 'performance' | 'detail']
}>()

// Each checkbox enables a group of filter values
const groups = {
  maxCMRoughness: ['maxCMRoughness'],
  minCMAtZero: ['minCMAtZero'],
  maxLD: ['minMaxLD', 'maxMaxLD'],
  clMax: ['minCLMax', 'maxCLMax'],
  ldWidth: ['minLDWidth'],
  // Design CL and α are paired - enabled if EITHER has a value initially
  targetDesign: ['targetCL', 'targetAOA'],
} as const
type Group = keyof typeof groups
type FilterKey = typeof groups[Group][number]
type RangeKey = keyof Props['filterRanges']
const groupNames = Object.keys(groups) as Group[]
const filterKeys = groupNames.flatMap(g => groups[g]) as FilterKey[]

// Filter input values
const values = reactive(Object.fromEntries(filterKeys.map(k => [k, props.filters[k]])) as Record<FilterKey, number | null>)

// Track which filters are enabled - INITIALIZE ONCE, don't recalculate from props
const filterEnabled = reactive(Object.fromEntries(groupNames.map(g => [g, groups[g].some(k => props.filters[k] !== null)])) as Record<Group, boolean>)

// Range sliders: [value, data range, end shown while unset, paired value kept on the right side of it]
const sliderSpecs: [FilterKey, RangeKey, 'min' | 'max', FilterKey?][] = [
  ['maxCMRoughness', 'smoothness_CM', 'max'],
  ['minCMAtZero', 'cmAtZero', 'min'],
  ['minMaxLD', 'maxLD', 'min', 'maxMaxLD'],
  ['maxMaxLD', 'maxLD', 'max', 'minMaxLD'],
  ['minCLMax', 'clMax', 'min', 'maxCLMax'],
  ['maxCLMax', 'clMax', 'max', 'minCLMax'],
  ['minLDWidth', 'ldWidth', 'min'],
]
const slider = reactive(Object.fromEntries(sliderSpecs.map(([k, range, end, pair]) => [k, computed({
  get: () => values[k] ?? props.filterRanges[range][end],
  set: (val: number) => {
    values[k] = val
    // Ensure min is always <= max
    const other = pair ? values[pair] : null
    if (pair && other !== null && (end === 'min' ? val > other : val < other))
      values[pair] = val
  },
})])) as Record<string, number>)

// Filter blocks in display order
const sliders: { group: Group; label: string; tip?: string; range: RangeKey; step: string; digits: number; inputs: [FilterKey, string][] }[] = [
  { group: 'maxLD', label: 'Max L/D Range', range: 'maxLD', step: '0.1', digits: 1, inputs: [['minMaxLD', 'Max L/D minimum'], ['maxMaxLD', 'Max L/D maximum']] },
  { group: 'ldWidth', label: 'L/D Width', tip: 'Width of L/D curve at 80% of max L/D. Wider is more forgiving on trim AoA.', range: 'ldWidth', step: '0.1', digits: 1, inputs: [['minLDWidth', 'L/D width minimum']] },
  { group: 'clMax', label: 'CL Max Range', range: 'clMax', step: '0.01', digits: 2, inputs: [['minCLMax', 'CL max minimum'], ['maxCLMax', 'CL max maximum']] },
  { group: 'minCMAtZero', label: 'Min CM at α = 0°', range: 'cmAtZero', step: '0.01', digits: 3, inputs: [['minCMAtZero', 'Min CM at alpha 0']] },
  { group: 'maxCMRoughness', label: 'Max CM Curve Wiggliness', tip: 'Lower values = smoother moment curve.', range: 'smoothness_CM', step: '0.01', digits: 3, inputs: [['maxCMRoughness', 'Max CM curve wiggliness']] },
]

// Value shown next to a filter's label
function summary(s: typeof sliders[number]) {
  const [lo, hi] = s.inputs.map(([k]) => values[k])
  const r = props.filterRanges[s.range]
  if (s.inputs.length === 2)
    return (lo !== null || hi !== null) ? `${(lo !== null ? lo : r.min).toFixed(s.digits)} - ${(hi !== null ? hi : r.max).toFixed(s.digits)}` : 'No limit'
  if (s.group === 'ldWidth')
    return lo !== null ? `≥ ${lo.toFixed(1)}°` : 'No limit'
  return (lo !== null && lo !== undefined) ? lo.toFixed(3) : 'No limit'
}

// Watch filter changes from parent - UPDATE VALUES ONLY, not enabled state
watch(
  () => props.filters,
  (newFilters) => {
    for (const k of filterKeys)
      values[k] = newFilters[k]
    // DO NOT recalculate enabled state from values - let user control it via checkbox
    // Only update enabled state if ALL values for a filter become null (filter was cleared externally)
    for (const g of groupNames) {
      if (groups[g].every(k => newFilters[k] === null))
        filterEnabled[g] = false
    }
  },
  { deep: true },
)

// Emit filter updates (only when enabled)
for (const g of groupNames) {
  for (const k of groups[g])
    watch(() => values[k], val => emit('update-filter', k, filterEnabled[g] ? val : null))
}

// Watch enabled state changes; paired values update together
for (const g of groupNames) {
  watch(() => filterEnabled[g], (enabled) => {
    for (const k of groups[g])
      emit('update-filter', k, enabled ? values[k] : null)
  })
}

const handleResetFilters = () => {
  emit('reset-filters')
}
</script>

<template>
  <div class="space-y-4">
    <!-- Combined Info Card -->
    <VPanel title="Run summary">
      <div class="space-y-2 text-sm">
        <div v-if="dataContext && dataContext.Re" class="flex justify-between">
          <span class="text-gray-600">Reynolds Number:</span>
          <span class="num font-medium text-gray-900">{{ dataContext.Re.toLocaleString() }}</span>
        </div>
        <div v-if="dataContext && dataContext.Mach !== undefined" class="flex justify-between">
          <span class="text-gray-600">Mach Number:</span>
          <span class="num font-medium text-gray-900">{{ dataContext.Mach }}</span>
        </div>
        <div v-if="dataContext && dataContext.nCrit !== undefined" class="flex justify-between">
          <span class="text-gray-600">N_crit:</span>
          <span class="num font-medium text-gray-900">{{ dataContext.nCrit }}</span>
        </div>
        <div v-if="dataContext && (dataContext.alphaMin !== undefined || dataContext.alphaMax !== undefined)" class="flex justify-between">
          <span class="text-gray-600">Alpha Range:</span>
          <span class="num font-medium text-gray-900">
            {{ dataContext.alphaMin !== undefined ? dataContext.alphaMin : '—' }}° to {{ dataContext.alphaMax !== undefined ? dataContext.alphaMax : '—' }}°
          </span>
        </div>
        <div v-if="dataContext && (dataContext.Re || dataContext.Mach !== undefined || dataContext.nCrit !== undefined || dataContext.alphaMin !== undefined || dataContext.alphaMax !== undefined)" class="pt-2 mt-2 border-t border-gray-200"></div>
        <div class="flex justify-between">
          <span class="text-gray-600">Total Airfoils:</span>
          <span class="num font-medium text-gray-900">{{ totalCount }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Available after filtering:</span>
          <span class="num font-medium text-primary-700">{{ filteredAirfoils.length }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Selected:</span>
          <span class="num font-medium text-success-700">{{ selectedAirfoils.length }}</span>
        </div>
      </div>
    </VPanel>

    <!-- Filters Section -->
    <VPanel title="Filters">
      <template #actions>
        <VButton
          type="button"
          variant="ghost"
          color="primary"
          size="xs"
          @click="handleResetFilters"
        >
          Reset All
        </VButton>
      </template>

      <div class="divide-y divide-gray-200">
        <!-- Target CL and Target α (Paired Filter) -->
        <div class="pb-4">
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <input
              type="checkbox"
              v-model="filterEnabled.targetDesign"
              class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Design CL & α
          </label>
          <div class="grid grid-cols-2 gap-4">
            <!-- Target CL -->
            <div>
              <label for="sidebar-design-cl" class="block text-sm font-medium text-gray-700 mb-1">Design CL</label>
              <VInput
                :model-value="values.targetCL ?? undefined"
                @update:model-value="values.targetCL = $event as number | null"
                id="sidebar-design-cl"
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
              <label for="sidebar-design-alpha" class="block text-sm font-medium text-gray-700 mb-1 whitespace-nowrap">Design α (deg)</label>
              <VInput
                :model-value="values.targetAOA ?? undefined"
                @update:model-value="values.targetAOA = $event as number | null"
                id="sidebar-design-alpha"
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

        <div v-for="s in sliders" :key="s.group" class="py-4">
          <div class="relative mb-2 flex items-start justify-between gap-2">
            <label class="flex min-w-0 items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                v-model="filterEnabled[s.group]"
                class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              {{ s.label }}
              <div v-if="s.tip" class="group">
                <Icon name="heroicons:question-mark-circle" class="h-4 w-4 text-gray-400 cursor-help" />
                <div class="pointer-events-none absolute bottom-full left-0 right-0 z-10 mb-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-relaxed text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {{ s.tip }}
                </div>
              </div>
            </label>
            <span class="num shrink-0 whitespace-nowrap text-sm font-medium text-primary-700">
              {{ summary(s) }}
            </span>
          </div>
          <div v-if="s.inputs.length === 2" class="dual-range-slider">
            <input
              v-for="[k, aria] in s.inputs"
              :key="k"
              v-model.number="slider[k]"
              :aria-label="aria"
              type="range"
              :min="filterRanges[s.range].min"
              :max="filterRanges[s.range].max"
              :step="s.step"
              :disabled="!filterEnabled[s.group]"
              class="dual-range-input"
            />
          </div>
          <!-- Min Width slider -->
          <div v-else-if="s.group === 'ldWidth'" class="space-y-1 mt-2">
            <div class="flex justify-between text-xs text-gray-600">
              <span>Min Width</span>
              <span>{{ values.minLDWidth !== null ? values.minLDWidth.toFixed(1) + '°' : filterRanges.ldWidth.min.toFixed(1) + '°' }}</span>
            </div>
            <input
              v-model.number="slider.minLDWidth"
              aria-label="L/D width minimum"
              type="range"
              :min="filterRanges.ldWidth.min"
              :max="filterRanges.ldWidth.max"
              step="0.1"
              :disabled="!filterEnabled.ldWidth"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div class="flex justify-between">
              <span class="num text-xs text-gray-500">{{ filterRanges.ldWidth.min.toFixed(1) }}°</span>
              <span class="num text-xs text-gray-500">{{ filterRanges.ldWidth.max.toFixed(1) }}°</span>
            </div>
          </div>
          <input
            v-else
            v-model.number="slider[s.inputs[0][0]]"
            :aria-label="s.inputs[0][1]"
            type="range"
            :min="filterRanges[s.range].min"
            :max="filterRanges[s.range].max"
            :step="s.step"
            :disabled="!filterEnabled[s.group]"
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div v-if="s.group !== 'ldWidth'" class="flex justify-between mt-1">
            <span class="num text-xs text-gray-500">{{ filterRanges[s.range].min.toFixed(s.digits) }}</span>
            <span class="num text-xs text-gray-500">{{ filterRanges[s.range].max.toFixed(s.digits) }}</span>
          </div>
        </div>

        <!-- Rendering Mode -->
        <div class="pt-4">
          <div class="space-y-2">
            <div class="relative flex items-center gap-2 mb-1">
              <label class="block text-sm font-medium text-gray-700">Rendering Mode</label>
              <div class="group">
                <Icon name="heroicons:question-mark-circle" class="h-4 w-4 text-gray-400 cursor-help" />
                <div class="pointer-events-none absolute bottom-full left-0 right-0 z-10 mb-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-relaxed text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Performance mode reduces data points for faster rendering with large datasets.
                </div>
              </div>
            </div>
            <select
              :value="performanceMode || 'performance'"
              @change="emit('update-performance-mode', ($event.target as HTMLSelectElement).value as 'performance' | 'detail')"
              aria-label="Rendering mode"
              class="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="performance">Performance (Recommended)</option>
              <option value="detail">High Detail</option>
            </select>
          </div>
        </div>
      </div>
    </VPanel>
  </div>
</template>

<style scoped>
.dual-range-slider {
  position: relative;
  height: 1.5rem;
}

.dual-range-input {
  position: absolute;
  width: 100%;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  margin: 0;
  height: 0.5rem;
}

/* First input gets the track styling */
.dual-range-input:first-child {
  background: #e2e8f0;
  border-radius: 9999px;
}

/* Second input has no track */
.dual-range-input:last-child {
  background: transparent;
}

/* Webkit thumb */
.dual-range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 1rem;
  width: 1rem;
  border-radius: 9999px;
  background: #2563eb;
  cursor: pointer;
  pointer-events: auto;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.dual-range-input:disabled::-webkit-slider-thumb {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Firefox thumb */
.dual-range-input::-moz-range-thumb {
  height: 1rem;
  width: 1rem;
  border-radius: 9999px;
  background: #2563eb;
  cursor: pointer;
  pointer-events: auto;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.dual-range-input:disabled::-moz-range-thumb {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Firefox track */
.dual-range-input::-moz-range-track {
  background: transparent;
  height: 0.5rem;
}

.dual-range-input:first-child::-moz-range-track {
  background: #e2e8f0;
  border-radius: 9999px;
}
</style>

