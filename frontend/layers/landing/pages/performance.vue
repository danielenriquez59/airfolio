<script setup lang="ts">
import type { SearchParams } from '~/composables/useAirfoilSearch'
import { useDebounceFn } from '@vueuse/core'
import type { Database } from '~/types/database.types'
import { useCompare, type AirfoilPolarData } from '~/composables/useCompare'
import SummaryScatterPlot from '~/layers/landing/components/compare/SummaryScatterPlot.vue'
import CompareNotesTab from '~/layers/landing/components/compare/CompareNotesTab.vue'
import CompareCalculator from '~/layers/landing/components/compare/CompareCalculator.vue'
import CompareAirfoilList from '~/layers/landing/components/compare/CompareAirfoilList.vue'
import { navTabButtonClasses, tabButtonClasses } from '~/layers/ui/utils/buttons'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

definePageMeta({
  layout: 'detail',
})

const route = useRoute()
const router = useRouter()
const { searchAirfoils } = useAirfoilSearch()
const { submitAnalysis } = useAnalysis()
const { runAnalysisIfNeeded } = usePerformanceCache()

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
  resetAnalysis,
  getFilterRanges,
} = useCompare()

// Active tab: 'plots', 'table', 'scatter', 'notes', or 'calculator'
const activeTab = ref<'plots' | 'table' | 'scatter' | 'notes' | 'calculator'>('plots')

// Scatter Plot State (persisted across tab switches)
const scatterXAxis = ref('thickness')
const scatterYAxis = ref('maxLD')

// Performance mode state
const performanceMode = ref<'performance' | 'detail'>('performance')

// Loading and error states
const isLoading = ref(false)
const progressMessage = ref('')
const error = ref<string | null>(null)

// Data context (from analysis conditions)
const dataContext = ref<{
  Re?: number
  Mach?: number
  nCrit?: number
  alphaMin?: number
  alphaMax?: number
  source?: string
}>({})

// Name filter states
const includeName = ref<string>('')
const excludeName = ref<string>('')

const nameFilters = [
  { id: 'perf-include-name', label: 'Include names containing', placeholder: 'e.g., NACA', model: includeName },
  { id: 'perf-exclude-name', label: 'Exclude names containing', placeholder: 'e.g., TEST', model: excludeName },
]

// Geometry filter states (thickness, camber, area), same shape as SearchBar's ranges
const ranges = PERFORMANCE_RANGE_KEYS.map(key => ({
  key,
  label: key[0].toUpperCase() + key.slice(1),
  enabled: ref(false),
  min: ref<number | undefined>(),
  max: ref<number | undefined>(),
}))

// Analysis parameters
const reynoldsNumber = ref<number>(500)
const machNumber = ref<number>(0)
const alphaMin = ref<number>(-5)
const alphaMax = ref<number>(20)
const nCrit = ref<number>(9)

// Matched airfoil count
const matchedCount = ref<number>(0)
const isLoadingCount = ref(false)

// Selection mode state
const selectionMode = ref<'all' | 'specific'>('all')
const preAnalysisSelectedAirfoils = ref<string[]>([]) // IDs of manually selected airfoils
const filteredAirfoilsList = ref<Airfoil[]>([]) // Cached list of geometry-filtered airfoils
const isLoadingFilteredList = ref(false) // Loading state for fetching filtered list
const selectionSearch = ref<string>('') // Search within filtered airfoils

// Background loading state for all airfoils (no filters)
const allAirfoilsList = ref<Airfoil[]>([]) // Cached list of ALL airfoils (no filters)
const isLoadingAllAirfoils = ref(false) // Loading state for background fetch

// Analysis submission state
const isSubmittingAnalysis = ref(false)
const analysisError = ref<string | null>(null)
const analysisResponse = ref<{
  job_id: string | null
  cached: boolean
  results?: any
} | null>(null)
const searchResult = ref<{ data: Array<{ id: string; name: string }> } | null>(null)

// Helper functions to convert between display (percentage) and database (decimal) format
const percentageToDecimal = (value: number): number => value / 100
const decimalToPercentage = (value: number): number => value * 100

/**
 * Load geometry filters, flow conditions, selection and performance filters from URL params
 */
