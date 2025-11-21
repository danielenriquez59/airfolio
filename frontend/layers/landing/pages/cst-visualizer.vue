<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { CSTParameters, CSTCoordinates } from '~/composables/useCSTParameters'

definePageMeta({
  layout: 'detail',
})

type Airfoil = Database['public']['Tables']['airfoils']['Row']

const { generateCSTCoordinates, fitCSTParameters } = useCSTParameters()
const { exportCSTParameters, exportLednicer, exportSelig } = useCSTExport()
const config = useRuntimeConfig()

// State
const selectedAirfoil = ref<Airfoil | null>(null)
const cstParameters = ref<CSTParameters | null>(null)
const cstCoordinates = ref<CSTCoordinates | null>(null)
const originalCoordinates = ref<CSTCoordinates | null>(null)
const analysisResults = ref<any>(null)
const isLoadingFitting = ref(false)
const isLoadingAnalysis = ref(false)
const error = ref<string | null>(null)

// Default CST parameters (DAE-11)
const DAE11_LE_WEIGHT = 0.5035
const DAE11_TE_THICKNESS = 0.0001
const DAE11_UPPER = [0.1703, 0.1527, 0.5168, 0.0921, 0.6690, 0.1435, 0.2899, 0.1621]
const DAE11_LOWER = [-0.1631, -0.1440, 0.0890, -0.0706, 0.0974, 0.0147, 0.0789, 0.0808]

// Initialize with default parameters
const initializeDefaultParameters = () => {
  cstParameters.value = {
    upperWeights: [...DAE11_UPPER],
    lowerWeights: [...DAE11_LOWER],
    leWeight: DAE11_LE_WEIGHT,
    teThickness: DAE11_TE_THICKNESS,
    order: 7,
  }
  regenerateCoordinates()
}

// Initialize on mount
onMounted(() => {
  initializeDefaultParameters()
})

// Watch for airfoil selection
watch(selectedAirfoil, async (newAirfoil) => {
  if (!newAirfoil) {
    initializeDefaultParameters()
    originalCoordinates.value = null
    analysisResults.value = null
    return
  }

  // Fetch full airfoil data with coordinates
  isLoadingFitting.value = true
  error.value = null

  try {
    if (
      !newAirfoil.upper_x_coordinates ||
      !newAirfoil.upper_y_coordinates ||
      !newAirfoil.lower_x_coordinates ||
      !newAirfoil.lower_y_coordinates
    ) {
      throw new Error('Airfoil geometry data is missing')
    }

    // Store original coordinates
    originalCoordinates.value = {
      upperX: [...newAirfoil.upper_x_coordinates],
      upperY: [...newAirfoil.upper_y_coordinates],
      lowerX: [...newAirfoil.lower_x_coordinates],
      lowerY: [...newAirfoil.lower_y_coordinates],
    }

    // Fit CST parameters from airfoil coordinates
    const fitted = fitCSTParameters(
      newAirfoil.upper_x_coordinates,
      newAirfoil.upper_y_coordinates,
      newAirfoil.lower_x_coordinates,
      newAirfoil.lower_y_coordinates,
      7 // Default order
    )

    cstParameters.value = fitted
    regenerateCoordinates()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to fit CST parameters'
    console.error('Error fitting CST parameters:', err)
  } finally {
    isLoadingFitting.value = false
  }
})

// Watch for parameter changes
watch(
  () => cstParameters.value,
  () => {
    if (cstParameters.value) {
      regenerateCoordinates()
    }
  },
  { deep: true }
)

// Regenerate coordinates from CST parameters
const regenerateCoordinates = () => {
  if (!cstParameters.value) return

  cstCoordinates.value = generateCSTCoordinates(
    cstParameters.value.upperWeights,
    cstParameters.value.lowerWeights,
    cstParameters.value.leWeight,
    cstParameters.value.teThickness,
    cstParameters.value.order,
    400 // Number of points for visualization
  )
}

