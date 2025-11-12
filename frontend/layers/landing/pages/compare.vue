<script setup lang="ts">
import { useCompare, type AirfoilPolarData } from '~/composables/useCompare'
import type { SearchParams } from '~/composables/useAirfoilSearch'
import { useDebounceFn } from '@vueuse/core'

definePageMeta({
  layout: 'detail',
})

const route = useRoute()
const router = useRouter()
const { searchAirfoils } = useAirfoilSearch()
const { runAnalysisIfNeeded } = usePerformanceCache()
const { submitAnalysis } = useAnalysis()

const {
  state,
  normalizeAnalysisResults,
  updateFilter,
  setSelectedAirfoils,
  toggleAirfoilSelection,
  selectAllFiltered,
  deselectAll,
  getSelectedAirfoilsData,
  getSummaryData,
  resetFilters,
  getFilterRanges,
} = useCompare()

// Active tab: 'plots' or 'table'
const activeTab = ref<'plots' | 'table'>('plots')

// Loading and error states
const isLoading = ref(false)
const error = ref<string | null>(null)

// Data context (from analysis conditions)
const dataContext = ref<{
  Re?: number
  Mach?: number
  source?: string
}>({})

// Geometry filter states (for direct usage mode)
const includeName = ref<string>('')
const excludeName = ref<string>('')
const thicknessEnabled = ref(false)
const thicknessMin = ref<number | undefined>()
const thicknessMax = ref<number | undefined>()
const camberEnabled = ref(false)
const camberMin = ref<number | undefined>()
const camberMax = ref<number | undefined>()

// Analysis parameters (for direct usage mode)
const reynoldsNumber = ref<number>(100)
const machNumber = ref<number>(0)
const alphaMin = ref<number>(-5)
const alphaMax = ref<number>(20)
const nCrit = ref<number>(9)

// Matched airfoil count
const matchedCount = ref<number>(0)
const isLoadingCount = ref(false)

// Form validation
const paramsValid = ref(false)
const paramsFormRef = ref<{ submit: () => void; isValid: boolean } | null>(null)

// Helper functions
const percentageToDecimal = (value: number): number => value / 100

/**
 * Load geometry filters and flow conditions from URL params
 */
const loadParamsFromURL = () => {
  const query = route.query

  // Geometry filters
  if (query.includeName) {
    includeName.value = query.includeName as string
  }
  if (query.excludeName) {
    excludeName.value = query.excludeName as string
  }
  if (query.thicknessEnabled === 'true') {
    thicknessEnabled.value = true
    if (query.thicknessMin) {
      thicknessMin.value = parseFloat(query.thicknessMin as string)
    }
    if (query.thicknessMax) {
      thicknessMax.value = parseFloat(query.thicknessMax as string)
    }
  }
  if (query.camberEnabled === 'true') {
    camberEnabled.value = true
    if (query.camberMin) {
      camberMin.value = parseFloat(query.camberMin as string)
    }
    if (query.camberMax) {
      camberMax.value = parseFloat(query.camberMax as string)
    }
  }

  // Flow conditions
  if (query.Re) {
    reynoldsNumber.value = parseFloat(query.Re as string) / 1000 // Convert from actual Re to thousands
  }
  if (query.Mach) {
    machNumber.value = parseFloat(query.Mach as string)
  }
  if (query.alphaMin) {
    alphaMin.value = parseFloat(query.alphaMin as string)
  }
  if (query.alphaMax) {
    alphaMax.value = parseFloat(query.alphaMax as string)
  }
  if (query.nCrit) {
    nCrit.value = parseFloat(query.nCrit as string)
  }
}

/**
 * Update airfoil count based on geometry filters
 */
const updateAirfoilCount = useDebounceFn(async () => {
  isLoadingCount.value = true
  try {
    const params: SearchParams = {
      includeName: includeName.value.trim() || undefined,
      excludeName: excludeName.value.trim() || undefined,
      thicknessMin: thicknessEnabled.value && thicknessMin.value !== undefined
        ? percentageToDecimal(thicknessMin.value)
        : undefined,
      thicknessMax: thicknessEnabled.value && thicknessMax.value !== undefined
        ? percentageToDecimal(thicknessMax.value)
        : undefined,
      camberMin: camberEnabled.value && camberMin.value !== undefined
        ? percentageToDecimal(camberMin.value)
        : undefined,
      camberMax: camberEnabled.value && camberMax.value !== undefined
        ? percentageToDecimal(camberMax.value)
        : undefined,
      page: 1,
      limit: 1,
    }

    const result = await searchAirfoils(params)
    matchedCount.value = result.count
  } catch (error) {
    console.error('Error fetching airfoil count:', error)
    matchedCount.value = 0
  } finally {
    isLoadingCount.value = false
  }
}, 300)