const loadParamsFromURL = () => {
  const q = readPerformanceQuery(route.query)
  includeName.value = q.includeName
  excludeName.value = q.excludeName
  for (const r of ranges) {
    r.enabled.value = q.ranges[r.key].enabled
    r.min.value = q.ranges[r.key].min
    r.max.value = q.ranges[r.key].max
  }
  reynoldsNumber.value = q.Re
  machNumber.value = q.Mach
  alphaMin.value = q.alphaMin
  alphaMax.value = q.alphaMax
  nCrit.value = q.nCrit
  selectionMode.value = q.selectionMode
  preAnalysisSelectedAirfoils.value = [...q.selectedIds]
  for (const [key, value] of Object.entries(q.filters))
    updateFilter(key as keyof typeof q.filters, value)
  if (q.selected)
    setSelectedAirfoils([...q.selected])
}

/**
 * Update URL with current state (deep-linking)
 */
const updateURL = () => {
  router.replace({
    query: writePerformanceQuery({
      includeName: includeName.value,
      excludeName: excludeName.value,
      ranges: Object.fromEntries(ranges.map(r => [r.key, { enabled: r.enabled.value, min: r.min.value, max: r.max.value }])) as PerformanceQueryState['ranges'],
      Re: reynoldsNumber.value,
      Mach: machNumber.value,
      alphaMin: alphaMin.value,
      alphaMax: alphaMax.value,
      nCrit: nCrit.value,
      selectionMode: selectionMode.value,
      selectedIds: preAnalysisSelectedAirfoils.value,
      filters: state.filters,
      selected: state.selectedAirfoils,
    }),
  })
}

// Check if we have URL params (from Performance page)
const hasURLParams = computed(() => {
  const query = route.query
  return !!(query.Re || query.includeName || query.thicknessEnabled || query.camberEnabled || query.areaEnabled)
})

/**
 * Filtered airfoils based on search query
 */
const displayedAirfoils = computed(() => {
  if (!selectionSearch.value.trim()) {
    return filteredAirfoilsList.value
  }
  const searchTerm = selectionSearch.value.trim().toLowerCase()
  return filteredAirfoilsList.value.filter(airfoil =>
    airfoil.name.toLowerCase().includes(searchTerm)
  )
})

// Validation for name filters (alphanumeric, max 8 characters)
const validateNameFilter = (value: string): boolean => {
  if (!value) return true // Empty is valid
  const alphanumericRegex = /^[a-zA-Z0-9]*$/
  return alphanumericRegex.test(value) && value.length <= 8
}

// Sanitize name filter inputs (remove non-alphanumeric, limit to 8 chars)
const sanitizeNameInput = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
}

// Name and enabled geometry filters; disabled geometry filters get `min`/`max` (0 and 1 for 0-100%, or undefined)
const buildSearchParams = (min?: number, max?: number): SearchParams => {
  const params: SearchParams = {
    includeName: includeName.value.trim() || undefined,
    excludeName: excludeName.value.trim() || undefined,
  }
  for (const r of ranges) {
    params[`${r.key}Min`] = r.enabled.value && r.min.value !== undefined ? percentageToDecimal(r.min.value) : min
    params[`${r.key}Max`] = r.enabled.value && r.max.value !== undefined ? percentageToDecimal(r.max.value) : max
  }
  return params
}

const hasNoFilters = computed(() => ranges.every(r => !r.enabled.value) && !includeName.value.trim() && !excludeName.value.trim())

// Supabase returns at most 1000 rows per request, so page through all matching airfoils
const fetchAll = async (params: SearchParams, columns?: string) => {
  const rows: Airfoil[] = []
  for (let page = 1; ; page++) {
    const { data } = await searchAirfoils({ ...params, page, limit: 1000 }, columns)
    rows.push(...data)
    if (data.length < 1000)
      return rows
  }
}

/**
 * Load analysis data from URL params or form values
 */
