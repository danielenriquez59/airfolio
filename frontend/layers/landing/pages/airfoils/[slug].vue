<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { AnalysisConditions } from '~/composables/useAnalysis'
import { formatCategoryName, isValidCategory } from '~/utils/categoryUtils'
import AirfoilPolarPlots from '~/components/analysis/AirfoilPolarPlots.vue'
import AirfoilPerformanceCache from '~/layers/landing/components/airfoils/AirfoilPerformanceCache.vue'
type Airfoil = Database['public']['Tables']['airfoils']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type PerformanceCache = Database['public']['Tables']['performance_cache']['Row']

definePageMeta({
  layout: 'detail',
})

const route = useRoute()
const config = useRuntimeConfig()
const supportEmail = config.public.supportEmail
const { fetchAirfoilByName } = useAirfoils()
const { downloadLednicer, downloadSelig, downloadOpenVSP } = useAirfoilDownload()
const { submitAnalysis } = useAnalysis()
const { fetchCategories } = useCategories()

const airfoil = ref<Airfoil | null>(null)
const category = ref<Category | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const categoryMap = ref<Map<string, Category>>(new Map())

// Geometry tab state
const activeGeometryTab = ref<'plot' | 'points' | 'bezier'>('plot')

// Compute coordinate table data
const coordinateTableData = computed(() => {
  if (!airfoil.value) return []

  const upperX = airfoil.value.upper_x_coordinates || []
  const upperY = airfoil.value.upper_y_coordinates || []
  const lowerX = airfoil.value.lower_x_coordinates || []
  const lowerY = airfoil.value.lower_y_coordinates || []

  const maxLength = Math.max(upperX.length, lowerX.length)
  const rows = []

  for (let i = 0; i < maxLength; i++) {
    rows.push({
      index: i + 1,
      upperX: upperX[i] !== undefined ? upperX[i].toFixed(6) : '-',
      upperY: upperY[i] !== undefined ? upperY[i].toFixed(6) : '-',
      lowerX: lowerX[i] !== undefined ? lowerX[i].toFixed(6) : '-',
      lowerY: lowerY[i] !== undefined ? lowerY[i].toFixed(6) : '-',
    })
  }

  return rows
})

// Download format selection
const selectedFormat = ref<{ value: string; text: string } | null>(null)
const downloadFormats = [
  { value: 'lednicer', text: 'Lednicer Format' },
  { value: 'selig', text: 'Selig Format' },
  { value: 'openvsp', text: 'OpenVSP AF Format' },
]

// Handle download based on selected format
const handleDownload = () => {
  if (!airfoil.value || !selectedFormat.value) return
  
  try {
    switch (selectedFormat.value.value) {
      case 'lednicer':
        downloadLednicer(airfoil.value)
        break
      case 'selig':
        downloadSelig(airfoil.value)
        break
      case 'openvsp':
        downloadOpenVSP(airfoil.value)
        break
    }
  } catch (err: any) {
    console.error('Download error:', err)
    alert(err.message || 'Failed to download airfoil')
  }
}

// Modal state
const showAnalysisModal = ref(false)
const isRunningAnalysis = ref(false)
const analysisError = ref<string | null>(null)
const analysisParamsFormRef = ref<{ submit: () => void; isValid: boolean } | null>(null)

// Cache and plotting state
const cacheRefreshKey = ref(0)
const cacheRef = ref<{ refresh: () => Promise<void> } | null>(null)
const selectedCacheEntries = ref<PerformanceCache[]>([])
const performanceDataForPlots = ref<Array<{
  name: string
  alpha: number[]
  CL: number[]
  CD: number[]
  CM: number[]
}>>([])
const plotsRef = ref<{ resetZoom: () => void; toggleTooltips: () => void; tooltipsEnabled: boolean } | null>(null)
const tooltipsEnabled = ref(true)

const handleTooltipsToggled = (enabled: boolean) => {
  tooltipsEnabled.value = enabled
}

// Sync initial tooltip state when component is ready
watchEffect(() => {
  if (plotsRef.value) {
    tooltipsEnabled.value = plotsRef.value.tooltipsEnabled
  }
})

const airfoilSlug = computed(() => route.params.slug as string)

