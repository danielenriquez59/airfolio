<script setup lang="ts">
import type { CSTParameters, CSTCoordinates } from '~/composables/useCSTParameters'
import AirfoilPolarPlots from '~/components/analysis/AirfoilPolarPlots.vue'

definePageMeta({
  layout: 'detail',
})

// SEO
useSeoMeta({
  title: 'CST Generator - Generate Airfoils with Class Shape Transformation',
  description: 'Generate and analyze airfoils using CST (Class Shape Transformation) method. Visualize airfoil geometry, adjust parameters, and export in multiple formats including Selig and Lednicer.',
  ogTitle: 'CST Generator - Generate Airfoils with Class Shape Transformation',
  ogDescription: 'Generate and analyze airfoils using CST (Class Shape Transformation) method. Visualize airfoil geometry, adjust parameters, and export in multiple formats.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

const { generateCSTCoordinates } = useCSTParameters()
const { exportCSTParameters, exportLednicer, exportSelig } = useCSTExport()
const config = useRuntimeConfig()

// State
const cstParameters = ref<CSTParameters | null>(null)
const cstCoordinates = ref<CSTCoordinates | null>(null)
const analysisResults = ref<any>(null)
const isLoadingAnalysis = ref(false)
const error = ref<string | null>(null)

// Plot controls
const plotsRef = ref<{ resetZoom: () => void; toggleTooltips: () => void; tooltipsEnabled: boolean } | null>(null)
const tooltipsEnabled = ref(true)

const handleTooltipsToggled = (enabled: boolean) => {
  tooltipsEnabled.value = enabled
}

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

  exportCSTParameters(cstParameters.value, 'CST_Airfoil')
}

// Handle export coordinates in Lednicer format
const handleExportLednicer = () => {
  if (!cstCoordinates.value) return

  exportLednicer(cstCoordinates.value, 'CST_Airfoil')
}

// Handle export coordinates in Selig format
const handleExportSelig = () => {
  if (!cstCoordinates.value) return

  exportSelig(cstCoordinates.value, 'CST_Airfoil')
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
    const response = await $fetch(`${config.public.backendUrl}/api/analyze-transient`, {
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
        airfoil_name: 'CST Airfoil',
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

// Prepare geometries for visualization
const geometries = computed(() => {
  const geoms: Array<{
    name: string
    upperX: number[]
    upperY: number[]
    lowerX: number[]
    lowerY: number[]
    color?: string
  }> = []

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

  // Ensure all required fields exist and are arrays
  if (
    !Array.isArray(analysisResults.value.alpha) ||
    !Array.isArray(analysisResults.value.CL) ||
    !Array.isArray(analysisResults.value.CD) ||
    !Array.isArray(analysisResults.value.CM)
  ) {
    return []
  }

  return [
    {
      name: 'CST Airfoil',
      alpha: analysisResults.value.alpha,
      CL: analysisResults.value.CL,
      CD: analysisResults.value.CD,
      CM: analysisResults.value.CM,
    },
  ]
})
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <PageHeader
      title="CST Generator"
      subtitle="Generate and analyze airfoils in CST (Class Shape Transformation) format"
    />

    <!-- Geometry Visualization -->
    <div v-if="cstParameters && cstCoordinates" class="mb-6">
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Geometry Visualization</h3>
        <div class="w-full overflow-hidden h-[300px] md:h-[400px]">
          <AirfoilGeometry
            v-if="geometries.length > 0"
            :geometries="geometries"
            :show-legend="false"
            :aspect-ratio="2.5"
            :zoomable="true"
            :height="400"
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
        :on-export-parameters="handleExportParameters"
        :on-export-selig="handleExportSelig"
        :on-export-lednicer="handleExportLednicer"
        @update:parameters="cstParameters = $event"
        @update-order="handleOrderUpdate"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="mb-6 p-8 bg-gray-50 rounded-lg border border-gray-200 text-center">
      <p class="text-gray-600">
        Adjust the default CST parameters to generate an airfoil geometry.
      </p>
    </div>

    <!-- Analysis Panel -->
    <div class="mb-6">
      <CSTAnalysisPanel :is-loading="isLoadingAnalysis" @analyze="handleAnalyze" />
    </div>

    <!-- Error Display -->
    <div v-if="error" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-sm text-red-800">{{ error }}</p>
    </div>

    <!-- Analysis Results -->
    <div v-if="analysisResults && performanceData.length > 0" class="mt-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Analysis Results</h3>
      <AirfoilPolarPlots
        ref="plotsRef"
        :performance-data="performanceData"
        :show-controls="true"
        @tooltips-toggled="handleTooltipsToggled"
      />
    </div>

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

