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

// Main tab state
const activeTab = ref<'performance' | 'geometry' | 'export'>('performance')

// Geometry state
const showPoints = ref(false)
const copiedPoints = ref(false)
const bezierFitOpen = ref(false)

const copyPointsToClipboard = async () => {
  const header = 'Index\tUpper X\tUpper Y\tLower X\tLower Y'
  const rows = coordinateTableData.value.map(row =>
    `${row.index}\t${row.upperX}\t${row.upperY}\t${row.lowerX}\t${row.lowerY}`
  )
  await navigator.clipboard.writeText([header, ...rows].join('\n'))
  copiedPoints.value = true
  setTimeout(() => { copiedPoints.value = false }, 2000)
}

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

// Download handlers
const handleDownloadLednicer = () => {
  if (!airfoil.value) return
  try {
    downloadLednicer(airfoil.value)
  } catch (err: any) {
    console.error('Download error:', err)
    alert(err.message || 'Failed to download airfoil')
  }
}

const handleDownloadSelig = () => {
  if (!airfoil.value) return
  try {
    downloadSelig(airfoil.value)
  } catch (err: any) {
    console.error('Download error:', err)
    alert(err.message || 'Failed to download airfoil')
  }
}

const handleDownloadOpenVSP = () => {
  if (!airfoil.value) return
  try {
    downloadOpenVSP(airfoil.value)
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

// CSV export helpers
const copiedToClipboard = ref(false)

const generateCSV = (): string => {
  const lines: string[] = ['Mach,Re,aoa,CL,CD,CM']

  for (const entry of selectedCacheEntries.value) {
    const inputs = entry.inputs as any
    const outputs = entry.outputs as any
    const mach = inputs?.Mach ?? ''
    const re = inputs?.Re ?? ''
    const alphas = outputs?.alpha || []
    const CLs = outputs?.CL || []
    const CDs = outputs?.CD || []
    const CMs = outputs?.CM || []

    for (let i = 0; i < alphas.length; i++) {
      lines.push(`${mach},${re},${alphas[i]},${CLs[i]},${CDs[i]},${CMs[i]}`)
    }
  }

  return lines.join('\n')
}

const copyCSVToClipboard = async () => {
  const csv = generateCSV()
  await navigator.clipboard.writeText(csv)
  copiedToClipboard.value = true
  setTimeout(() => { copiedToClipboard.value = false }, 2000)
}

const downloadCSV = () => {
  const csv = generateCSV()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const name = airfoil.value ? (airfoil.value.display_name || airfoil.value.name) : 'airfoil'
  link.download = `${name}_performance.csv`
  link.click()
  URL.revokeObjectURL(url)
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
    <div v-else-if="airfoil">
      <!-- ZONE 1: Hero Strip -->
      <div class="mb-6">
        <!-- Title + Category Badge -->
        <div class="flex flex-wrap items-center gap-3 mb-2">
          <h1 class="text-3xl font-bold text-gray-900 uppercase tracking-wide">
            {{ getDisplayName(airfoil).toUpperCase() }}
          </h1>
          <span v-if="category" class="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full">
            {{ formatCategoryName(category.name) }}
          </span>
        </div>
        <p v-if="airfoil.description" class="text-lg text-gray-600 mb-6">
          {{ airfoil.description }}
        </p>

        <!-- Side-by-side layout -->
        <div class="flex flex-col lg:flex-row gap-6">
          <!-- Left: Compact Geometry (60%) -->
          <div class="lg:w-3/5">
            <AirfoilGeometry
              v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
              :upper-x="airfoil.upper_x_coordinates"
              :upper-y="airfoil.upper_y_coordinates"
              :lower-x="airfoil.lower_x_coordinates"
              :lower-y="airfoil.lower_y_coordinates"
              :name="getDisplayName(airfoil)"
              :aspect-ratio="5"
              :show-grid="true"
              :zoomable="false"
              :show-points-on-hover="false"
            />
            <div v-else class="bg-gray-50 rounded-lg h-32 flex items-center justify-center text-gray-400">
              Geometry data not available
            </div>
          </div>

          <!-- Right: Stat Cards (40%) -->
          <div class="lg:w-2/5">
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="grid grid-cols-2 gap-3">
                <!-- Thickness -->
                <div v-if="airfoil.thickness_pct" class="bg-white rounded-lg p-3 shadow-sm">
                  <dt class="text-xs text-gray-500 uppercase tracking-wide">Thickness</dt>
                  <dd class="text-lg font-semibold text-gray-900">
                    {{ (airfoil.thickness_pct * 100).toFixed(2) }}%
                  </dd>
                  <dd v-if="airfoil.thickness_loc_pct" class="text-xs text-gray-500">
                    @ {{ (airfoil.thickness_loc_pct * 100).toFixed(1) }}% x/c
                  </dd>
                </div>

                <!-- Camber -->
                <div v-if="airfoil.camber_pct !== null" class="bg-white rounded-lg p-3 shadow-sm">
                  <dt class="text-xs text-gray-500 uppercase tracking-wide">Camber</dt>
                  <dd class="text-lg font-semibold text-gray-900">
                    {{ (airfoil.camber_pct * 100).toFixed(2) }}%
                  </dd>
                  <dd v-if="airfoil.camber_loc_pct" class="text-xs text-gray-500">
                    @ {{ (airfoil.camber_loc_pct * 100).toFixed(1) }}% x/c
                  </dd>
                </div>

                <!-- LE Radius -->
                <div v-if="airfoil.le_radius" class="bg-white rounded-lg p-3 shadow-sm">
                  <dt class="text-xs text-gray-500 uppercase tracking-wide">LE Radius</dt>
                  <dd class="text-lg font-semibold text-gray-900">
                    {{ airfoil.le_radius.toFixed(4) }}
                  </dd>
                </div>

                <!-- TE Thickness -->
                <div v-if="airfoil.te_thickness" class="bg-white rounded-lg p-3 shadow-sm">
                  <dt class="text-xs text-gray-500 uppercase tracking-wide">TE Thickness</dt>
                  <dd class="text-lg font-semibold text-gray-900">
                    {{ airfoil.te_thickness.toFixed(4) }}
                  </dd>
                </div>

                <!-- TE Angle -->
                <div v-if="airfoil.te_angle" class="bg-white rounded-lg p-3 shadow-sm">
                  <dt class="text-xs text-gray-500 uppercase tracking-wide">TE Angle</dt>
                  <dd class="text-lg font-semibold text-gray-900">
                    {{ airfoil.te_angle.toFixed(1) }}&deg;
                  </dd>
                </div>

                <!-- Node Counts (de-emphasized) -->
                <div v-if="airfoil.upper_surface_nodes !== null || airfoil.lower_surface_nodes !== null" class="bg-white rounded-lg p-3 shadow-sm">
                  <dt class="text-xs text-gray-500 uppercase tracking-wide">Nodes</dt>
                  <dd class="text-sm text-gray-600">
                    <span v-if="airfoil.upper_surface_nodes !== null">{{ airfoil.upper_surface_nodes }} upper</span>
                    <span v-if="airfoil.upper_surface_nodes !== null && airfoil.lower_surface_nodes !== null"> / </span>
                    <span v-if="airfoil.lower_surface_nodes !== null">{{ airfoil.lower_surface_nodes }} lower</span>
                  </dd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ZONE 2: Quick Actions Bar -->
      <div v-if="airfoil.id" class="flex flex-wrap items-center gap-3 py-4 border-b border-gray-200 mb-6">
        <VButton
          color="primary"
          @click="showAnalysisModal = true"
        >
          <Icon name="heroicons:play" class="h-4 w-4" />
          Run Analysis
        </VButton>

        <NuxtLink
          :to="`/control-surface?airfoil=${encodeURIComponent(airfoilSlug)}`"
          class="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-900 rounded-md font-medium hover:bg-gray-200 transition-colors"
        >
          <Icon name="heroicons:adjustments-horizontal" class="h-4 w-4" />
          Control Surface
        </NuxtLink>

        <Dropdown
          v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
          right
        >
          <template #activator>
            <DropdownButton>
              <button
                type="button"
                class="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-900 rounded-md font-medium hover:bg-gray-200 transition-colors"
              >
                <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
                Download
                <Icon name="heroicons:chevron-down" class="h-4 w-4" />
              </button>
            </DropdownButton>
          </template>
          <DropdownItem text="Selig Format (.dat)" icon="heroicons:document-text" @click="handleDownloadSelig" />
          <DropdownItem text="Lednicer Format (.dat)" icon="heroicons:document-text" @click="handleDownloadLednicer" />
          <DropdownItem text="OpenVSP AF Format (.af)" icon="heroicons:document-text" @click="handleDownloadOpenVSP" />
        </Dropdown>
      </div>

      <!-- ZONE 3: Tabbed Content Area -->
      <div v-if="airfoil.id" class="bg-white rounded-lg shadow mb-8">
        <!-- Tab Navigation -->
        <div class="border-b border-gray-200">
          <nav class="flex -mb-px">
            <button
              type="button"
              :class="[
                'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'performance'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ]"
              @click="activeTab = 'performance'"
            >
              Performance
            </button>
            <button
              type="button"
              :class="[
                'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'geometry'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ]"
              @click="activeTab = 'geometry'"
            >
              Geometry
            </button>
            <button
              type="button"
              :class="[
                'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'export'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ]"
              @click="activeTab = 'export'"
            >
              Export &amp; Data
            </button>
          </nav>
        </div>

        <!-- Tab Content -->
        <div class="p-6">
          <!-- Performance Tab -->
          <div v-if="activeTab === 'performance'">
            <!-- Performance Cache Table -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Cached Results</h3>
                <div v-if="selectedCacheEntries.length > 0" class="flex gap-2">
                  <button
                    type="button"
                    @click="copyCSVToClipboard"
                    class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <Icon :name="copiedToClipboard ? 'heroicons:check' : 'heroicons:clipboard-document'" class="h-3.5 w-3.5" />
                    {{ copiedToClipboard ? 'Copied!' : 'Copy CSV' }}
                  </button>
                  <button
                    type="button"
                    @click="downloadCSV"
                    class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <Icon name="heroicons:arrow-down-tray" class="h-3.5 w-3.5" />
                    Download CSV
                  </button>
                </div>
              </div>
              <AirfoilPerformanceCache
                :key="`cache-${airfoil.id}-${cacheRefreshKey}`"
                ref="cacheRef"
                :airfoil-id="airfoil.id"
                :no-card="true"
                @selection-change="handleSelectionChange"
              />
            </div>

            <!-- Performance Plots -->
            <div v-if="performanceDataForPlots.length > 0">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Polar Plots</h3>
              <AirfoilPolarPlots ref="plotsRef" :performance-data="performanceDataForPlots" @tooltips-toggled="handleTooltipsToggled" />
            </div>

            <!-- Empty state CTA -->
            <div v-else-if="selectedCacheEntries.length === 0" class="text-center py-8 text-gray-500">
              <Icon name="heroicons:chart-bar" class="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p class="mb-4">No performance data available yet.</p>
              <VButton color="primary" @click="showAnalysisModal = true">
                <Icon name="heroicons:play" class="h-4 w-4" />
                Run Analysis
              </VButton>
            </div>
          </div>

          <!-- Geometry Tab -->
          <div v-if="activeTab === 'geometry'">
            <!-- Full Zoomable Geometry -->
            <div class="mb-6">
              <AirfoilGeometry
                v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
                :upper-x="airfoil.upper_x_coordinates"
                :upper-y="airfoil.upper_y_coordinates"
                :lower-x="airfoil.lower_x_coordinates"
                :lower-y="airfoil.lower_y_coordinates"
                :name="getDisplayName(airfoil)"
                :aspect-ratio="7"
                :show-grid="true"
                :zoomable="true"
                :show-points-on-hover="false"
              />
              <div v-else class="text-center py-8 text-gray-400">
                Geometry data not available
              </div>
            </div>

            <!-- Collapsible Coordinate Points Table -->
            <div v-if="coordinateTableData.length > 0" class="mb-6">
              <div class="w-full flex items-center justify-between">
                <button
                  type="button"
                  @click="showPoints = !showPoints"
                  class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <Icon
                    name="heroicons:chevron-right"
                    class="h-4 w-4 transition-transform"
                    :class="{ 'rotate-90': showPoints }"
                  />
                  {{ showPoints ? 'Hide Coordinates' : 'Show Coordinates' }}
                </button>
                <button
                  v-show="showPoints"
                  type="button"
                  @click="copyPointsToClipboard"
                  class="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
                  :title="copiedPoints ? 'Copied!' : 'Copy points to clipboard'"
                >
                  <Icon :name="copiedPoints ? 'heroicons:check' : 'heroicons:clipboard-document'" class="h-4 w-4" />
                </button>
              </div>
              <div v-show="showPoints" class="mt-2 h-[300px] overflow-auto">
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50 sticky top-0">
                      <tr>
                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Index</th>
                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Upper X</th>
                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Upper Y</th>
                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lower X</th>
                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lower Y</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      <tr v-for="row in coordinateTableData" :key="row.index" class="hover:bg-gray-50">
                        <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{{ row.index }}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm font-mono text-gray-900">{{ row.upperX }}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm font-mono text-gray-900">{{ row.upperY }}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm font-mono text-gray-900">{{ row.lowerX }}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm font-mono text-gray-900">{{ row.lowerY }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Collapsible Bezier Fit Section -->
            <details class="group border border-gray-200 rounded-lg">
              <summary class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 rounded-lg">
                <span class="font-medium text-gray-900">Bezier Curve Fitting</span>
                <Icon name="heroicons:chevron-down" class="h-5 w-5 text-gray-500 transition-transform group-open:rotate-180" />
              </summary>
              <div class="px-4 pb-4">
                <BezierFitTab
                  v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
                  :upper-x="airfoil.upper_x_coordinates"
                  :upper-y="airfoil.upper_y_coordinates"
                  :lower-x="airfoil.lower_x_coordinates"
                  :lower-y="airfoil.lower_y_coordinates"
                  :airfoil-name="getDisplayName(airfoil)"
                />
                <div v-else class="py-4 text-center text-gray-400">
                  Geometry data not available for Bezier fitting
                </div>
              </div>
            </details>
          </div>

          <!-- Export & Data Tab -->
          <div v-if="activeTab === 'export'">
            <!-- Download Format Cards -->
            <div class="mb-8">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Download Coordinates</h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Selig Format -->
                <div class="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
                  <h4 class="font-medium text-gray-900 mb-1">Selig Format</h4>
                  <p class="text-sm text-gray-500 mb-3">Continuous loop from upper TE around LE to lower TE. Most common format for XFOIL.</p>
                  <button
                    type="button"
                    @click="handleDownloadSelig"
                    :disabled="!airfoil.upper_x_coordinates"
                    class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
                    Download .dat
                  </button>
                </div>

                <!-- Lednicer Format -->
                <div class="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
                  <h4 class="font-medium text-gray-900 mb-1">Lednicer Format</h4>
                  <p class="text-sm text-gray-500 mb-3">Upper and lower surfaces listed separately with point counts in the header.</p>
                  <button
                    type="button"
                    @click="handleDownloadLednicer"
                    :disabled="!airfoil.upper_x_coordinates"
                    class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
                    Download .dat
                  </button>
                </div>

                <!-- OpenVSP Format -->
                <div class="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
                  <h4 class="font-medium text-gray-900 mb-1">OpenVSP AF Format</h4>
                  <p class="text-sm text-gray-500 mb-3">Includes header with symmetry flag and point counts. Used by OpenVSP.</p>
                  <button
                    type="button"
                    @click="handleDownloadOpenVSP"
                    :disabled="!airfoil.upper_x_coordinates"
                    class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
                    Download .af
                  </button>
                </div>
              </div>
            </div>

            <!-- Copy Coordinates -->
            <div class="mb-8">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Copy Coordinates</h3>
              <button
                type="button"
                @click="copyPointsToClipboard"
                :disabled="coordinateTableData.length === 0"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <Icon :name="copiedPoints ? 'heroicons:check' : 'heroicons:clipboard-document'" class="h-4 w-4" />
                {{ copiedPoints ? 'Copied!' : 'Copy to Clipboard' }}
              </button>
              <p class="text-sm text-gray-500 mt-2">Copies coordinate data as tab-separated values.</p>
            </div>

            <!-- Performance CSV Export -->
            <div v-if="selectedCacheEntries.length > 0" class="mb-8">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Performance Data Export</h3>
              <div class="flex gap-3">
                <button
                  type="button"
                  @click="copyCSVToClipboard"
                  class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Icon :name="copiedToClipboard ? 'heroicons:check' : 'heroicons:clipboard-document'" class="h-4 w-4" />
                  {{ copiedToClipboard ? 'Copied!' : 'Copy CSV' }}
                </button>
                <button
                  type="button"
                  @click="downloadCSV"
                  class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
                  Download CSV
                </button>
              </div>
              <p class="text-sm text-gray-500 mt-2">Export selected performance data ({{ selectedCacheEntries.length }} entries selected).</p>
            </div>

            <!-- Source & Date Added -->
            <div class="border-t border-gray-200 pt-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Source Information</h3>
              <dl class="space-y-3">
                <div v-if="airfoil.source_url">
                  <dt class="text-sm text-gray-500">Source URL</dt>
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
                  <dt class="text-sm text-gray-500">Date Added</dt>
                  <dd class="text-gray-900">
                    {{ new Date(airfoil.created_at).toLocaleDateString() }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- ZONE 4: Footer -->
      <div class="pt-6 border-t border-gray-200">
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
          <div v-if="analysisError" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
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
