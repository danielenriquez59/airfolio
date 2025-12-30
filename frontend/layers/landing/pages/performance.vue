<script setup lang="ts">
import type { SearchParams } from '~/composables/useAirfoilSearch'
import { useDebounceFn } from '@vueuse/core'
import type { Database } from '~/types/database.types'
import { useCompare, type AirfoilPolarData } from '~/composables/useCompare'
import SummaryScatterPlot from '~/layers/landing/components/compare/SummaryScatterPlot.vue'
import CompareNotesTab from '~/layers/landing/components/compare/CompareNotesTab.vue'
import CompareCalculator from '~/layers/landing/components/compare/CompareCalculator.vue'

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

// Geometry filter states
const thicknessEnabled = ref(false)
const thicknessMin = ref<number | undefined>()
const thicknessMax = ref<number | undefined>()

const camberEnabled = ref(false)
const camberMin = ref<number | undefined>()
const camberMax = ref<number | undefined>()

// Analysis parameters
const reynoldsNumber = ref<number>(100)
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

  // Selection mode
  if (query.selectionMode === 'specific' || query.selectionMode === 'all') {
    selectionMode.value = query.selectionMode as 'all' | 'specific'
  }

  // Selected airfoil IDs (for specific mode)
  if (query.selectedIds) {
    const ids = (query.selectedIds as string).split(',').filter(Boolean)
    preAnalysisSelectedAirfoils.value = ids
  }
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