// Watch filter changes to update count
watch([includeName, excludeName, thicknessEnabled, thicknessMin, thicknessMax, camberEnabled, camberMin, camberMax], () => {
  updateAirfoilCount()
}, { immediate: true })

/**
 * Load analysis data from URL params or form values
 */
const loadAnalysisData = async () => {
  isLoading.value = true
  error.value = null

  try {
    // Build geometry filter params
    const searchParams: SearchParams = {
      includeName: includeName.value.trim() || undefined,
      excludeName: excludeName.value.trim() || undefined,
      thicknessMin: thicknessEnabled.value && thicknessMin.value !== undefined
        ? percentageToDecimal(thicknessMin.value)
        : undefined,
      thicknessMax: thicknessEnabled.value && thicknessMax.value !== undefined
        ? percentageToDecimal(thicknessMax.value)
        : undefined,
      camberMin: camberEnabled.value && camberMin.value !== undefined
        ? percentageToDecimal(camberMin.value)
        : undefined,
      camberMax: camberEnabled.value && camberMax.value !== undefined
        ? percentageToDecimal(camberMax.value)
        : undefined,
      page: 1,
      limit: 10000, // Get all matching airfoils
    }

    // Query airfoils with geometry filters
    const searchResult = await searchAirfoils(searchParams)
    const airfoilIds = searchResult.data.map(a => a.id)
    const airfoilNames = searchResult.data.map(a => a.name)

    if (airfoilIds.length === 0) {
      error.value = 'No airfoils match the selected geometry filters.'
      return
    }

    // Build analysis conditions
    const conditions = {
      Re: reynoldsNumber.value * 1000,
      Mach: machNumber.value,
      alpha_range: [alphaMin.value, alphaMax.value, 0.5] as [number, number, number],
      n_crit: nCrit.value,
      control_surface_fraction: 0,
      control_surface_deflection: 0,
    }

    // Set data context
    dataContext.value = {
      Re: conditions.Re,
      Mach: conditions.Mach,
      source: 'Analysis API',
    }

    // Run analysis (checks cache and runs if needed)
    const performanceData = await runAnalysisIfNeeded(airfoilIds, airfoilNames, conditions)

    if (performanceData.length === 0) {
      error.value = 'No performance data available.'
      return
    }

    // Transform to format expected by normalizeAnalysisResults
    // Results should be keyed by airfoil name
    const results: Record<string, any> = {}
    performanceData.forEach((item) => {
      results[item.airfoilName] = item.data
    })

    // Normalize results for useCompare
    // Pass airfoilNames in the same order as performanceData
    const orderedNames = performanceData.map(item => item.airfoilName)
    await normalizeAnalysisResults(results, orderedNames)
  } catch (err: any) {
    console.error('Error loading analysis data:', err)
    error.value = err.message || 'Failed to load analysis data'
  } finally {
    isLoading.value = false
  }
}

/**
 * Handle form submission (for direct usage mode)
 */
const handleRunAnalysis = async () => {
  if (!paramsValid.value || matchedCount.value === 0) return

  // Update URL with current params
  const queryParams: Record<string, string> = {}
  
  if (includeName.value.trim()) {
    queryParams.includeName = includeName.value.trim()
  }
  if (excludeName.value.trim()) {
    queryParams.excludeName = excludeName.value.trim()
  }
  if (thicknessEnabled.value) {
    if (thicknessMin.value !== undefined) {
      queryParams.thicknessMin = thicknessMin.value.toString()
    }
    if (thicknessMax.value !== undefined) {
      queryParams.thicknessMax = thicknessMax.value.toString()
    }
    queryParams.thicknessEnabled = 'true'
  }
  if (camberEnabled.value) {
    if (camberMin.value !== undefined) {
      queryParams.camberMin = camberMin.value.toString()
    }
    if (camberMax.value !== undefined) {
      queryParams.camberMax = camberMax.value.toString()
    }
    queryParams.camberEnabled = 'true'
  }
  
  queryParams.Re = (reynoldsNumber.value * 1000).toString()
  queryParams.Mach = machNumber.value.toString()
  queryParams.alphaMin = alphaMin.value.toString()
  queryParams.alphaMax = alphaMax.value.toString()
  queryParams.nCrit = nCrit.value.toString()

  router.replace({ query: queryParams })
  
  // Load analysis data
  await loadAnalysisData()
}