const loadAnalysisData = async () => {
  isLoading.value = true
  error.value = null

  try {
    let airfoilIds: string[] = []
    let airfoilNames: string[] = []

    if (selectionMode.value === 'specific') {
      // Use only selected airfoils
      if (preAnalysisSelectedAirfoils.value.length === 0) {
        error.value = 'Please select at least one airfoil to analyze.'
        return
      }
      if (preAnalysisSelectedAirfoils.value.length > 300) {
        error.value = 'Maximum 300 airfoils allowed. Please select fewer airfoils.'
        return
      }

      // Map IDs to names from filtered list
      airfoilIds = [...preAnalysisSelectedAirfoils.value]
      airfoilNames = filteredAirfoilsList.value
        .filter(a => airfoilIds.includes(a.id))
        .map(a => a.name)
      
      // Ensure we have names for all IDs (fallback to ID if name not found)
      airfoilNames = airfoilIds.map(id => {
        const airfoil = filteredAirfoilsList.value.find(a => a.id === id)
        return airfoil?.name || id
      })
    } else {
      // Use all matching airfoils (current behavior)
      const rows = await fetchAll(buildSearchParams(), 'id, name')
      airfoilIds = rows.map(a => a.id)
      airfoilNames = rows.map(a => a.name)
    }

    if (airfoilIds.length === 0) {
      error.value = 'No airfoils selected for analysis.'
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
      nCrit: conditions.n_crit,
      alphaMin: conditions.alpha_range[0],
      alphaMax: conditions.alpha_range[1],
      source: 'Analysis API',
    }

    // Run analysis (checks cache and runs if needed)
    const performanceData = await runAnalysisIfNeeded(airfoilIds, airfoilNames, conditions, m => { progressMessage.value = m })

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
    progressMessage.value = ''
  }
}

// Debounced function to update airfoil count
const updateAirfoilCount = useDebounceFn(async () => {
  isLoadingCount.value = true
  try {
    const result = await searchAirfoils({ ...buildSearchParams(0, 1), page: 1, limit: 1 }, 'id')
    matchedCount.value = result.count
  } catch (error) {
    console.error('Error fetching airfoil count:', error)
    matchedCount.value = 0
  } finally {
    isLoadingCount.value = false
  }
}, 300)

/**
 * Fetch all airfoils in the background (no filters)
 * This runs immediately on page mount to reduce perceived loading time
 * when users switch to "Selected airfoils only" mode
 */
const fetchAllAirfoilsInBackground = async () => {
  // Don't refetch if already loaded or currently loading
  if (allAirfoilsList.value.length > 0 || isLoadingAllAirfoils.value) {
    return
  }

  isLoadingAllAirfoils.value = true
  try {
    // No filters - get everything
    allAirfoilsList.value = await fetchAll({ thicknessMin: 0, thicknessMax: 1, camberMin: 0, camberMax: 1, areaMin: 0, areaMax: 1 })
  } catch (error) {
    console.error('Error fetching all airfoils in background:', error)
    // Silently fail - this is background loading, don't block UI
  } finally {
    isLoadingAllAirfoils.value = false
  }
}

/**
 * Fetch filtered airfoil list for selection panel
 * Fetches in batches to overcome Supabase row limits
 * Optimized to use cached allAirfoilsList when no filters are applied
 */