// Helper function to get display name (display_name if available, otherwise name)
const getDisplayName = (airfoil: Airfoil | null): string => {
  if (!airfoil) return ''
  return airfoil.display_name || airfoil.name
}

// Helper function to create URL-friendly slug from airfoil name
const createSlug = (name: string): string => {
  return encodeURIComponent(name)
}

/**
 * Format condition inputs into readable string (same as in AirfoilPerformanceCache)
 */
const formatCondition = (inputs: any): string => {
  if (!inputs || typeof inputs !== 'object') return 'Unknown conditions'
  
  const parts: string[] = []
  
  if (inputs.Re !== undefined && inputs.Re !== null) {
    const re = inputs.Re
    if (re >= 1000) {
      parts.push(`Re ${(re / 1000).toFixed(0)}k`)
    } else {
      parts.push(`Re ${re.toFixed(0)}`)
    }
  }
  
  if (inputs.Mach !== undefined && inputs.Mach !== null) {
    parts.push(`Mach ${inputs.Mach.toFixed(1)}`)
  }
  
  if (inputs.n_crit !== undefined && inputs.n_crit !== null) {
    parts.push(`Ncrit ${inputs.n_crit.toFixed(0)}`)
  }
  
  // Alpha range - format as "AoA Range [start, end]"
  if (inputs.alpha_range && Array.isArray(inputs.alpha_range) && inputs.alpha_range.length === 3) {
    const [start, end] = inputs.alpha_range
    parts.push(`AoA Range [${start.toFixed(0)}, ${end.toFixed(0)}]`)
  }
  
  // Control surface fraction - only show if not 0
  const csFrac = inputs.control_surface_fraction ?? 0
  if (csFrac !== 0) {
    parts.push(`Control Fraction ${csFrac.toFixed(1)}`)
  }
  
  // Control surface deflection - only show if not 0
  const csDef = inputs.control_surface_deflection ?? 0
  if (csDef !== 0) {
    parts.push(`Control Deflection ${csDef.toFixed(1)}`)
  }
  
  return parts.join(', ')
}

/**
 * Handle analysis params submit from form
 */
const handleModalSubmit = async (params: {
  reynoldsNumber: number
  machNumber: number
  alphaMin: number
  alphaMax: number
  nCrit: number
}) => {
  if (!airfoil.value?.id) return
  
  isRunningAnalysis.value = true
  analysisError.value = null
  
  try {
    const conditions: AnalysisConditions = {
      Re: params.reynoldsNumber * 1000,
      Mach: params.machNumber,
      alpha_range: [params.alphaMin, params.alphaMax, 0.5],
      n_crit: params.nCrit,
      control_surface_fraction: 0,
      control_surface_deflection: 0,
    }
    
    const response = await submitAnalysis([airfoil.value.id], conditions)
    
    // Refresh cache list by incrementing key to force component re-render
    cacheRefreshKey.value++
    
    // Also try calling refresh method if available
    await nextTick()
    if (cacheRef.value && typeof cacheRef.value.refresh === 'function') {
      await cacheRef.value.refresh()
    }
    
    // Close modal
    showAnalysisModal.value = false
  } catch (err: any) {
    console.error('Error running analysis:', err)
    analysisError.value = err.message || 'Analysis failed'
  } finally {
    isRunningAnalysis.value = false
  }
}

/**
 * Handle selection change from cache component
 */
const handleSelectionChange = async (entries: PerformanceCache[]) => {
  selectedCacheEntries.value = entries
  
  // Transform cache entries to plot format
  performanceDataForPlots.value = entries.map(entry => {
    const outputs = entry.outputs as any
    return {
      name: formatCondition(entry.inputs),
      alpha: outputs?.alpha || [],
      CL: outputs?.CL || [],
      CD: outputs?.CD || [],
      CM: outputs?.CM || [],
    }
  })
}