/**
 * Update URL with current state (deep-linking for performance filters/selection only)
 */
const updateURL = () => {
  const query: Record<string, string> = {}

  // Keep geometry and flow params
  if (includeName.value.trim()) {
    query.includeName = includeName.value.trim()
  }
  if (excludeName.value.trim()) {
    query.excludeName = excludeName.value.trim()
  }
  if (thicknessEnabled.value) {
    if (thicknessMin.value !== undefined) {
      query.thicknessMin = thicknessMin.value.toString()
    }
    if (thicknessMax.value !== undefined) {
      query.thicknessMax = thicknessMax.value.toString()
    }
    query.thicknessEnabled = 'true'
  }
  if (camberEnabled.value) {
    if (camberMin.value !== undefined) {
      query.camberMin = camberMin.value.toString()
    }
    if (camberMax.value !== undefined) {
      query.camberMax = camberMax.value.toString()
    }
    query.camberEnabled = 'true'
  }
  
  query.Re = (reynoldsNumber.value * 1000).toString()
  query.Mach = machNumber.value.toString()
  query.alphaMin = alphaMin.value.toString()
  query.alphaMax = alphaMax.value.toString()
  query.nCrit = nCrit.value.toString()

  // Serialize performance filters
  if (state.filters.maxCMRoughness !== null) {
    query.maxCMRoughness = state.filters.maxCMRoughness.toString()
  }
  if (state.filters.minCMAtZero !== null) {
    query.minCMAtZero = state.filters.minCMAtZero.toString()
  }
  if (state.filters.minMaxLD !== null) {
    query.minMaxLD = state.filters.minMaxLD.toString()
  }
  if (state.filters.minCLMax !== null) {
    query.minCLMax = state.filters.minCLMax.toString()
  }
  if (state.filters.targetCL !== null) {
    query.targetCL = state.filters.targetCL.toString()
  }
  if (state.filters.targetAOA !== null) {
    query.targetAOA = state.filters.targetAOA.toString()
  }

  // Serialize selection
  if (state.selectedAirfoils.length > 0) {
    query.selected = state.selectedAirfoils.join(',')
  }

  router.replace({ query })
}

/**
 * Load performance filter state from URL
 */
const loadPerformanceFiltersFromURL = () => {
  const query = route.query

  if (query.maxCMRoughness) {
    updateFilter('maxCMRoughness', parseFloat(query.maxCMRoughness as string))
  }
  if (query.minCMAtZero) {
    updateFilter('minCMAtZero', parseFloat(query.minCMAtZero as string))
  }
  if (query.minMaxLD) {
    updateFilter('minMaxLD', parseFloat(query.minMaxLD as string))
  }
  if (query.minCLMax) {
    updateFilter('minCLMax', parseFloat(query.minCLMax as string))
  }
  if (query.targetCL) {
    updateFilter('targetCL', parseFloat(query.targetCL as string))
  }
  if (query.targetAOA) {
    updateFilter('targetAOA', parseFloat(query.targetAOA as string))
  }

  // Load selection from URL
  if (query.selected) {
    const selected = (query.selected as string).split(',').filter(Boolean)
    setSelectedAirfoils(selected)
  }
}

// Watch for filter/selection changes and update URL
watch(
  [() => state.filters, () => state.selectedAirfoils],
  () => {
    updateURL()
  },
  { deep: true }
)

// Check if we have URL params (from Performance page)
const hasURLParams = computed(() => {
  const query = route.query
  return !!(query.Re || query.includeName || query.thicknessEnabled || query.camberEnabled)
})

// Load data on mount
onMounted(() => {
  loadParamsFromURL()
  loadPerformanceFiltersFromURL()
  
  // If URL params exist, load analysis data automatically
  if (hasURLParams.value) {
    loadAnalysisData()
  }
})