const fetchFilteredAirfoilsList = async () => {
  if (filteredAirfoilsList.value.length > 0) {
    return // Already cached
  }

  // If no filters and we have cached all airfoils, use that instead
  if (hasNoFilters.value && allAirfoilsList.value.length > 0) {
    filteredAirfoilsList.value = allAirfoilsList.value
    return
  }

  // If no filters but background load is still in progress, wait for it
  if (hasNoFilters.value && isLoadingAllAirfoils.value) {
    // Show loading state while waiting
    isLoadingFilteredList.value = true
    
    // Wait for background load to complete (with timeout)
    const maxWaitTime = 10000 // 10 seconds max wait
    const startTime = Date.now()
    while (isLoadingAllAirfoils.value && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // If background load completed, use cached data
    if (allAirfoilsList.value.length > 0) {
      filteredAirfoilsList.value = allAirfoilsList.value
      isLoadingFilteredList.value = false
      return
    }
    
    // If timeout or background load failed, continue with normal fetch
    isLoadingFilteredList.value = false
  }

  isLoadingFilteredList.value = true
  try {
    filteredAirfoilsList.value = await fetchAll(buildSearchParams(0, 1))
  } catch (error) {
    console.error('Error fetching filtered airfoils list:', error)
    filteredAirfoilsList.value = []
  } finally {
    isLoadingFilteredList.value = false
  }
}

// Watch filter changes to update count
watch([includeName, excludeName, ...ranges.flatMap(r => [r.enabled, r.min, r.max])], async () => {
  updateAirfoilCount()
  // Clear filtered list when filters change (will refetch if needed)
  if (selectionMode.value === 'specific') {
    filteredAirfoilsList.value = []
    preAnalysisSelectedAirfoils.value = []
    // Refetch the list if we're in specific mode
    await fetchFilteredAirfoilsList()
  }
}, { immediate: true })

// Watch selection mode - fetch list when switching to specific
watch(selectionMode, async (newMode) => {
  if (newMode === 'specific') {
    // Check if we have cached all airfoils and no filters are applied
    if (hasNoFilters.value && allAirfoilsList.value.length > 0) {
      // Use cached data immediately - no loading needed!
      filteredAirfoilsList.value = allAirfoilsList.value
    } else {
      // Either filters are applied, or we need to wait for background load
      // fetchFilteredAirfoilsList will handle both cases intelligently
      await fetchFilteredAirfoilsList()
    }
  } else {
    // Clear selection when switching back to 'all'
    preAnalysisSelectedAirfoils.value = []
  }
})

// Watch for background load completion - update filtered list if user is in specific mode with no filters
watch([allAirfoilsList, isLoadingAllAirfoils], ([airfoils, isLoading]) => {
  if (!isLoading && airfoils.length > 0 && selectionMode.value === 'specific') {
    if (hasNoFilters.value && filteredAirfoilsList.value.length === 0) {
      // Background load completed, use cached data
      filteredAirfoilsList.value = airfoils
    }
  }
})

// Watch for filter/selection changes and update URL
watch(
  [() => state.filters, () => state.selectedAirfoils],
  () => {
    updateURL()
  },
  { deep: true }
)

// Validation state from AnalysisParametersForm
const paramsValid = ref(false)
const paramsFormRef = ref<{ submit: () => void; isValid: boolean } | null>(null)

const canRunAnalysis = computed(() => {
  if (!paramsValid.value || isLoading.value) {
    return false
  }

  if (selectionMode.value === 'specific') {
    // For specific mode, check selection constraints
    const selectedCount = preAnalysisSelectedAirfoils.value.length
    return selectedCount > 0 && selectedCount <= 300
  } else {
    // For 'all' mode, check matched count
    return matchedCount.value > 0
  }
})

// Handler for running the analysis
const handleRunAnalysis = async () => {
  if (!canRunAnalysis.value) return

  updateURL()

  // Load analysis data
  await loadAnalysisData()
}

useHead({
  title: 'Performance Compare - NeuralFoil Powered | Airfolio',
  meta: [
    {
      name: 'description',
      content: 'Run AI-powered aerodynamic analysis on multiple airfoils using NeuralFoil. Configure Reynolds number, Mach number, and angle of attack ranges for detailed performance insights.'
    }
  ]
})

// Load data on mount
onMounted(async () => {
  // Start background loading of all airfoils immediately (non-blocking)
  // This reduces perceived loading time when users switch to "Selected airfoils only" mode
  fetchAllAirfoilsInBackground()
  
  loadParamsFromURL()
  // The filter watcher clears the selection on the restored filters; let it run, then put the URL ids back
  const restoredIds = preAnalysisSelectedAirfoils.value
  await nextTick()
  preAnalysisSelectedAirfoils.value = restoredIds

  // If selection mode is 'specific', fetch filtered list
  if (selectionMode.value === 'specific') {
    await fetchFilteredAirfoilsList()
  }
  
  // If URL params exist, load analysis data automatically
  if (hasURLParams.value) {
    await loadAnalysisData()
  }
})
</script>

<template>
  <div v-if="!hasURLParams || state.allAirfoils.size === 0">
    <PageHeader title="Performance Compare">
      <template #subtitle>
        Configure geometry filters and flow conditions to run a
        <a
          href="https://github.com/peterdsharpe/NeuralFoil"
          target="_blank"
          rel="noopener"
          class="font-medium text-primary-600 underline hover:text-primary-700"
        >NeuralFoil</a>
        powered aerodynamic airfoil comparison!
      </template>
    </PageHeader>

    <!-- Mobile: left panel, right panel, run bar stacked. lg+: airfoils left (2 rows), flow conditions + run block right -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
      <!-- Airfoil Comparison Selection Section -->
      <VPanel title="Airfoils" description="Choose which airfoils to compare." class="lg:row-span-2 lg:self-start">
        <template #actions>
          <div class="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="radiogroup" aria-label="Airfoil selection mode">
            <button
              type="button"
              role="radio"
              :aria-checked="selectionMode === 'all'"
              :class="tabButtonClasses(selectionMode === 'all')"
              @click="selectionMode = 'all'"
            >
              All matching
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="selectionMode === 'specific'"
              :class="tabButtonClasses(selectionMode === 'specific')"
              @click="selectionMode = 'specific'"
            >
              Selected only
            </button>
          </div>
        </template>

        <!-- Show filters when "All matching airfoils" mode -->
        <div v-if="selectionMode === 'all'" class="space-y-5">
          <!-- Matching Airfoils Count -->
          <div class="flex items-baseline justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3">
            <span class="data-label">Matching airfoils</span>
            <span v-if="isLoadingCount" class="inline-flex items-center gap-2 text-sm text-gray-500" role="status">
              <span class="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600" aria-hidden="true" />
              Counting...
            </span>
            <span v-else class="text-sm text-gray-600">
              <span class="num text-2xl font-semibold text-gray-900">{{ matchedCount }}</span>
              airfoil{{ matchedCount !== 1 ? 's' : '' }}
            </span>
          </div>

          <!-- Geometry Filters (Thickness, Camber, and Area) -->
          <fieldset>
            <legend class="data-label mb-2">Geometry filters</legend>
            <div class="grid grid-cols-[minmax(0,7rem)_1fr_1fr] items-center gap-x-3 gap-y-2">
              <span />
              <span class="text-xs text-gray-500">Min (%)</span>
              <span class="text-xs text-gray-500">Max (%)</span>

              <template v-for="r in ranges" :key="r.key">
                <label class="flex h-9 cursor-pointer items-center gap-2">
                  <input
                    v-model="r.enabled.value"
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span class="text-sm font-medium text-gray-700">{{ r.label }}</span>
                </label>
                <VInput
                  v-model.number="r.min.value"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="0"
                  class="num disabled:cursor-not-allowed disabled:text-gray-400"
                  :aria-label="`${r.label} min (%)`"
                  :disabled="!r.enabled.value"
                />
                <VInput
                  v-model.number="r.max.value"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="100"
                  class="num disabled:cursor-not-allowed disabled:text-gray-400"
                  :aria-label="`${r.label} max (%)`"
                  :disabled="!r.enabled.value"
                />
              </template>
            </div>
          </fieldset>

          <!-- Name Filters (Include and Exclude) -->
          <fieldset class="border-t border-gray-200 pt-5">
            <legend class="sr-only">Name filters</legend>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div v-for="f in nameFilters" :key="f.id">
                <label :for="f.id" class="mb-1 block text-sm font-medium text-gray-700">
                  {{ f.label }}
                </label>
                <VInput
                  :id="f.id"
                  :model-value="f.model.value"
                  type="text"
                  maxlength="8"
                  :placeholder="f.placeholder"
                  :error="!!f.model.value && !validateNameFilter(f.model.value)"
                  @update:model-value="(val: string | number | undefined) => { f.model.value = sanitizeNameInput(String(val || '')) }"
                />
                <p v-if="f.model.value && !validateNameFilter(f.model.value)" class="mt-1 text-xs text-error-600">
                  Only alphanumeric characters allowed (max 8)
                </p>
              </div>
            </div>
          </fieldset>
        </div>

        <!-- Show selection panel when "Selected airfoils only" mode -->
        <div v-else-if="selectionMode === 'specific'">
          <CompareAirfoilSelectionPanel
            v-model="preAnalysisSelectedAirfoils"
            :airfoils="displayedAirfoils"
            :max-selection="300"
            :is-loading="isLoadingFilteredList"
          />
        </div>
      </VPanel>

      <!-- Analysis Parameters Section -->
      <VPanel title="Flow conditions" description="Configure the flow conditions for the performance analysis." class="lg:self-start">
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
      </VPanel>

      <!-- Run block: sticky bottom bar on mobile, under the flow conditions on lg+ -->
      <div class="sticky bottom-0 z-20 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <VButton
          type="button"
          color="primary"
          size="lg"
          block
          :disabled="!canRunAnalysis"
          :aria-label="isLoading ? 'Running Analysis...' : 'Run NN Analysis'"
          :aria-describedby="!canRunAnalysis && !isLoading ? 'perf-run-reason' : undefined"
          @click="paramsFormRef?.submit()"
        >
          <span v-if="isLoading" class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          <span>{{ isLoading ? 'Running Analysis...' : 'Run NN Analysis' }}</span>
        </VButton>
        <p v-if="isLoading && progressMessage" class="mt-2 text-sm text-gray-500" role="status">{{ progressMessage }}</p>
        <p
          v-if="!canRunAnalysis && !isLoading"
          id="perf-run-reason"
          class="mt-2 flex items-start gap-1.5 text-sm text-warning-800"
          role="status"
        >
          <Icon name="heroicons:exclamation-circle" class="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
          <span v-if="selectionMode === 'specific'">
            <span v-if="preAnalysisSelectedAirfoils.length === 0">Please select at least one airfoil to analyze.</span>
            <span v-else-if="preAnalysisSelectedAirfoils.length > 300">Maximum 300 airfoils allowed. Please select fewer airfoils.</span>
            <span v-else-if="!paramsValid">Please fill in all analysis parameters with valid values.</span>
          </span>
          <span v-else>
            <span v-if="matchedCount === 0">No airfoils match the selected filters.</span>
            <span v-else-if="!paramsValid">Please fill in all analysis parameters with valid values.</span>
          </span>
        </p>
      </div>
    </div>
  </div>

  <!-- Loading State -->
  <VStateBlock v-if="isLoading && hasURLParams" variant="loading" description="Loading analysis data..." />

  <!-- Error State -->
  <VPanel v-else-if="error">
    <VStateBlock variant="error" title="Error Loading Data" :description="error">
      <VButton to="/performance" color="light">
        <Icon name="heroicons:arrow-left" class="h-4 w-4" />
        Go Back to Setup
      </VButton>
    </VStateBlock>
  </VPanel>

  <!-- Main Content: Plots & Table -->
  <!-- xl: widen past the page container (up to 100rem) so the plots keep their size next to two side columns -->
  <div v-else-if="state.allAirfoils.size > 0" class="xl:mx-[calc((100%_-_min(100vw_-_4rem,100rem))/2)]">
    <!-- Header -->
    <PageHeader title="Performance Compare">
      <template #subtitle>
        <span class="num">{{ state.allAirfoils.size }}</span> airfoil{{ state.allAirfoils.size !== 1 ? 's' : '' }} analyzed with
        <a
          href="https://github.com/peterdsharpe/NeuralFoil"
          target="_blank"
          rel="noopener"
          class="font-medium text-primary-600 underline hover:text-primary-700"
        >NeuralFoil</a>
        at the flow conditions shown. Filter and select airfoils in the sidebar to compare them.
      </template>
      <template #actions>
        <VBadge v-if="dataContext.Re">
          Re <span class="num">{{ dataContext.Re.toLocaleString() }}</span>
        </VBadge>
        <VBadge v-if="dataContext.Mach !== undefined">
          M <span class="num">{{ dataContext.Mach }}</span>
        </VBadge>
        <VBadge v-if="dataContext.nCrit !== undefined">
          N<sub>crit</sub> <span class="num">{{ dataContext.nCrit }}</span>
        </VBadge>
        <VBadge v-if="dataContext.alphaMin !== undefined || dataContext.alphaMax !== undefined">
          α <span class="num">{{ dataContext.alphaMin ?? '—' }}° to {{ dataContext.alphaMax ?? '—' }}°</span>
        </VBadge>
        <VBadge tone="primary">
          <span class="num">{{ state.allAirfoils.size }}</span> airfoils
        </VBadge>
      </template>
    </PageHeader>

    <!-- lg: sidebar (summary, filters, airfoil list) | results. xl: summary + filters | results | airfoil list -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-4 xl:grid-cols-[17rem_minmax(0,1fr)_14rem]">
      <!-- Sidebar; at xl it dissolves (contents) so its two children become the outer columns -->
      <div class="flex flex-col gap-4 lg:sticky lg:top-[4.5rem] lg:col-span-1 lg:max-h-[calc(100vh-5.5rem)] lg:self-start lg:overflow-y-auto xl:contents">
        <CompareSidebar
          class="xl:sticky xl:top-[4.5rem] xl:col-start-1 xl:row-start-1 xl:max-h-[calc(100vh-5.5rem)] xl:self-start xl:overflow-y-auto"
          :filters="state.filters"
          :filtered-airfoils="[...state.filteredAirfoils]"
          :selected-airfoils="[...state.selectedAirfoils]"
          :total-count="state.allAirfoils.size"
          :data-context="dataContext"
          :filter-ranges="getFilterRanges"
          :performance-mode="performanceMode"
          @update-filter="updateFilter"
          @reset-filters="resetFilters"
          @update-performance-mode="performanceMode = $event"
        />
        <CompareAirfoilList
          class="xl:sticky xl:top-[4.5rem] xl:col-start-3 xl:row-start-1 xl:max-h-[calc(100vh-5.5rem)] xl:self-start xl:overflow-y-auto"
          :filtered-airfoils="[...state.filteredAirfoils]"
          :selected-airfoils="[...state.selectedAirfoils]"
          @set-selected="setSelectedAirfoils"
          @toggle-selection="toggleAirfoilSelection"
          @select-all="selectAllFiltered"
          @deselect-all="deselectAll"
          @reset-analysis="() => { resetAnalysis(); router.push('/performance') }"
        />
      </div>

      <!-- Main Content: Plots & Table -->
      <section class="min-w-0 rounded-xl border border-gray-200 bg-white lg:col-span-3 xl:col-span-1 xl:col-start-2 xl:row-start-1" aria-label="Comparison results">
        <!-- Tabs; overflow-y-hidden: overflow-x-auto makes y auto too, and the tabs' -mb-px adds 1px of vertical scroll -->
        <div class="flex gap-2 overflow-x-auto overflow-y-hidden border-b border-gray-200 px-2 sm:px-3" role="tablist">
          <button
            v-for="tab in ([
              { id: 'plots', label: 'Polar Plots' },
              { id: 'table', label: 'Summary Table' },
              { id: 'scatter', label: 'Scatter Plot' },
              { id: 'notes', label: 'Notes' },
              { id: 'calculator', label: 'Calculator' },
            ] as const)"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.id"
            class="shrink-0 whitespace-nowrap"
            :class="navTabButtonClasses(activeTab === tab.id)"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Tab Content -->
        <div class="p-4 sm:p-5" role="tabpanel">
          <!-- Polar Plots Tab -->
          <div v-if="activeTab === 'plots'">
            <ComparePlots
              v-if="getSelectedAirfoilsData.length > 0"
              :airfoils="getSelectedAirfoilsData"
              :performance-mode="performanceMode"
            />
            <VStateBlock
              v-else
              icon="heroicons:chart-bar"
              title="No airfoils selected"
              description="Please select airfoils from the sidebar to compare."
            />
          </div>

          <!-- Summary Table Tab -->
          <div v-if="activeTab === 'table'">
            <CompareSummaryTable
              v-if="getSummaryData.length > 0"
              :summary-data="getSummaryData"
              :design-alpha="state.filters.targetAOA"
            />
            <VStateBlock
              v-else
              icon="heroicons:table-cells"
              title="No airfoils selected"
              description="Please select airfoils from the sidebar to compare."
            />
          </div>

          <!-- Scatter Plot Tab -->
          <div v-if="activeTab === 'scatter'">
            <SummaryScatterPlot
              v-if="getSummaryData.length > 0"
              v-model:x-axis="scatterXAxis"
              v-model:y-axis="scatterYAxis"
              :summary-data="getSummaryData"
              :design-alpha="state.filters.targetAOA"
            />
            <VStateBlock
              v-else
              icon="heroicons:chart-bar"
              title="No airfoils selected"
              description="Please select airfoils from the sidebar to compare."
            />
          </div>

          <!-- Notes Tab -->
          <div v-if="activeTab === 'notes'">
            <CompareNotesTab storage-key="notes" />
          </div>

          <!-- Calculator Tab -->
          <div v-if="activeTab === 'calculator'">
            <CompareCalculator
              v-if="getSummaryData.length > 0"
              :summary-data="getSummaryData"
              :design-alpha="state.filters.targetAOA"
            />
            <VStateBlock
              v-else
              icon="heroicons:calculator"
              title="No airfoils selected"
              description="Please select airfoils from the sidebar to use the calculator."
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
