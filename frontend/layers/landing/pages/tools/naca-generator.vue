<script setup lang="ts">
import type { NACA4Params, NACA5Params, NACA6Params, NACACoordinates, RiblettParams } from '~/composables/useNACAGenerator'
import AirfoilPolarPlots from '~/components/analysis/AirfoilPolarPlots.vue'

definePageMeta({
  layout: 'detail',
})

// SEO
useSeoMeta({
  title: 'NACA Generator - Generate NACA 4-Digit, 5-Digit, 6-Series and Riblett GA Airfoils',
  description: 'Generate and analyze NACA 4-digit, 5-digit, 6-series and Riblett GA airfoils. Visualize airfoil geometry, adjust camber and thickness parameters, run performance analysis, and export in multiple formats.',
  ogTitle: 'NACA Generator - Generate NACA 4-Digit, 5-Digit, 6-Series and Riblett GA Airfoils',
  ogDescription: 'Generate and analyze NACA 4-digit, 5-digit, 6-series and Riblett GA airfoils. Visualize airfoil geometry, adjust camber and thickness parameters, run performance analysis, and export in multiple formats.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

const { generateNACA4, generateNACA5, generateNACA6, generateNACA4Name, generateNACA5Name, generateNACA6Name, compactNACA6Name, generateRiblett, generateRiblettName } = useNACAGenerator()
const { exportNACAParameters, exportNACALednicer, exportNACASelig } = useNACAExport()
const config = useRuntimeConfig()

// State
const seriesType = ref<'4-digit' | '5-digit' | '6-series' | 'riblett'>('4-digit')
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
const naca6Params = ref<NACA6Params>({ family: '64', t: 0.12, cl: 0.2, a: 1 })
const riblettParams = ref<RiblettParams>({ series: '35', cusp: 'A', cl: 0.4, t: 0.15, sharpTE: false })
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
  if (seriesType.value === 'riblett') return generateRiblettName(riblettParams.value)
  if (seriesType.value === '6-series') return generateNACA6Name(naca6Params.value)
  if (seriesType.value === '4-digit') {
    return generateNACA4Name(naca4Params.value)
  } else {
    return generateNACA5Name(naca5Params.value)
  }
})

// 6-series names hold brackets, spaces and =, so downloads use the compact designation
const fileBase = computed(() =>
  seriesType.value === '6-series' ? `NACA_${compactNACA6Name(naca6Params.value)}` : undefined
)

// Initialize on mount
onMounted(() => {
  regenerateCoordinates()
})

// Watch for parameter changes
watch(
  () => [seriesType.value, naca4Params.value, naca5Params.value, naca6Params.value, riblettParams.value],
  () => {
    regenerateCoordinates()
    analysisResults.value = null // the old polar belongs to the previous shape
  },
  { deep: true }
)

// Regenerate coordinates from NACA parameters
const regenerateCoordinates = () => {
  if (seriesType.value === 'riblett') {
    nacaCoordinates.value = generateRiblett(riblettParams.value) // 27 tabulated stations
  } else if (seriesType.value === '6-series') {
    nacaCoordinates.value = generateNACA6(naca6Params.value) // point count fixed by the 6-series tables
  } else if (seriesType.value === '4-digit') {
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
    seriesType.value === '6-series' ? naca6Params.value : null,
    currentNacaName.value,
    fileBase.value,
    seriesType.value === 'riblett' ? riblettParams.value : null
  )
}

// Handle export coordinates in Lednicer format
const handleExportLednicer = () => {
  if (!nacaCoordinates.value) return

  exportNACALednicer(nacaCoordinates.value, currentNacaName.value, fileBase.value)
}

