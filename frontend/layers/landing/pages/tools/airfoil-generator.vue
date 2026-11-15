<script setup lang="ts">
import type { NACA16Params, NACA4Params, NACA5Params, NACA6Params, NACACoordinates, RiblettParams } from '~/composables/useNACAGenerator'
import type { CSTParameters } from '~/composables/useCSTParameters'
import AirfoilPolarPlots from '~/components/analysis/AirfoilPolarPlots.vue'

definePageMeta({
  layout: 'detail',
})

// SEO
useSeoMeta({
  title: 'Airfoil Generator - NACA 4-Digit, 5-Digit, 16-Series, 6-Series, Riblett GA and CST Airfoils',
  description: 'Generate and analyze NACA 4-digit (and modified), 5-digit (and reflex), 16-series, 6-series, Riblett GA and CST (Class Shape Transformation) airfoils. Visualize airfoil geometry, adjust camber, thickness or CST weights, fit CST to catalog airfoils, run performance analysis, and export in Selig and Lednicer formats.',
  ogTitle: 'Airfoil Generator - NACA 4-Digit, 5-Digit, 16-Series, 6-Series, Riblett GA and CST Airfoils',
  ogDescription: 'Generate and analyze NACA 4-digit (and modified), 5-digit (and reflex), 16-series, 6-series, Riblett GA and CST (Class Shape Transformation) airfoils. Visualize airfoil geometry, run performance analysis, and export in Selig and Lednicer formats.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

const { generateNACA4, generateNACA5, generateNACA6, generateNACA16, generateNACA4Name, generateNACA5Name, generateNACA6Name, generateNACA16Name, compactNACA6Name, generateRiblett, generateRiblettName } = useNACAGenerator()
const { exportNACAParameters, exportNACALednicer, exportNACASelig } = useNACAExport()
const { generateCSTCoordinates } = useCSTParameters()
const { exportCSTParameters, exportCSTLednicer, exportCSTSelig } = useCSTExport()
const config = useRuntimeConfig()
const route = useRoute()
const router = useRouter()

// State; ?series= holds the tab, one of these values (none = 4-digit)
const SERIES_TABS = ['4-digit', '5-digit', '16-series', '6-series', 'riblett', 'cst'] as const
const seriesType = ref<typeof SERIES_TABS[number]>('4-digit')
const naca4Params = ref<NACA4Params>({
  m: 0.02, // 2% camber
  p: 0.4, // 40% chord
  t: 0.12, // 12% thickness
  modified: false,
  le: 6, // leading-edge radius index (modified only)
  xt: 0.3, // max thickness position (modified only)
})
const naca5Params = ref<NACA5Params>({
  cl: 0.3, // Design Cl
  p: 0.15, // Position (15%)
  t: 0.12, // Thickness
  isReflex: false,
})
const naca6Params = ref<NACA6Params>({ family: '64', t: 0.12, cl: 0.2, a: 1 })
const naca16Params = ref<NACA16Params>({ t: 0.12, cl: 0.2 })
const riblettParams = ref<RiblettParams>({ series: '35', cusp: 'A', cl: 0.4, t: 0.15, sharpTE: false })

// Default CST weights for a given order (the last weight is 0)
const cstWeights = (n: number) => {
  const upperWeights: number[] = []
  const lowerWeights: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    upperWeights.push(parseFloat((0.2 * Math.pow(1 - t, 2) + 0.4 * t * (1 - t)).toFixed(3)))
    lowerWeights.push(parseFloat((-0.2 * Math.pow(1 - t, 2) - 0.15 * t * (1 - t)).toFixed(3)))
  }
  upperWeights[n] = 0
  lowerWeights[n] = 0
  return { upperWeights, lowerWeights }
}
// LE/TE defaults of the legacy DAE-11 preset; order 3 shows as 4 weights
const cstParameters = ref<CSTParameters>({ ...cstWeights(3), leWeight: 0.5035, teThickness: 0.0001, order: 3 })
const handleOrderUpdate = (order: number) => {
  cstParameters.value = { ...cstParameters.value, order, ...cstWeights(order) }
}
const cstCoords = (points: number) => {
  const p = cstParameters.value
  return generateCSTCoordinates(p.upperWeights, p.lowerWeights, p.leWeight, p.teThickness, p.order, points)
}
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
  if (seriesType.value === 'cst') return 'CST Airfoil'
  if (seriesType.value === 'riblett') return generateRiblettName(riblettParams.value)
  if (seriesType.value === '6-series') return generateNACA6Name(naca6Params.value)
  if (seriesType.value === '16-series') return generateNACA16Name(naca16Params.value)
  if (seriesType.value === '4-digit') {
    return generateNACA4Name(naca4Params.value)
  } else {
    return generateNACA5Name(naca5Params.value)
  }
})

// 6-series names hold brackets, spaces and =, so downloads use the compact designation; 16-212 -> NACA_16212
const fileBase = computed(() =>
  seriesType.value === '6-series'
    ? `NACA_${compactNACA6Name(naca6Params.value)}`
    : seriesType.value === '16-series' ? currentNacaName.value.replace(' ', '_').replace('-', '') : undefined
)

