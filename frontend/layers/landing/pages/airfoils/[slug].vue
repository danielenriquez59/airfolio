<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { AnalysisConditions } from '~/composables/useAnalysis'
import AirfoilPolarPlots from '~/components/analysis/AirfoilPolarPlots.vue'
import AirfoilPerformanceCache from '~/layers/landing/components/airfoils/AirfoilPerformanceCache.vue'
type Airfoil = Database['public']['Tables']['airfoils']['Row']
type PerformanceCache = Database['public']['Tables']['performance_cache']['Row']

definePageMeta({
  layout: 'detail',
})

const route = useRoute()
const { fetchAirfoilByName } = useAirfoils()
const { downloadLednicer, downloadSelig } = useAirfoilDownload()
const { submitAnalysis } = useAnalysis()

const airfoil = ref<Airfoil | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

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

const airfoilSlug = computed(() => route.params.slug as string)

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
    console.log(outputs)
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
    const data = await fetchAirfoilByName(airfoilSlug.value)
    
    if (!data) {
      error.value = 'Airfoil not found'
      return
    }
    
    airfoil.value = data
    
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
  title: airfoil.value ? `${airfoil.value.name} - Airfolio` : 'Airfoil Details - Airfolio',
})
</script>

<template>
  <div>
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
            {{ airfoil.name.toUpperCase() }}
          </h1>
          <p v-if="airfoil.description" class="text-lg text-gray-600">
            {{ airfoil.description }}
          </p>
        </div>

        <!-- Geometry Visualization -->
        <div class="mb-8 bg-white rounded-lg shadow p-6">
          <AirfoilGeometry
            v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
            :upper-x="airfoil.upper_x_coordinates"
            :upper-y="airfoil.upper_y_coordinates"
            :lower-x="airfoil.lower_x_coordinates"
            :lower-y="airfoil.lower_y_coordinates"
            :name="airfoil.name"
            :aspect-ratio="3"
            :show-grid="true"
            :zoomable="true"
            :show-points-on-hover="true"
          />
          <div v-else class="text-center py-8 text-gray-400">
            Geometry data not available
          </div>
        </div>

        <!-- Metadata -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Geometry Parameters</h2>
            <dl class="space-y-3">
              <div v-if="airfoil.thickness_pct">
                <dt class="text-sm text-gray-500">Thickness</dt>
                <dd class="text-lg font-semibold text-gray-900">
                  {{ (airfoil.thickness_pct * 100).toFixed(2) }}%
                  <span v-if="airfoil.thickness_loc_pct" class="text-sm text-gray-600 font-normal">
                    @ {{ (airfoil.thickness_loc_pct * 100).toFixed(1) }}% x/c
                  </span>
                </dd>
              </div>
              <div v-if="airfoil.camber_pct">
                <dt class="text-sm text-gray-500">Camber</dt>
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

          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Additional Information</h2>
            <dl class="space-y-3">
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
                <dt class="text-sm text-gray-500">Download</dt>
                <dd class="flex flex-col gap-2">
                  <button
                    type="button"
                    @click="() => downloadLednicer(airfoil!)"
                    class="text-left text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer"
                  >
                    Download Lednicer Format
                    <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    @click="() => downloadSelig(airfoil!)"
                    class="text-left text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer"
                  >
                    Download Selig Format
                    <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
                  </button>
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <!-- Performance Cache Data -->
        <div v-if="airfoil.id" class="mb-8">
          <AirfoilPerformanceCache 
            :key="`cache-${airfoil.id}-${cacheRefreshKey}`"
            ref="cacheRef"
            :airfoil-id="airfoil.id"
            @selection-change="handleSelectionChange"
          />
        </div>

        <!-- Run Performance Analysis Button -->
        <div v-if="airfoil.id" class="mb-8">
          <button
            type="button"
            @click="showAnalysisModal = true"
            class="w-full px-6 py-3 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center gap-2"
          >
            <Icon name="heroicons:play" class="h-5 w-5" />
            Run Performance Analysis
          </button>
        </div>


        <!-- Performance Plots -->
        <div v-if="airfoil.id" class="mb-8">
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Performance Plots</h2>
            <AirfoilPolarPlots :performance-data="performanceDataForPlots" />
          </div>
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