// Handle export coordinates in Selig format
const handleExportSelig = () => {
  if (!nacaCoordinates.value) return

  exportNACASelig(nacaCoordinates.value, currentNacaName.value, fileBase.value)
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
      seriesType.value === 'riblett'
        ? generateRiblett(riblettParams.value)
        : seriesType.value === '6-series'
        ? generateNACA6(naca6Params.value)
        : seriesType.value === '4-digit'
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
  <div>
    <PageHeader
      title="NACA Generator"
      subtitle="Generate and analyze NACA 4-digit, 5-digit, 6-series and Riblett GA airfoils"
      eyebrow="Tools"
    >
      <template #actions>
        <VButton color="light" size="sm" :disabled="!nacaCoordinates" @click="handleExportParameters">
          <Icon name="heroicons:arrow-down-tray-20-solid" class="h-4 w-4 shrink-0" aria-hidden="true" />
          Parameters (CSV)
        </VButton>
        <VButton color="light" size="sm" :disabled="!nacaCoordinates" @click="handleExportSelig">
          <Icon name="heroicons:arrow-down-tray-20-solid" class="h-4 w-4 shrink-0" aria-hidden="true" />
          Selig (.dat)
        </VButton>
        <VButton color="light" size="sm" :disabled="!nacaCoordinates" @click="handleExportLednicer">
          <Icon name="heroicons:arrow-down-tray-20-solid" class="h-4 w-4 shrink-0" aria-hidden="true" />
          Lednicer (.dat)
        </VButton>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Inputs -->
      <div class="min-w-0 space-y-6">
        <VPanel title="Parameters">
          <NACAParameterEditor
            :series-type="seriesType"
            :naca4-params="naca4Params"
            :naca5-params="naca5Params"
            :naca6-params="naca6Params"
            :riblett-params="riblettParams"
            :naca-name="currentNacaName"
            @update:series-type="seriesType = $event"
            @update:naca4-params="naca4Params = $event"
            @update:naca5-params="naca5Params = $event"
            @update:naca6-params="naca6Params = $event"
            @update:riblett-params="riblettParams = $event"
          />
        </VPanel>

        <NACAAnalysisPanel :is-loading="isLoadingAnalysis" @analyze="handleAnalyze" />
      </div>

      <!-- Results -->
      <div class="min-w-0 space-y-6 lg:col-span-2">
        <VPanel title="Geometry">
          <AirfoilGeometry
            v-if="nacaCoordinates && geometries.length > 0"
            :geometries="geometries"
            :show-legend="false"
            :aspect-ratio="4"
            equal-scale
            :zoomable="true"
          />
          <VStateBlock v-else variant="loading" title="Generating airfoil geometry" />
        </VPanel>

        <VPanel title="Analysis results">
          <VStateBlock v-if="isLoadingAnalysis" variant="loading" title="Running analysis" description="Analysis may take a few moments." />
          <VStateBlock v-else-if="error" variant="error" title="Analysis failed" :description="error" />
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
            title="No analysis yet"
            description="Set the flow conditions and run an analysis to see lift, drag and moment polars."
          />
        </VPanel>
      </div>
    </div>

    <!-- Always rendered so the static page carries this text for search engines, whichever tab is open -->
    <VPanel title="About the airfoil families" class="mt-6">
      <div class="max-w-3xl space-y-5 text-sm leading-relaxed text-gray-700">
        <section>
          <h3 class="mb-1 font-semibold text-gray-900">NACA 4-digit, 5-digit and 6-series</h3>
          <p>
            The NACA families are defined by formulas (4- and 5-digit) or by NACA's conformal-mapping tables (6-series).
            Set camber, camber position, design lift coefficient and thickness to generate any section in the family,
            then plot it, run a NeuralFoil polar, or download Selig and Lednicer coordinate files.
          </p>
        </section>
        <section>
          <h3 class="mb-1 font-semibold text-gray-900">Harry Riblett GA airfoils</h3>
          <p>
            Harry Riblett's <em>GA Airfoils</em> (1996) catalogs sections designed for general aviation and homebuilt
            aircraft, built from NACA-style thickness forms and mean lines. A designation such as GA 30-613.5 reads as:
            maximum thickness at 30% chord, standard trailing-edge cusp (- standard, A reduced), 0.6 design lift
            coefficient, and 13.5% thickness. This Riblett airfoil generator builds any section with maximum thickness at
            30, 35, 37 or 40% chord, design lift from 0 to 0.6 and thickness from 6 to 24%, with an optional sharp
            trailing edge. Exports are in Selig and Lednicer .dat formats for XFOIL, XFLR5 or CAD rib layouts.
          </p>
          <p class="mt-2">
            Popular Riblett sections in the database:
            <NuxtLink to="/airfoils/ga30-613.5" class="font-medium text-primary-600 hover:underline">GA 30-613.5</NuxtLink>,
            <NuxtLink to="/airfoils/ga30-413.5" class="font-medium text-primary-600 hover:underline">GA 30-413.5</NuxtLink>,
            <NuxtLink to="/airfoils/ga35a415" class="font-medium text-primary-600 hover:underline">GA 35A415</NuxtLink> and
            <NuxtLink to="/airfoils/ga37a315" class="font-medium text-primary-600 hover:underline">GA 37A315</NuxtLink>.
          </p>
        </section>
      </div>
    </VPanel>
  </div>
</template>