// Handle order update
const handleOrderUpdate = (newOrder: number) => {
  if (!cstParameters.value) return

  // Generate new weights with default distribution
  const n = newOrder
  const upperWeights: number[] = []
  const lowerWeights: number[] = []

  for (let i = 0; i <= n; i++) {
    const t = i / n
    upperWeights.push(parseFloat((0.2 * Math.pow(1 - t, 2) + 0.4 * t * (1 - t)).toFixed(3)))
    lowerWeights.push(parseFloat((-0.2 * Math.pow(1 - t, 2) - 0.15 * t * (1 - t)).toFixed(3)))
  }

  upperWeights[n] = 0
  lowerWeights[n] = 0

  cstParameters.value = {
    ...cstParameters.value,
    order: newOrder,
    upperWeights,
    lowerWeights,
  }
}

// Handle export CST parameters
const handleExportParameters = () => {
  if (!cstParameters.value) return

  const airfoilName = selectedAirfoil.value?.name || 'CST_Airfoil'
  exportCSTParameters(cstParameters.value, airfoilName)
}

// Handle export coordinates in Lednicer format
const handleExportLednicer = () => {
  if (!cstCoordinates.value) return

  const airfoilName = selectedAirfoil.value?.name || 'CST_Airfoil'
  exportLednicer(cstCoordinates.value, airfoilName)
}

// Handle export coordinates in Selig format
const handleExportSelig = () => {
  if (!cstCoordinates.value) return

  const airfoilName = selectedAirfoil.value?.name || 'CST_Airfoil'
  exportSelig(cstCoordinates.value, airfoilName)
}

// Handle analysis
const handleAnalyze = async (conditions: {
  reynolds: number
  mach: number
  alphaStart: number
  alphaEnd: number
  alphaStep: number
  nCrit: number
}) => {
  if (!cstCoordinates.value) {
    error.value = 'No CST coordinates available for analysis'
    return
  }

  isLoadingAnalysis.value = true
  error.value = null

  try {
    // Generate denser coordinates for analysis (100-200 points)
    const analysisCoords = generateCSTCoordinates(
      cstParameters.value!.upperWeights,
      cstParameters.value!.lowerWeights,
      cstParameters.value!.leWeight,
      cstParameters.value!.teThickness,
      cstParameters.value!.order,
      150 // Denser for analysis
    )

    // Call backend endpoint
    // Convert Reynolds number from thousands to actual value (consistent with other pages)
    const response = await $fetch(`${config.public.backendUrl}/api/analyze-cst`, {
      method: 'POST',
      body: {
        upper_x: analysisCoords.upperX,
        upper_y: analysisCoords.upperY,
        lower_x: analysisCoords.lowerX,
        lower_y: analysisCoords.lowerY,
        reynolds: conditions.reynolds * 1000, // Convert thousands to actual value
        mach: conditions.mach,
        alpha_start: conditions.alphaStart,
        alpha_end: conditions.alphaEnd,
        alpha_step: conditions.alphaStep,
        n_crit: conditions.nCrit,
      },
    })

    analysisResults.value = response
  } catch (err: any) {
    error.value = err.data?.detail || err.message || 'Analysis failed'
    console.error('Error running analysis:', err)
  } finally {
    isLoadingAnalysis.value = false
  }
}

// Prepare geometries for overlay visualization
const geometries = computed(() => {
  const geoms: Array<{
    name: string
    upperX: number[]
    upperY: number[]
    lowerX: number[]
    lowerY: number[]
    color?: string
  }> = []

  if (originalCoordinates.value && selectedAirfoil.value) {
    geoms.push({
      name: selectedAirfoil.value.name,
      upperX: originalCoordinates.value.upperX,
      upperY: originalCoordinates.value.upperY,
      lowerX: originalCoordinates.value.lowerX,
      lowerY: originalCoordinates.value.lowerY,
      color: '#94a3b8', // Gray for original
    })
  }

  if (cstCoordinates.value) {
    geoms.push({
      name: 'CST Generated',
      upperX: cstCoordinates.value.upperX,
      upperY: cstCoordinates.value.upperY,
      lowerX: cstCoordinates.value.lowerX,
      lowerY: cstCoordinates.value.lowerY,
      color: '#3b82f6', // Blue for CST
    })
  }

  return geoms
})