// The static page is rendered without a query, so the tab from ?series= is applied after mount (no hydration mismatch)
onMounted(() => {
  const q = route.query.series
  if (SERIES_TABS.includes(q as typeof SERIES_TABS[number])) seriesType.value = q as typeof SERIES_TABS[number]
  regenerateCoordinates()
})
watch(seriesType, (s) => {
  router.replace({ query: { ...route.query, series: s === '4-digit' ? undefined : s } })
})

// Watch for parameter changes
watch(
  () => [seriesType.value, naca4Params.value, naca5Params.value, naca6Params.value, naca16Params.value, riblettParams.value, cstParameters.value],
  () => {
    regenerateCoordinates()
    analysisResults.value = null // the old polar belongs to the previous shape
  },
  { deep: true }
)

// Regenerate coordinates from NACA parameters
const regenerateCoordinates = () => {
  if (seriesType.value === 'cst') {
    nacaCoordinates.value = cstCoords(400)
  } else if (seriesType.value === 'riblett') {
    nacaCoordinates.value = generateRiblett(riblettParams.value) // 27 tabulated stations
  } else if (seriesType.value === '16-series') {
    nacaCoordinates.value = generateNACA16(naca16Params.value, 100)
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
  if (seriesType.value === 'cst') return exportCSTParameters(cstParameters.value, 'CST_Airfoil')

  exportNACAParameters(
    seriesType.value,
    seriesType.value === '4-digit' ? naca4Params.value : null,
    seriesType.value === '5-digit' ? naca5Params.value : null,
    seriesType.value === '6-series' ? naca6Params.value : null,
    currentNacaName.value,
    fileBase.value,
    seriesType.value === 'riblett' ? riblettParams.value : null,
    seriesType.value === '16-series' ? naca16Params.value : null
  )
}

// Handle export coordinates in Lednicer format
const handleExportLednicer = () => {
  if (!nacaCoordinates.value) return
  if (seriesType.value === 'cst') return exportCSTLednicer(nacaCoordinates.value, 'CST_Airfoil')

  exportNACALednicer(nacaCoordinates.value, currentNacaName.value, fileBase.value)
}

// Handle export coordinates in Selig format
const handleExportSelig = () => {
  if (!nacaCoordinates.value) return
  if (seriesType.value === 'cst') return exportCSTSelig(nacaCoordinates.value, 'CST_Airfoil')

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
    error.value = 'No coordinates available for analysis'
    return
  }

  isLoadingAnalysis.value = true
  error.value = null

  try {
    // Generate denser coordinates for analysis (150 points)
    const analysisCoords =
      seriesType.value === 'cst'
        ? cstCoords(150)
        : seriesType.value === 'riblett'
        ? generateRiblett(riblettParams.value)
        : seriesType.value === '16-series'
        ? generateNACA16(naca16Params.value, 150)
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
      title="Airfoil Generator"
      subtitle="Generate and analyze NACA 4-digit, 5-digit, 16-series, 6-series, Riblett GA and CST airfoils"
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
            :naca16-params="naca16Params"
            :riblett-params="riblettParams"
            :naca-name="currentNacaName"
            @update:series-type="seriesType = $event"
            @update:naca4-params="naca4Params = $event"
            @update:naca5-params="naca5Params = $event"
            @update:naca6-params="naca6Params = $event"
            @update:naca16-params="naca16Params = $event"
            @update:riblett-params="riblettParams = $event"
          />
        </VPanel>

        <CSTParameterEditor
          v-if="seriesType === 'cst'"
          :parameters="cstParameters"
          @update:parameters="cstParameters = $event"
          @update-order="handleOrderUpdate"
        />

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
            Harry Riblett's
            <a href="https://www.scribd.com/doc/55803105/GA-Airfoils" target="_blank" rel="noopener" class="font-medium text-primary-600 hover:underline"><em>GA Airfoils</em></a>
            (1996) catalogs sections designed for general aviation and homebuilt
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
        <section>
          <h3 class="mb-1 font-semibold text-gray-900">CST (Class Shape Transformation)</h3>
          <p>
            CST describes each surface as a class function, which sets the round leading edge and sharp trailing edge,
            multiplied by a Bernstein-polynomial shape function. The shape is set by a handful of upper and lower weights,
            plus a leading-edge modification weight and a trailing-edge thickness, so any smooth airfoil can be built or
            changed with few parameters. Fit the weights to an airfoil from the catalog, then plot it, run a NeuralFoil
            polar, or download the CST parameters as CSV and the coordinates as Selig and Lednicer .dat files.
          </p>
          <p class="mt-2">
            Inspiration for the CST generator by
            <a href="https://github.com/matuscvengros/" target="_blank" rel="noopener noreferrer" class="font-medium text-primary-600 hover:underline">Matuscvengros</a>.
          </p>
        </section>
      </div>
    </VPanel>
  </div>
</template>
