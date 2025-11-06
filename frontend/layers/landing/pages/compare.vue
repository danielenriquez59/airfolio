<script setup lang="ts">
import { useCompare, type AirfoilPolarData } from '~/composables/useCompare'
import { usePerformanceStore } from '~/stores/performance'

definePageMeta({
  layout: 'detail',
})

const route = useRoute()
const router = useRouter()
const performanceStore = usePerformanceStore()

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

/**
 * Load analysis results from performance store
 */
const loadAnalysisData = async () => {
  isLoading.value = true
  error.value = null

  try {
    if (!performanceStore.hasData) {
      error.value =
        'No analysis data available. Please run an analysis first from the Performance page.'
      return
    }

    const results = performanceStore.getResults
    const names = performanceStore.getAirfoilNames
    const conditions = performanceStore.getConditions

    if (!results || names.length === 0) {
      error.value = 'Invalid analysis data. Please run a new analysis.'
      return
    }

    // Set data context
    if (conditions) {
      dataContext.value = {
        Re: conditions.Re,
        Mach: conditions.Mach,
        source: 'Analysis API',
      }
    }

    normalizeAnalysisResults(results, names)
  } catch (err: any) {
    console.error('Error loading analysis data:', err)
    error.value = err.message || 'Failed to load analysis data'
  } finally {
    isLoading.value = false
  }
}

/**
 * Update URL with current state (deep-linking for filters/selection only)
 */
const updateURL = () => {
  const query: Record<string, string> = {}

  // Serialize filters
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
  if (state.filters.minCLAtZero !== null) {
    query.minCLAtZero = state.filters.minCLAtZero.toString()
  }
  if (state.filters.targetCL !== null) {
    query.targetCL = state.filters.targetCL.toString()
  }
  if (state.filters.targetAOA !== null) {
    query.targetAOA = state.filters.targetAOA.toString()
  }
  if (state.filters.manualExclusions.length > 0) {
    query.exclusions = state.filters.manualExclusions.join(',')
  }

  // Serialize selection
  if (state.selectedAirfoils.length > 0) {
    query.selected = state.selectedAirfoils.join(',')
  }

  // Update URL without adding to history (only filters/selection, not data)
  router.replace({ query })
}

/**
 * Load state from URL on mount (filters and selection only)
 */
const loadStateFromURL = () => {
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
  if (query.minCLAtZero) {
    updateFilter('minCLAtZero', parseFloat(query.minCLAtZero as string))
  }
  if (query.targetCL) {
    updateFilter('targetCL', parseFloat(query.targetCL as string))
  }
  if (query.targetAOA) {
    updateFilter('targetAOA', parseFloat(query.targetAOA as string))
  }
  if (query.exclusions) {
    const exclusions = (query.exclusions as string).split(',').filter(Boolean)
    updateFilter('manualExclusions', exclusions)
  }
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

// Load data on mount
onMounted(() => {
  loadStateFromURL()
  loadAnalysisData()
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

    <!-- Loading State -->
    <div v-if="isLoading" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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

    <!-- Main Content -->
    <div v-else-if="state.allAirfoils.size > 0" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <!-- Sidebar: Filters & Selection -->
        <div class="lg:col-span-1">
          <CompareSidebar
            :filters="{ ...state.filters, manualExclusions: [...state.filters.manualExclusions] }"
            :filtered-airfoils="[...state.filteredAirfoils]"
            :selected-airfoils="[...state.selectedAirfoils]"
            :total-count="state.allAirfoils.size"
            :data-context="dataContext"
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

    <!-- Empty State: No Data -->
    <div v-else class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="text-center">
        <h2 class="text-xl font-semibold text-gray-900 mb-2">No Analysis Data</h2>
        <p class="text-gray-600 mb-6">
          No airfoil analysis data available. Please run an analysis first.
        </p>
        <NuxtLink
          to="/performance"
          class="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Go to Performance Analysis
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