// Prepare analysis data for plots
const performanceData = computed(() => {
  if (!analysisResults.value) return []

  return [
    {
      name: 'CST Airfoil',
      alpha: analysisResults.value.alpha || [],
      CL: analysisResults.value.CL || [],
      CD: analysisResults.value.CD || [],
      CM: analysisResults.value.CM || [],
    },
  ]
})
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <PageHeader
      title="CST Visualizer"
      subtitle="Visualize and export airfoils in CST (Class Shape Transformation) format"
    />

    <!-- Error Display -->
    <div v-if="error" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-sm text-red-800">{{ error }}</p>
    </div>

    <!-- Airfoil Selector -->
    <div class="mb-6">
      <CSTAirfoilSelector v-model="selectedAirfoil" />
    </div>

    <!-- Loading State for Fitting -->
    <div v-if="isLoadingFitting" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <p class="text-sm text-blue-800 flex items-center gap-2">
        <Icon name="heroicons:arrow-path-20-solid" class="w-4 h-4 animate-spin" />
        Fitting CST parameters from airfoil geometry...
      </p>
    </div>

    <!-- Geometry Visualization -->
    <div v-if="cstParameters && cstCoordinates" class="mb-6">
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Geometry Comparison</h3>
        <div class="h-[300px] md:h-[400px]">
          <AirfoilGeometry
            v-if="geometries.length > 0"
            :geometries="geometries"
            :show-legend="true"
            :aspect-ratio="2.5"
            :zoomable="true"
          />
          <div v-else class="flex items-center justify-center h-full text-gray-500">
            <p class="text-sm">No geometry to display</p>
          </div>
        </div>
      </div>
    </div>

    <!-- CST Parameter Editor -->
    <div v-if="cstParameters && cstCoordinates" class="mb-6">
      <CSTParameterEditor
        :parameters="cstParameters"
        :airfoil-name="selectedAirfoil?.name"
        @update:parameters="cstParameters = $event"
        @update-order="handleOrderUpdate"
      />
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoadingFitting" class="mb-6 p-8 bg-gray-50 rounded-lg border border-gray-200 text-center">
      <p class="text-gray-600">
        Select an airfoil to begin CST parameterization, or adjust the default CST parameters above.
      </p>
    </div>

    <!-- Export Buttons -->
    <div v-if="cstParameters && cstCoordinates" class="mb-6">
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Export Options</h3>
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors flex items-center gap-2"
            @click="handleExportParameters"
          >
            <Icon name="heroicons:arrow-down-tray-20-solid" class="w-5 h-5" />
            Export CST Parameters (CSV)
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors flex items-center gap-2"
            @click="handleExportSelig"
          >
            <Icon name="heroicons:arrow-down-tray-20-solid" class="w-5 h-5" />
            Export Selig Format (.dat)
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md transition-colors flex items-center gap-2"
            @click="handleExportLednicer"
          >
            <Icon name="heroicons:arrow-down-tray-20-solid" class="w-5 h-5" />
            Export Lednicer Format (.dat)
          </button>
        </div>
        <p class="mt-3 text-sm text-gray-600">
          Export CST parameters as CSV, or the generated coordinates in Selig or Lednicer format.
        </p>
      </div>
    </div>

    <!-- Analysis Panel -->
    <!-- <div class="mb-6">
      <CSTAnalysisPanel :is-loading="isLoadingAnalysis" @analyze="handleAnalyze" />
    </div> -->

    <!-- Analysis Results -->
    <!-- <div v-if="analysisResults && performanceData.length > 0" class="mt-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Analysis Results</h3>
      <AirfoilPolarPlots :performance-data="performanceData" />
    </div> -->

    <!-- Attribution -->
    <div class="mt-12 pt-6 border-t border-gray-200">
      <p class="text-sm text-gray-500 text-center">
        Inspiration for this tool by 
        <a
          href="https://github.com/matuscvengros/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-gray-700 hover:text-gray-900 underline"
        >
          Matuscvengros
        </a>
      </p>
    </div>
  </div>
</template>

