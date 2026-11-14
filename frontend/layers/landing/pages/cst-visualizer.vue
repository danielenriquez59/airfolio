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
const { exportCSTParameters, exportCSTLednicer, exportCSTSelig } = useCSTExport()
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

// Default LE/TE values (same as legacy DAE-11 preset)
const DAE11_LE_WEIGHT = 0.5035
const DAE11_TE_THICKNESS = 0.0001

// Initialize with default parameters (order 3 → input shows 4)
const initializeDefaultParameters = () => {
  cstParameters.value = {
    upperWeights: [0],
    lowerWeights: [0],
    leWeight: DAE11_LE_WEIGHT,
    teThickness: DAE11_TE_THICKNESS,
    order: 0,
  }
  handleOrderUpdate(3)
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
    analysisResults.value = null // the old polar belongs to the previous shape
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

  exportCSTLednicer(cstCoordinates.value, 'CST_Airfoil')
}

// Handle export coordinates in Selig format
const handleExportSelig = () => {
  if (!cstCoordinates.value) return

  exportCSTSelig(cstCoordinates.value, 'CST_Airfoil')
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
      color: chartColors.primary,

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
  <div>
    <PageHeader
      eyebrow="Tools"
      title="CST Generator"
      subtitle="Generate and analyze airfoils in CST (Class Shape Transformation) format."
    >
      <template #actions>
        <VButton type="button" color="light" size="sm" :disabled="!cstParameters" @click="handleExportParameters">
          <Icon name="heroicons:arrow-down-tray-20-solid" class="h-4 w-4" aria-hidden="true" />
          Parameters (CSV)
        </VButton>
        <VButton type="button" color="light" size="sm" :disabled="!cstCoordinates" @click="handleExportSelig">
          <Icon name="heroicons:arrow-down-tray-20-solid" class="h-4 w-4" aria-hidden="true" />
          Selig (.dat)
        </VButton>
        <VButton type="button" color="light" size="sm" :disabled="!cstCoordinates" @click="handleExportLednicer">
          <Icon name="heroicons:arrow-down-tray-20-solid" class="h-4 w-4" aria-hidden="true" />
          Lednicer (.dat)
        </VButton>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Inputs -->
      <div class="min-w-0 space-y-6">
        <CSTParameterEditor
          v-if="cstParameters && cstCoordinates"
          :parameters="cstParameters"
          @update:parameters="cstParameters = $event"
          @update-order="handleOrderUpdate"
        />
        <VPanel v-else>
          <VStateBlock variant="loading" title="Preparing default parameters" />
        </VPanel>

        <CSTAnalysisPanel :is-loading="isLoadingAnalysis" @analyze="handleAnalyze" />
      </div>

      <!-- Results -->
      <div class="min-w-0 space-y-6 lg:col-span-2">
        <VPanel title="Geometry">
          <AirfoilGeometry
            v-if="geometries.length > 0"
            :geometries="geometries"
            :show-legend="false"
            :aspect-ratio="4"
            :zoomable="true"
          />
          <VStateBlock
            v-else
            title="No geometry to display"
            description="Adjust the CST parameters to generate an airfoil geometry."
          />
        </VPanel>

        <VPanel title="Analysis results">
          <VStateBlock
            v-if="isLoadingAnalysis"
            variant="loading"
            title="Running analysis"
            description="Analysis may take a few moments."
          />
          <VStateBlock
            v-else-if="error"
            variant="error"
            title="Analysis failed"
            :description="error"
          />
          <AirfoilPolarPlots
            v-else-if="analysisResults && performanceData.length > 0"
            ref="plotsRef"
            :performance-data="performanceData"
            :show-controls="true"
            @tooltips-toggled="handleTooltipsToggled"
          />
          <VStateBlock
            v-else
            icon="heroicons:chart-bar"
            title="No results yet"
            description="Set the flow conditions and run the analysis to see polars."
          />
        </VPanel>
      </div>
    </div>

    <!-- Attribution -->
    <p class="mt-10 border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
      Inspiration for this tool by
      <a
        href="https://github.com/matuscvengros/"
        target="_blank"
        rel="noopener noreferrer"
        class="text-gray-700 underline hover:text-gray-900"
      >
        Matuscvengros
      </a>
    </p>
  </div>
</template>
