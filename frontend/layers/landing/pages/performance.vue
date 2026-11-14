<script setup lang="ts">
import type { SearchParams } from '~/composables/useAirfoilSearch'
import { useDebounceFn } from '@vueuse/core'
import type { Database } from '~/types/database.types'
import { useCompare, type AirfoilPolarData } from '~/composables/useCompare'
import SummaryScatterPlot from '~/layers/landing/components/compare/SummaryScatterPlot.vue'
import CompareNotesTab from '~/layers/landing/components/compare/CompareNotesTab.vue'
import CompareCalculator from '~/layers/landing/components/compare/CompareCalculator.vue'
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

const areaEnabled = ref(false)
const areaMin = ref<number | undefined>()
const areaMax = ref<number | undefined>()

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
  if (query.areaEnabled === 'true') {
    areaEnabled.value = true
    if (query.areaMin) {
      areaMin.value = parseFloat(query.areaMin as string)
    }
    if (query.areaMax) {
      areaMax.value = parseFloat(query.areaMax as string)
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
  if (query.maxMaxLD) {
    updateFilter('maxMaxLD', parseFloat(query.maxMaxLD as string))
  }
  if (query.minCLMax) {
    updateFilter('minCLMax', parseFloat(query.minCLMax as string))
  }
  if (query.maxCLMax) {
    updateFilter('maxCLMax', parseFloat(query.maxCLMax as string))
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
  if (areaEnabled.value) {
    if (areaMin.value !== undefined) {
      query.areaMin = areaMin.value.toString()
    }
    if (areaMax.value !== undefined) {
      query.areaMax = areaMax.value.toString()
    }
    query.areaEnabled = 'true'
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
  if (state.filters.maxMaxLD !== null) {
    query.maxMaxLD = state.filters.maxMaxLD.toString()
  }
  if (state.filters.minCLMax !== null) {
    query.minCLMax = state.filters.minCLMax.toString()
  }
  if (state.filters.maxCLMax !== null) {
    query.maxCLMax = state.filters.maxCLMax.toString()
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
    // Area: use user values if enabled, otherwise default to 0-100% (0.0-1.0)
    areaMin: areaEnabled.value && areaMin.value !== undefined
      ? percentageToDecimal(areaMin.value)
      : 0,
    areaMax: areaEnabled.value && areaMax.value !== undefined
      ? percentageToDecimal(areaMax.value)
      : 1,
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
        areaMin: areaEnabled.value && areaMin.value !== undefined
          ? percentageToDecimal(areaMin.value)
          : undefined,
        areaMax: areaEnabled.value && areaMax.value !== undefined
          ? percentageToDecimal(areaMax.value)
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
        areaMin: 0,
        areaMax: 1,
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
  const hasNoFilters = !thicknessEnabled.value && !camberEnabled.value && !areaEnabled.value &&
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
watch([includeName, excludeName, thicknessEnabled, thicknessMin, thicknessMax, camberEnabled, camberMin, camberMax, areaEnabled, areaMin, areaMax], async () => {
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
    const hasNoFilters = !thicknessEnabled.value && !camberEnabled.value && !areaEnabled.value &&
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
    const hasNoFilters = !thicknessEnabled.value && !camberEnabled.value && !areaEnabled.value &&
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
  if (areaEnabled.value) {
    if (areaMin.value !== undefined) {
      queryParams.areaMin = areaMin.value.toString()
    }
    if (areaMax.value !== undefined) {
      queryParams.areaMax = areaMax.value.toString()
    }
    queryParams.areaEnabled = 'true'
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

              <!-- Thickness Filter -->
              <label class="flex h-9 cursor-pointer items-center gap-2">
                <input
                  v-model="thicknessEnabled"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span class="text-sm font-medium text-gray-700">Thickness</span>
              </label>
              <VInput
                v-model.number="thicknessMin"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="0"
                class="num disabled:cursor-not-allowed disabled:text-gray-400"
                aria-label="Thickness min (%)"
                :disabled="!thicknessEnabled"
              />
              <VInput
                v-model.number="thicknessMax"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="100"
                class="num disabled:cursor-not-allowed disabled:text-gray-400"
                aria-label="Thickness max (%)"
                :disabled="!thicknessEnabled"
              />

              <!-- Camber Filter -->
              <label class="flex h-9 cursor-pointer items-center gap-2">
                <input
                  v-model="camberEnabled"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span class="text-sm font-medium text-gray-700">Camber</span>
              </label>
              <VInput
                v-model.number="camberMin"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="0"
                class="num disabled:cursor-not-allowed disabled:text-gray-400"
                aria-label="Camber min (%)"
                :disabled="!camberEnabled"
              />
              <VInput
                v-model.number="camberMax"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="100"
                class="num disabled:cursor-not-allowed disabled:text-gray-400"
                aria-label="Camber max (%)"
                :disabled="!camberEnabled"
              />

              <!-- Area Coefficient Filter -->
              <label class="flex h-9 cursor-pointer items-center gap-2">
                <input
                  v-model="areaEnabled"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span class="text-sm font-medium text-gray-700">Area</span>
              </label>
              <VInput
                v-model.number="areaMin"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="0"
                class="num disabled:cursor-not-allowed disabled:text-gray-400"
                aria-label="Area min (%)"
                :disabled="!areaEnabled"
              />
              <VInput
                v-model.number="areaMax"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="100"
                class="num disabled:cursor-not-allowed disabled:text-gray-400"
                aria-label="Area max (%)"
                :disabled="!areaEnabled"
              />
            </div>
          </fieldset>

          <!-- Name Filters (Include and Exclude) -->
          <fieldset class="border-t border-gray-200 pt-5">
            <legend class="sr-only">Name filters</legend>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label for="perf-include-name" class="mb-1 block text-sm font-medium text-gray-700">
                  Include names containing
                </label>
                <VInput
                  id="perf-include-name"
                  :model-value="includeName"
                  type="text"
                  maxlength="8"
                  placeholder="e.g., NACA"
                  :error="!!includeName && !includeNameValid"
                  @update:model-value="(val: string | number | undefined) => { includeName = sanitizeNameInput(String(val || '')) }"
                />
                <p v-if="includeName && !includeNameValid" class="mt-1 text-xs text-error-600">
                  Only alphanumeric characters allowed (max 8)
                </p>
              </div>

              <div>
                <label for="perf-exclude-name" class="mb-1 block text-sm font-medium text-gray-700">
                  Exclude names containing
                </label>
                <VInput
                  id="perf-exclude-name"
                  :model-value="excludeName"
                  type="text"
                  maxlength="8"
                  placeholder="e.g., TEST"
                  :error="!!excludeName && !excludeNameValid"
                  @update:model-value="(val: string | number | undefined) => { excludeName = sanitizeNameInput(String(val || '')) }"
                />
                <p v-if="excludeName && !excludeNameValid" class="mt-1 text-xs text-error-600">
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
          :aria-label="isLoading ? 'Running Analysis...' : 'Run Performance Analysis'"
          :aria-describedby="!canRunAnalysis && !isLoading ? 'perf-run-reason' : undefined"
          @click="paramsFormRef?.submit()"
        >
          <span v-if="isLoading" class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          <span>{{ isLoading ? 'Running Analysis...' : 'Run Performance Analysis' }}</span>
        </VButton>
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
  <div v-else-if="state.allAirfoils.size > 0">
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

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <!-- Sidebar: Filters & Selection -->
      <div class="lg:sticky lg:top-[4.5rem] lg:col-span-1 lg:max-h-[calc(100vh-5.5rem)] lg:self-start lg:overflow-y-auto">
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
          @reset-analysis="() => { resetAnalysis(); router.push('/performance') }"
          @update-performance-mode="performanceMode = $event"
        />
      </div>

      <!-- Main Content: Plots & Table -->
      <section class="min-w-0 rounded-xl border border-gray-200 bg-white lg:col-span-3" aria-label="Comparison results">
        <!-- Tabs -->
        <div class="flex gap-2 overflow-x-auto border-b border-gray-200 px-2 sm:px-3" role="tablist">
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