useHead({
  title: 'Compare Airfoils - Airfolio',
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <h1 class="text-3xl font-bold text-gray-900">Compare Airfoils</h1>
        <p class="text-sm text-gray-600 mt-1">
          Filter and compare airfoil performance across multiple metrics
        </p>
      </div>
    </div>

    <!-- Geometry Filters & Analysis Form (shown when no data or direct usage) -->
    <div v-if="!hasURLParams || state.allAirfoils.size === 0" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Geometry Filters Section -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Geometry Filters</h2>
        <p class="text-sm text-gray-600 mb-4">
          Filter airfoils by geometry parameters before running analysis.
        </p>

        <div class="space-y-4">
          <!-- Include Name Filter -->
          <div class="flex items-center gap-4 flex-wrap">
            <label class="text-sm font-medium text-gray-700 min-w-[140px]">
              Include Foils with
            </label>
            <div class="flex items-center gap-2 flex-1">
              <VInput
                v-model="includeName"
                type="text"
                maxlength="8"
                placeholder="e.g., NACA"
                size="sm"
                wrapper-class="max-w-[120px]"
              />
              <span class="text-sm text-gray-600">in the name</span>
            </div>
          </div>

          <!-- Exclude Name Filter -->
          <div class="flex items-center gap-4 flex-wrap">
            <label class="text-sm font-medium text-gray-700 min-w-[140px]">
              Exclude Foils with
            </label>
            <div class="flex items-center gap-2 flex-1">
              <VInput
                v-model="excludeName"
                type="text"
                maxlength="8"
                placeholder="e.g., TEST"
                size="sm"
                wrapper-class="max-w-[120px]"
              />
              <span class="text-sm text-gray-600">in the name</span>
            </div>
          </div>

          <!-- Thickness Filter -->
          <div class="flex items-start gap-4 flex-wrap">
            <label class="flex items-center gap-2 cursor-pointer min-w-[120px]">
              <input
                v-model="thicknessEnabled"
                type="checkbox"
                class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span class="text-sm font-medium text-gray-700">Thickness</span>
            </label>
            <div v-if="thicknessEnabled" class="flex items-center gap-3 flex-1">
              <div class="flex items-center gap-2">
                <label class="text-xs text-gray-600 whitespace-nowrap">Min</label>
                <VInput
                  v-model.number="thicknessMin"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="0"
                  size="sm"
                  wrapper-class="w-24"
                />
              </div>
              <span class="text-gray-400">%</span>
              <div class="flex items-center gap-2">
                <label class="text-xs text-gray-600 whitespace-nowrap">Max</label>
                <VInput
                  v-model.number="thicknessMax"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="100"
                  size="sm"
                  wrapper-class="w-24"
                />
              </div>
              <span class="text-gray-400">%</span>
            </div>
          </div>

          <!-- Camber Filter -->
          <div class="flex items-start gap-4 flex-wrap">
            <label class="flex items-center gap-2 cursor-pointer min-w-[120px]">
              <input
                v-model="camberEnabled"
                type="checkbox"
                class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span class="text-sm font-medium text-gray-700">Camber</span>
            </label>
            <div v-if="camberEnabled" class="flex items-center gap-3 flex-1">
              <div class="flex items-center gap-2">
                <label class="text-xs text-gray-600 whitespace-nowrap">Min</label>
                <VInput
                  v-model.number="camberMin"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="0"
                  size="sm"
                  wrapper-class="w-24"
                />
              </div>
              <span class="text-gray-400">%</span>
              <div class="flex items-center gap-2">
                <label class="text-xs text-gray-600 whitespace-nowrap">Max</label>
                <VInput
                  v-model.number="camberMax"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="100"
                  size="sm"
                  wrapper-class="w-24"
                />
              </div>
              <span class="text-gray-400">%</span>
            </div>
          </div>
        </div>

        <!-- Airfoil Count Display -->
        <div class="mt-4 pt-4 border-t border-gray-200">
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-600">Matching airfoils:</span>
            <span v-if="isLoadingCount" class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></span>
            <span v-else class="text-sm font-semibold text-gray-900">{{ matchedCount }} airfoil{{ matchedCount !== 1 ? 's' : '' }}</span>
          </div>
        </div>
      </div>

      <!-- Analysis Parameters Section -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Analysis Parameters</h2>
        <p class="text-sm text-gray-600 mb-4">
          Configure the flow conditions for the performance analysis.
        </p>

        <AnalysisParametersForm
          ref="paramsFormRef"
          :initial-reynolds="reynoldsNumber"
          :initial-mach="machNumber"
          :initial-alpha-min="alphaMin"
          :initial-alpha-max="alphaMax"
          :initial-ncrit="nCrit"
          @submit="(params) => {
            reynoldsNumber = params.reynoldsNumber
            machNumber = params.machNumber
            alphaMin = params.alphaMin
            alphaMax = params.alphaMax
            nCrit = params.nCrit
            handleRunAnalysis()
          }"
          @valid-change="(isValid) => { paramsValid = isValid }"
        />
      </div>

      <!-- Run Button -->
      <div class="bg-white rounded-lg shadow p-6">
        <button
          type="button"
          :disabled="!paramsValid || matchedCount === 0 || isLoading"
          :class="[
            'w-full px-6 py-3 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2',
            paramsValid && matchedCount > 0 && !isLoading
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          ]"
          @click="handleRunAnalysis"
        >
          <span v-if="isLoading" class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
          <span>{{ isLoading ? 'Running Analysis...' : 'Run Performance Analysis' }}</span>
        </button>
        <p v-if="!paramsValid || matchedCount === 0" class="mt-2 text-xs text-gray-500 text-center">
          <span v-if="matchedCount === 0">No airfoils match the selected filters.</span>
          <span v-else-if="!paramsValid">Please fill in all analysis parameters with valid values.</span>
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && hasURLParams" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p class="mt-4 text-gray-600">Loading analysis data...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 class="text-lg font-semibold text-red-900 mb-2">Error Loading Data</h2>
        <p class="text-red-800">{{ error }}</p>
        <NuxtLink
          to="/performance"
          class="mt-4 inline-block text-sm font-medium text-red-700 hover:text-red-900"
        >
          ← Go to Performance Analysis
        </NuxtLink>
      </div>
    </div>

    <!-- Main Content: Plots & Table -->
    <div v-else-if="state.allAirfoils.size > 0" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <!-- Sidebar: Filters & Selection -->
        <div class="lg:col-span-1">
          <CompareSidebar
            :filters="state.filters"
            :filtered-airfoils="[...state.filteredAirfoils]"
            :selected-airfoils="[...state.selectedAirfoils]"
            :total-count="state.allAirfoils.size"
            :data-context="dataContext"
            :filter-ranges="getFilterRanges"
            @update-filter="updateFilter"
            @set-selected="setSelectedAirfoils"
            @toggle-selection="toggleAirfoilSelection"
            @select-all="selectAllFiltered"
            @deselect-all="deselectAll"
            @reset-filters="resetFilters"
          />
        </div>

        <!-- Main Content: Plots & Table -->
        <div class="lg:col-span-3">
          <!-- Tabs -->
          <div class="bg-white rounded-lg shadow mb-6">
            <div class="border-b border-gray-200">
              <nav class="flex -mb-px">
                <button
                  :class="[
                    'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'plots'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  ]"
                  @click="activeTab = 'plots'"
                >
                  Polar Plots
                </button>
                <button
                  :class="[
                    'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'table'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  ]"
                  @click="activeTab = 'table'"
                >
                  Summary Table
                </button>
              </nav>
            </div>

            <!-- Tab Content -->
            <div class="p-6">
              <!-- Polar Plots Tab -->
              <div v-if="activeTab === 'plots'">
                <ComparePlots
                  v-if="getSelectedAirfoilsData.length > 0"
                  :airfoils="getSelectedAirfoilsData"
                />
                <div v-else class="text-center py-12 text-gray-500">
                  <p>No airfoils selected. Please select airfoils from the sidebar to compare.</p>
                </div>
              </div>

              <!-- Summary Table Tab -->
              <div v-if="activeTab === 'table'">
                <CompareSummaryTable
                  v-if="getSummaryData.length > 0"
                  :summary-data="getSummaryData"
                />
                <div v-else class="text-center py-12 text-gray-500">
                  <p>No airfoils selected. Please select airfoils from the sidebar to compare.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
