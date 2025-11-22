<script setup lang="ts">
import type { NACA4Params, NACA5Params, NACACoordinates } from '~/composables/useNACAGenerator'
import AirfoilPolarPlots from '~/components/analysis/AirfoilPolarPlots.vue'

definePageMeta({
  layout: 'detail',
})

const { generateNACA4, generateNACA5, generateNACA4Name, generateNACA5Name } = useNACAGenerator()
const { exportNACAParameters, exportLednicer, exportSelig } = useNACAExport()
const config = useRuntimeConfig()

// State
const seriesType = ref<'4-digit' | '5-digit'>('4-digit')
const naca4Params = ref<NACA4Params>({
  m: 0.02, // 2% camber
  p: 0.4, // 40% chord
  t: 0.12, // 12% thickness
})
const naca5Params = ref<NACA5Params>({
  cl: 0.3, // Design Cl
  p: 0.15, // Position (15%)
  t: 0.12, // Thickness
  isReflex: false,
})
const nacaCoordinates = ref<NACACoordinates | null>(null)
const analysisResults = ref<any>(null)
const isLoadingAnalysis = ref(false)
const error = ref<string | null>(null)

// Plot controls
const plotsRef = ref<{ resetZoom: () => void; toggleTooltips: () => void; tooltipsEnabled: boolean } | null>(null)
const tooltipsEnabled = ref(true)

const handleTooltipsToggled = (enabled: boolean) => {
  tooltipsEnabled.value = enabled
}

// Generate NACA name
const currentNacaName = computed(() => {
  if (seriesType.value === '4-digit') {
    return generateNACA4Name(naca4Params.value)
  } else {
    return generateNACA5Name(naca5Params.value)
  }
})

// Initialize on mount
onMounted(() => {
  regenerateCoordinates()
})

// Watch for parameter changes
watch(
  () => [seriesType.value, naca4Params.value, naca5Params.value],
  () => {
    regenerateCoordinates()
  },
  { deep: true }
)

// Regenerate coordinates from NACA parameters
const regenerateCoordinates = () => {
  if (seriesType.value === '4-digit') {
    nacaCoordinates.value = generateNACA4(naca4Params.value, 100) // 100 points for visualization
  } else {
    nacaCoordinates.value = generateNACA5(naca5Params.value, 100) // 100 points for visualization
  }
}

// Handle export NACA parameters
const handleExportParameters = () => {
  if (!nacaCoordinates.value) return

  exportNACAParameters(
    seriesType.value,
    seriesType.value === '4-digit' ? naca4Params.value : null,
    seriesType.value === '5-digit' ? naca5Params.value : null,
    currentNacaName.value
  )
}

// Handle export coordinates in Lednicer format
const handleExportLednicer = () => {
  if (!nacaCoordinates.value) return

  exportLednicer(nacaCoordinates.value, currentNacaName.value)
}