/**
 * Update URL with current state (deep-linking)
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

  // Serialize selection mode and selected IDs
  query.selectionMode = selectionMode.value
  if (selectionMode.value === 'specific' && preAnalysisSelectedAirfoils.value.length > 0) {
    query.selectedIds = preAnalysisSelectedAirfoils.value.join(',')
  }

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

// Check if we have URL params (from Performance page)
const hasURLParams = computed(() => {
  const query = route.query
  return !!(query.Re || query.includeName || query.thicknessEnabled || query.camberEnabled)
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

const includeNameValid = computed(() => validateNameFilter(includeName.value))
const excludeNameValid = computed(() => validateNameFilter(excludeName.value))

// Sanitize name filter inputs (remove non-alphanumeric, limit to 8 chars)
const sanitizeNameInput = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
}

// Helper function to build search params with default geometry filters when none are enabled
const buildSearchParams = (page: number = 1, limit: number = 1): SearchParams => {
  // If geometry filters are not enabled, use default filters (0-100% for both thickness and camber)
  // This ensures the backend always receives geometry filter values
  
  return {
    includeName: includeName.value.trim() || undefined,
    excludeName: excludeName.value.trim() || undefined,
    // Thickness: use user values if enabled, otherwise default to 0-100% (0.0-1.0)
    thicknessMin: thicknessEnabled.value && thicknessMin.value !== undefined
      ? percentageToDecimal(thicknessMin.value)
      : 0, // Default to 0% (0.0) if filter not enabled
    thicknessMax: thicknessEnabled.value && thicknessMax.value !== undefined
      ? percentageToDecimal(thicknessMax.value)
      : 1, // Default to 100% (1.0) if filter not enabled
    // Camber: use user values if enabled, otherwise default to 0-100% (0.0-1.0)
    camberMin: camberEnabled.value && camberMin.value !== undefined
      ? percentageToDecimal(camberMin.value)
      : 0, // Default to 0% (0.0) if filter not enabled
    camberMax: camberEnabled.value && camberMax.value !== undefined
      ? percentageToDecimal(camberMax.value)
      : 1, // Default to 100% (1.0) if filter not enabled
    page,
    limit,
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
      airfoilIds = searchResult.data.map(a => a.id)
      airfoilNames = searchResult.data.map(a => a.name)
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

// Debounced function to update airfoil count
const updateAirfoilCount = useDebounceFn(async () => {
  isLoadingCount.value = true
  try {
    const params = buildSearchParams(1, 1)
    const result = await searchAirfoils(params)
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
    // Fetch in batches to get all results (Supabase has row limits)
    const batchSize = 1000
    let allAirfoils: Airfoil[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      // Fetch with no filters - just get all airfoils
      const params: SearchParams = {
        page,
        limit: batchSize,
        // No filters - get everything
        thicknessMin: 0,
        thicknessMax: 1,
        camberMin: 0,
        camberMax: 1,
      }
      const result = await searchAirfoils(params)
      
      if (result.data.length > 0) {
        allAirfoils = [...allAirfoils, ...result.data]
        page++
        hasMore = result.data.length === batchSize && allAirfoils.length < result.count
      } else {
        hasMore = false
      }
    }

    allAirfoilsList.value = allAirfoils
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

  // Check if no filters are applied
  const hasNoFilters = !thicknessEnabled.value && !camberEnabled.value && 
                       !includeName.value.trim() && !excludeName.value.trim()
  
  // If no filters and we have cached all airfoils, use that instead
  if (hasNoFilters && allAirfoilsList.value.length > 0) {
    filteredAirfoilsList.value = allAirfoilsList.value
    return
  }
  
  // If no filters but background load is still in progress, wait for it
  if (hasNoFilters && isLoadingAllAirfoils.value) {
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
    // Fetch in batches to get all results (Supabase has row limits)
    const batchSize = 1000
    let allAirfoils: Airfoil[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const params = buildSearchParams(page, batchSize)
      const result = await searchAirfoils(params)
      
      if (result.data.length > 0) {
        allAirfoils = [...allAirfoils, ...result.data]
        page++
        hasMore = result.data.length === batchSize && allAirfoils.length < result.count
      } else {
        hasMore = false
      }
    }

    filteredAirfoilsList.value = allAirfoils
  } catch (error) {
    console.error('Error fetching filtered airfoils list:', error)
    filteredAirfoilsList.value = []
  } finally {
    isLoadingFilteredList.value = false
  }
}

// Watch filter changes to update count
watch([includeName, excludeName, thicknessEnabled, thicknessMin, thicknessMax, camberEnabled, camberMin, camberMax], async () => {
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
    const hasNoFilters = !thicknessEnabled.value && !camberEnabled.value && 
                         !includeName.value.trim() && !excludeName.value.trim()
    
    if (hasNoFilters && allAirfoilsList.value.length > 0) {
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
    const hasNoFilters = !thicknessEnabled.value && !camberEnabled.value && 
                         !includeName.value.trim() && !excludeName.value.trim()
    
    if (hasNoFilters && filteredAirfoilsList.value.length === 0) {
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

  // Selection mode and selected IDs
  queryParams.selectionMode = selectionMode.value
  if (selectionMode.value === 'specific' && preAnalysisSelectedAirfoils.value.length > 0) {
    queryParams.selectedIds = preAnalysisSelectedAirfoils.value.join(',')
  }

  router.replace({ query: queryParams })
  
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
  loadPerformanceFiltersFromURL()
  
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
  <div v-if="!hasURLParams || state.allAirfoils.size === 0" class="max-w-6xl mx-auto">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Performance Compare</h1>
      <p class="text-lg text-gray-600">
        Configure geometry filters and flow conditions to run a
        <a
          href="https://github.com/peterdsharpe/NeuralFoil"
          target="_blank"
          rel="noopener"
          class="text-indigo-600 underline hover:text-indigo-800"
        >NeuralFoil</a>
        powered aerodynamic airfoil comparison!
      </p>
    </div>

    <!-- Airfoil Comparison Selection Section -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Airfoil Comparison Selection</h2>
      
      <!-- Toggle Switch Row -->
      <div class="mb-4 pb-4 border-b border-gray-200">
        <VToggle
          :model-value="selectionMode === 'specific'"
          left-label="All matching airfoils"
          right-label="Selected airfoils only"
          @update:model-value="(val: boolean) => { selectionMode = val ? 'specific' : 'all' }"
        />
      </div>

      <!-- Matching Airfoils Count (only visible in "All matching airfoils" mode) -->
      <div v-if="selectionMode === 'all'" class="mb-4">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">Matching airfoils:</span>
          <span v-if="isLoadingCount" class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></span>
          <span v-else class="text-sm font-semibold text-gray-900">{{ matchedCount }} airfoil{{ matchedCount !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <!-- Conditional Content -->
      <!-- Show filters when "All matching airfoils" mode -->
      <div v-if="selectionMode === 'all'" class="space-y-4">
        <!-- Geometry Filters (Thickness and Camber) -->
        <div class="space-y-4">
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

        <!-- Name Filters (Include and Exclude) -->
        <div class="pt-4 border-t border-gray-200 space-y-4">
          <!-- Include Name Filter -->
          <div class="flex items-center gap-4 flex-wrap">
            <label class="text-sm font-medium text-gray-700 min-w-[140px]">
              Include Foils with
            </label>
            <div class="flex items-center gap-2 flex-1">
              <VInput
                :model-value="includeName"
                type="text"
                maxlength="8"
                placeholder="e.g., NACA"
                size="sm"
                wrapper-class="max-w-[120px]"
                :class="{ 'border-red-500': includeName && !includeNameValid }"
                @update:model-value="(val: string | number | undefined) => { includeName = sanitizeNameInput(String(val || '')) }"
              />
              <span class="text-sm text-gray-600">in the name</span>
            </div>
            <p v-if="includeName && !includeNameValid" class="text-xs text-red-600 mt-1">
              Only alphanumeric characters allowed (max 8)
            </p>
          </div>

          <!-- Exclude Name Filter -->
          <div class="flex items-center gap-4 flex-wrap">
            <label class="text-sm font-medium text-gray-700 min-w-[140px]">
              Exclude Foils with
            </label>
            <div class="flex items-center gap-2 flex-1">
              <VInput
                :model-value="excludeName"
                type="text"
                maxlength="8"
                placeholder="e.g., TEST"
                size="sm"
                wrapper-class="max-w-[120px]"
                :class="{ 'border-red-500': excludeName && !excludeNameValid }"
                @update:model-value="(val: string | number | undefined) => { excludeName = sanitizeNameInput(String(val || '')) }"
              />
              <span class="text-sm text-gray-600">in the name</span>
            </div>
            <p v-if="excludeName && !excludeNameValid" class="text-xs text-red-600 mt-1">
              Only alphanumeric characters allowed (max 8)
            </p>
          </div>
        </div>
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
        :disabled="!canRunAnalysis"
        :class="[
          'w-full px-6 py-3 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2',
          canRunAnalysis
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        ]"
        @click="paramsFormRef?.submit()"
      >
        <span v-if="isLoading" class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
        <span>{{ isLoading ? 'Running Analysis...' : 'Run Performance Analysis' }}</span>
      </button>
      <p v-if="!canRunAnalysis" class="mt-2 text-xs text-gray-500 text-center">
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

  <!-- Loading State -->
  <div v-if="isLoading && hasURLParams" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="text-center">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      <p class="mt-4 text-gray-600">Loading analysis data...</p>
    </div>
  </div>

  <!-- Error State -->
  <div v-else-if="error" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="bg-red-50 border border-red-200 rounded-lg p-6">
      <h2 class="text-lg font-semibold text-red-900 mb-2">Error Loading Data</h2>
      <p class="text-red-800">{{ error }}</p>
      <NuxtLink
        to="/performance"
        class="mt-4 inline-block text-sm font-medium text-red-700 hover:text-red-900"
      >
        ← Go Back to Setup
      </NuxtLink>
    </div>
  </div>

  <!-- Main Content: Plots & Table -->
  <div v-else-if="state.allAirfoils.size > 0" class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
          :performance-mode="performanceMode"
          @update-filter="updateFilter"
          @set-selected="setSelectedAirfoils"
          @toggle-selection="toggleAirfoilSelection"
          @select-all="selectAllFiltered"
          @deselect-all="deselectAll"
          @reset-filters="resetFilters"
          @update-performance-mode="performanceMode = $event"
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
              <button
                :class="[
                  'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'scatter'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                ]"
                @click="activeTab = 'scatter'"
              >
                Scatter Plot
              </button>
              <button
                :class="[
                  'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'notes'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                ]"
                @click="activeTab = 'notes'"
              >
                Notes
              </button>
              <button
                :class="[
                  'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'calculator'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                ]"
                @click="activeTab = 'calculator'"
              >
                Calculator
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
                :performance-mode="performanceMode"
              />
              <div v-else class="text-center py-12 text-gray-500">
                <p>No airfoils selected. Please select airfoils from the sidebar to compare.</p>
              </div>
            </div>

            <!-- Summary Table Tab -->
            <div v-if="activeTab === 'table'" class="space-y-6">
              <CompareSummaryTable
                v-if="getSummaryData.length > 0"
                :summary-data="getSummaryData"
                :design-alpha="state.filters.targetAOA"
              />
              <div v-if="getSummaryData.length === 0" class="text-center py-12 text-gray-500">
                <p>No airfoils selected. Please select airfoils from the sidebar to compare.</p>
              </div>
            </div>

            <!-- Scatter Plot Tab -->
            <div v-if="activeTab === 'scatter'">
              <SummaryScatterPlot
                v-if="getSummaryData.length > 0"
                :summary-data="getSummaryData"
                :design-alpha="state.filters.targetAOA"
                v-model:x-axis="scatterXAxis"
                v-model:y-axis="scatterYAxis"
              />
              <div v-else class="text-center py-12 text-gray-500">
                <p>No airfoils selected. Please select airfoils from the sidebar to compare.</p>
              </div>
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
              <div v-else class="text-center py-12 text-gray-500">
                <p>No airfoils selected. Please select airfoils from the sidebar to use the calculator.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