// Fetch airfoil data by name (slug)
onMounted(async () => {
  try {
    loading.value = true
    error.value = null
    
    // Fetch categories map
    const categories = await fetchCategories()
    categories.forEach(cat => {
      categoryMap.value.set(cat.id, cat)
    })
    
    const data = await fetchAirfoilByName(airfoilSlug.value)
    
    if (!data) {
      error.value = 'Airfoil not found'
      return
    }
    
    airfoil.value = data
    
    // Get category if airfoil has one
    if (data.category && categoryMap.value.has(data.category)) {
      category.value = categoryMap.value.get(data.category) || null
    }
    
    // Update URL if slug doesn't match (for proper SEO/redirects)
    const currentSlug = createSlug(data.name)
    if (route.params.slug !== currentSlug) {
      await navigateTo(`/airfoils/${currentSlug}`, { replace: true })
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load airfoil'
    console.error('Error loading airfoil:', err)
  } finally {
    loading.value = false
  }
})

useHead({
  title: airfoil.value 
    ? `${getDisplayName(airfoil.value)} - Airfoil Details | Airfolio` 
    : 'Airfoil Details - Airfolio',
  meta: [
    {
      name: 'description',
      content: airfoil.value 
        ? `View geometry, performance data, and analysis results for ${getDisplayName(airfoil.value)}. ${airfoil.value.description || 'Explore aerodynamic characteristics and download coordinates.'}`
        : 'View detailed airfoil geometry, performance data, and analysis results.'
    }
  ]
})
</script>

<template>
  <div class="bg-white py-8">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <p class="text-red-600 text-lg mb-4">{{ error }}</p>
        <NuxtLink
          to="/"
          class="text-indigo-600 hover:text-indigo-800 underline"
        >
          Return to Home
        </NuxtLink>
      </div>

      <!-- Airfoil Details -->
      <div v-else-if="airfoil" class="max-w-4xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-4xl font-bold text-gray-900 uppercase tracking-wide mb-2">
            {{ getDisplayName(airfoil).toUpperCase() }}
          </h1>
          <p v-if="airfoil.description" class="text-lg text-gray-600">
            {{ airfoil.description }}
          </p>
        </div>

        <!-- Geometry Visualization -->
        <div class="mb-8">
          <div class="bg-white rounded-lg shadow">
            <!-- Tabs -->
            <div class="border-b border-gray-200">
              <nav class="flex -mb-px">
                <button
                  type="button"
                  :class="[
                    'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                    activeGeometryTab === 'plot'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  ]"
                  @click="activeGeometryTab = 'plot'"
                >
                  Plot
                </button>
                <button
                  type="button"
                  :class="[
                    'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                    activeGeometryTab === 'points'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  ]"
                  @click="activeGeometryTab = 'points'"
                >
                  Points
                </button>
                <button
                  type="button"
                  :class="[
                    'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                    activeGeometryTab === 'bezier'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  ]"
                  @click="activeGeometryTab = 'bezier'"
                >
                  Bezier Fit
                </button>
              </nav>
            </div>

            <!-- Tab Content -->
            <div class="p-6">
              <!-- Plot Tab -->
              <div v-if="activeGeometryTab === 'plot'" class="h-[400px]">
                <AirfoilGeometry
                  v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
                  :upper-x="airfoil.upper_x_coordinates"
                  :upper-y="airfoil.upper_y_coordinates"
                  :lower-x="airfoil.lower_x_coordinates"
                  :lower-y="airfoil.lower_y_coordinates"
                  :name="getDisplayName(airfoil)"
                  :aspect-ratio="3"
                  :show-grid="true"
                  :zoomable="true"
                  :show-points-on-hover="false"
                />
                <div v-else class="text-center py-8 text-gray-400">
                  Geometry data not available
                </div>
              </div>

              <!-- Points Tab -->
              <div v-else-if="activeGeometryTab === 'points'" class="h-[400px] overflow-auto">
                <div v-if="coordinateTableData.length > 0" class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50 sticky top-0">
                      <tr>
                        <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Index
                        </th>
                        <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Upper X
                        </th>
                        <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Upper Y
                        </th>
                        <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Lower X
                        </th>
                        <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Lower Y
                        </th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      <tr v-for="row in coordinateTableData" :key="row.index" class="hover:bg-gray-50">
                        <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {{ row.index }}
                        </td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm font-mono text-gray-900">
                          {{ row.upperX }}
                        </td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm font-mono text-gray-900">
                          {{ row.upperY }}
                        </td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm font-mono text-gray-900">
                          {{ row.lowerX }}
                        </td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm font-mono text-gray-900">
                          {{ row.lowerY }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="h-full flex items-center justify-center text-gray-400">
                  Coordinate data not available
                </div>
              </div>

              <!-- Bezier Fit Tab -->
              <div v-else-if="activeGeometryTab === 'bezier'">
                <BezierFitTab
                  v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
                  :upper-x="airfoil.upper_x_coordinates"
                  :upper-y="airfoil.upper_y_coordinates"
                  :lower-x="airfoil.lower_x_coordinates"
                  :lower-y="airfoil.lower_y_coordinates"
                  :airfoil-name="getDisplayName(airfoil)"
                />
                <div v-else class="h-[400px] flex items-center justify-center text-gray-400">
                  Geometry data not available for Bezier fitting
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Metadata -->
        <div class="mb-8">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 class="text-xl font-semibold text-gray-900 mb-4">Geometry Parameters</h2>
                <dl class="space-y-3">
                  <div v-if="airfoil.thickness_pct">
                    <dt class="text-sm text-gray-500">Thickness (t/c)</dt>
                    <dd class="text-lg font-semibold text-gray-900">
                      {{ (airfoil.thickness_pct * 100).toFixed(2) }}%
                      <span v-if="airfoil.thickness_loc_pct" class="text-sm text-gray-600 font-normal">
                        @ {{ (airfoil.thickness_loc_pct * 100).toFixed(1) }}% x/c
                      </span>
                    </dd>
                  </div>
                  <div v-if="airfoil.camber_pct">
                    <dt class="text-sm text-gray-500">Camber (y/c)</dt>
                    <dd class="text-lg font-semibold text-gray-900">
                      {{ (airfoil.camber_pct * 100).toFixed(2) }}%
                      <span v-if="airfoil.camber_loc_pct" class="text-sm text-gray-600 font-normal">
                        @ {{ (airfoil.camber_loc_pct * 100).toFixed(1) }}% x/c
                      </span>
                    </dd>
                  </div>
                  <div v-if="airfoil.le_radius">
                    <dt class="text-sm text-gray-500">Leading Edge Radius</dt>
                    <dd class="text-lg font-semibold text-gray-900">
                      {{ airfoil.le_radius.toFixed(4) }}
                    </dd>
                  </div>
                  <div v-if="airfoil.te_thickness">
                    <dt class="text-sm text-gray-500">Trailing Edge Thickness</dt>
                    <dd class="text-lg font-semibold text-gray-900">
                      {{ airfoil.te_thickness.toFixed(4) }}
                    </dd>
                  </div>
                  <div v-if="airfoil.upper_surface_nodes !== null">
                    <dt class="text-sm text-gray-500">Upper Surface Nodes</dt>
                    <dd class="text-lg font-semibold text-gray-900">
                      {{ airfoil.upper_surface_nodes }}
                    </dd>
                  </div>
                  <div v-if="airfoil.lower_surface_nodes !== null">
                    <dt class="text-sm text-gray-500">Lower Surface Nodes</dt>
                    <dd class="text-lg font-semibold text-gray-900">
                      {{ airfoil.lower_surface_nodes }}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h2 class="text-xl font-semibold text-gray-900 mb-4">Additional Information</h2>
                <dl class="space-y-3">
                  <div v-if="category">
                    <dt class="text-sm text-gray-500">Category</dt>
                    <dd>
                      <span class="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full">
                        {{ formatCategoryName(category.name) }}
                      </span>
                    </dd>
                  </div>
                  <div v-if="airfoil.source_url">
                    <dt class="text-sm text-gray-500">Source</dt>
                    <dd>
                      <a
                        :href="airfoil.source_url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                      >
                        {{ airfoil.source_url }}
                        <Icon name="heroicons:arrow-top-right-on-square" class="h-4 w-4" />
                      </a>
                    </dd>
                  </div>
                  <div v-if="airfoil.created_at">
                    <dt class="text-sm text-gray-500">Added</dt>
                    <dd class="text-gray-900">
                      {{ new Date(airfoil.created_at).toLocaleDateString() }}
                    </dd>
                  </div>
                  <div
                    v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates && airfoil.upper_surface_nodes && airfoil.lower_surface_nodes"
                  >
                    <dt class="text-sm text-gray-500 flex items-center gap-1">
                      Download Airfoil Coordinates
                      <div class="relative group">
                        <Icon
                          name="heroicons:information-circle"
                          class="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help"
                        />
                        <div class="absolute left-0 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                          <div class="space-y-2">
                            <div>
                              <span class="font-semibold">Lednicer:</span>
                              <span class="text-gray-300"> Upper and lower surfaces listed separately with point counts in the header.</span>
                            </div>
                            <div>
                              <span class="font-semibold">Selig:</span>
                              <span class="text-gray-300"> Continuous loop from upper TE around LE to lower TE. Most common format for XFOIL.</span>
                            </div>
                            <div>
                              <span class="font-semibold">OpenVSP AF:</span>
                              <span class="text-gray-300"> Includes header with symmetry flag and point counts. Used by OpenVSP.</span>
                            </div>
                          </div>
                          <div class="absolute left-3 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </dt>
                    <dd class="flex items-center gap-2">
                      <VSelect
                        v-model="selectedFormat"
                        :items="downloadFormats"
                        placeholder="Select format..."
                        class="flex-1"
                      />
                      <button
                        type="button"
                        @click="handleDownload"
                        :disabled="!selectedFormat"
                        class="px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
                        Download
                      </button>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
        </div>
        
        <!-- Analysis Buttons -->
        <div v-if="airfoil.id" class="mb-8 space-y-3 border-t border-gray-200 pt-8">
          <button
            type="button"
            @click="showAnalysisModal = true"
            class="w-full px-6 py-3 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center gap-2"
          >
            <Icon name="heroicons:play" class="h-5 w-5" />
            Run Performance Analysis
          </button>
          <NuxtLink
            :to="`/control-surface?airfoil=${encodeURIComponent(airfoilSlug)}`"
            class="block w-full px-6 py-3 bg-gray-200 text-gray-900 rounded-md font-medium hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 flex items-center justify-center gap-2"
          >
            <Icon name="heroicons:adjustments-horizontal" class="h-5 w-5" />
            Control Surface Analysis
          </NuxtLink>
        </div>

        <!-- Performance Data (Combined Cache and Plots) -->
        <div v-if="airfoil.id" class="mb-8">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Performance Data</h2>
          
          <!-- Performance Cache Table -->
          <div class="mb-6">
            <AirfoilPerformanceCache 
              :key="`cache-${airfoil.id}-${cacheRefreshKey}`"
              ref="cacheRef"
              :airfoil-id="airfoil.id"
              :no-card="true"
              @selection-change="handleSelectionChange"
            />
          </div>

          <!-- Performance Plots -->
          <AirfoilPolarPlots ref="plotsRef" :performance-data="performanceDataForPlots" @tooltips-toggled="handleTooltipsToggled" />
        </div>

        <!-- Data Accuracy Notice -->
        <div class="mt-8 pt-6 border-t border-gray-200">
          <p class="text-xs text-gray-400 text-center">
            We need your help to keep an accurate database. If you suspect that there is an issue with this airfoil's geometry, stats, categorization, or description please email us at 
            <a :href="`mailto:${supportEmail}`" class="text-gray-500 hover:text-gray-600 underline">{{ supportEmail }}</a>.
          </p>
        </div>
      </div>

      <!-- Analysis Modal -->
      <VModal v-model="showAnalysisModal">
        <VModalHeader dismissable>
          Run Performance Analysis
        </VModalHeader>
        <VModalBody>
          <div class="space-y-4">
            <p class="text-sm text-gray-600">
              Configure the flow conditions for the performance analysis.
            </p>
            
            <AnalysisParametersForm
              ref="analysisParamsFormRef"
              @submit="handleModalSubmit"
            />

            <!-- Error Message -->
            <div v-if="analysisError" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p class="text-sm text-red-800">{{ analysisError }}</p>
            </div>

            <!-- Loading State -->
            <div v-if="isRunningAnalysis" class="flex items-center justify-center py-4">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span class="ml-3 text-sm text-gray-600">Running analysis...</span>
            </div>
          </div>
        </VModalBody>
        <VModalFooter>
          <button
            type="button"
            @click="showAnalysisModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            :disabled="isRunningAnalysis"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="analysisParamsFormRef?.submit()"
            :disabled="!analysisParamsFormRef?.isValid || isRunningAnalysis"
            :class="[
              'px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
              analysisParamsFormRef?.isValid && !isRunningAnalysis
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            ]"
          >
            Run Analysis
          </button>
        </VModalFooter>
      </VModal>
  </div>
</template>