// Handle export coordinates in Selig format
const handleExportSelig = () => {
  if (!nacaCoordinates.value) return

  exportSelig(nacaCoordinates.value, currentNacaName.value)
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
  if (!nacaCoordinates.value) {
    error.value = 'No NACA coordinates available for analysis'
    return
  }

  isLoadingAnalysis.value = true
  error.value = null

  try {
    // Generate denser coordinates for analysis (150 points)
    const analysisCoords =
      seriesType.value === '4-digit'
        ? generateNACA4(naca4Params.value, 150)
        : generateNACA5(naca5Params.value, 150)

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
        airfoil_name: currentNacaName.value,
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

  if (nacaCoordinates.value) {
    geoms.push({
      name: currentNacaName.value,
      upperX: nacaCoordinates.value.upperX,
      upperY: nacaCoordinates.value.upperY,
      lowerX: nacaCoordinates.value.lowerX,
      lowerY: nacaCoordinates.value.lowerY,
      color: seriesType.value === '4-digit' ? '#3b82f6' : '#10b981', // Blue for 4-digit, green for 5-digit
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
      name: currentNacaName.value,
      alpha: analysisResults.value.alpha,
      CL: analysisResults.value.CL,
      CD: analysisResults.value.CD,
      CM: analysisResults.value.CM,
    },
  ]
})
</script>

<template>
  <div class="container mx-auto px-4 py-0 max-w-7xl">
    <PageHeader
      title="NACA Generator"
      subtitle="Generate and analyze NACA 4-digit and 5-digit series airfoils"
    />

    <!-- Series Type Selector -->
    <div class="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <label class="block text-sm font-semibold text-gray-700 mb-3">Airfoil Series</label>
      <div class="flex gap-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            :value="'4-digit'"
            :checked="seriesType === '4-digit'"
            class="w-4 h-4 text-blue-600 focus:ring-blue-500"
            @change="seriesType = '4-digit'"
          />
          <span class="text-sm font-medium text-gray-700">NACA 4-Digit Series</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            :value="'5-digit'"
            :checked="seriesType === '5-digit'"
            class="w-4 h-4 text-green-600 focus:ring-green-500"
            @change="seriesType = '5-digit'"
          />
          <span class="text-sm font-medium text-gray-700">NACA 5-Digit Series</span>
        </label>
      </div>
      <div class="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <div class="flex items-start gap-2">
          <Icon name="heroicons:information-circle-20-solid" class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p class="text-sm text-blue-800">
            <span v-if="seriesType === '4-digit'">
              Defines airfoil by max camber, camber location, and max thickness.
            </span>
            <span v-else>
              Defines airfoil by design lift coefficient (Cl), max camber location, and max thickness.
            </span>
          </p>
        </div>
      </div>
      <div class="mt-3 p-3 bg-gray-50 rounded-lg">
        <div class="text-2xl font-mono font-bold text-blue-700">{{ currentNacaName }}</div>
      </div>
    </div>

    <!-- Geometry Visualization -->
    <div v-if="nacaCoordinates" class="mb-6">
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="w-full overflow-hidden h-[300px] md:h-[400px]">
          <AirfoilGeometry
            v-if="geometries.length > 0"
            :geometries="geometries"
            :show-legend="true"
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

    <!-- NACA Parameter Editor -->
    <div v-if="nacaCoordinates" class="mb-6">
      <NACAParameterEditor
        :series-type="seriesType"
        :naca4-params="naca4Params"
        :naca5-params="naca5Params"
        :naca-name="currentNacaName"
        @update:series-type="seriesType = $event"
        @update:naca4-params="naca4Params = $event"
        @update:naca5-params="naca5Params = $event"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="mb-6 p-8 bg-gray-50 rounded-lg border border-gray-200 text-center">
      <p class="text-gray-600">Generating airfoil geometry...</p>
    </div>

    <!-- Export Buttons -->
    <div v-if="nacaCoordinates" class="mb-6">
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Export Options</h3>
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors flex items-center gap-2"
            @click="handleExportParameters"
          >
            <Icon name="heroicons:arrow-down-tray-20-solid" class="w-5 h-5" />
            Export NACA Parameters (CSV)
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
          Export NACA parameters as CSV, or the generated coordinates in Selig or Lednicer format.
        </p>
      </div>
    </div>

    <!-- Analysis Panel -->
    <div class="mb-6">
      <NACAAnalysisPanel :is-loading="isLoadingAnalysis" @analyze="handleAnalyze" />
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

    <!-- Info Card -->
    <div class="mt-6 bg-slate-900 text-slate-400 p-6 rounded-xl text-sm leading-relaxed">
      <h4 class="text-slate-200 font-bold mb-2 flex items-center gap-2">
        <Icon name="heroicons:information-circle-20-solid" class="w-4 h-4" />
        Technical Note
      </h4>
      <p>
        <span v-if="seriesType === '4-digit'">
          The NACA 4-digit airfoil sections are generated using a thickness distribution equation and a mean camber line composed of two parabolic arcs merging smoothly at the position of maximum camber.
        </span>
        <span v-else>
          The NACA 5-digit series uses the same thickness form as the 4-digit series but employs a specific camber line designed to move the maximum camber forward for higher maximum lift coefficients. The calculations here approximate the standard camber lines.
        </span>
      </p>
    </div>
  </div>
</template>

