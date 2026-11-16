<script setup lang="ts">
import type { NACACoordinates } from '~/composables/useNACAGenerator'
import { surfacesCross } from '~/composables/useNACAGenerator'
import { exportCoordinates, exportNACAParameters, pointsToClipboardText } from '~/composables/useNACAExport'
import { exportCSTParameters } from '~/composables/useCSTExport'
import { AIRFOIL_FAMILIES, type Family, type FamilyParams, FAMILY_KEYS, defaultCSTWeights, familyDef } from '~/utils/airfoilFamilies'
import AirfoilPolarPlots from '~/components/analysis/AirfoilPolarPlots.vue'

definePageMeta({
  layout: 'detail',
})

// SEO
useSeoMeta({
  title: 'Airfoil Generator - NACA 4-Digit, 5-Digit, 16-Series, 6-Series, Riblett GA, CST and PARSEC Airfoils',
  description: 'Generate and analyze NACA 4-digit (and modified), 5-digit (and reflex), 16-series, 6-series, Riblett GA, CST (Class Shape Transformation) and PARSEC airfoils. Visualize airfoil geometry, adjust camber, thickness, CST weights or PARSEC parameters, fit CST to catalog airfoils, run performance analysis, and export in Selig and Lednicer formats.',
  ogTitle: 'Airfoil Generator - NACA 4-Digit, 5-Digit, 16-Series, 6-Series, Riblett GA, CST and PARSEC Airfoils',
  ogDescription: 'Generate and analyze NACA 4-digit (and modified), 5-digit (and reflex), 16-series, 6-series, Riblett GA, CST (Class Shape Transformation) and PARSEC airfoils. Visualize airfoil geometry, run performance analysis, and export in Selig and Lednicer formats.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

const config = useRuntimeConfig()
const route = useRoute()
const router = useRouter()

// State: the open tab (?series= holds it, none = 4-digit) and every family's parameters, kept across tab switches
const seriesType = ref<Family>('4-digit')
const params = reactive(structuredClone(Object.fromEntries(FAMILY_KEYS.map(f => [f, AIRFOIL_FAMILIES[f].defaults]))) as unknown as FamilyParams)
const handleOrderUpdate = (order: number) => {
  params.cst = { ...params.cst, order, ...defaultCSTWeights(order) }
}
const family = computed(() => familyDef(seriesType.value))
// 6-series and Riblett have fixed points
const coordinates = (analysis: boolean) =>
  family.value.generate(params[seriesType.value], analysis ? 150 : seriesType.value === 'cst' ? 400 : 100)
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

const currentNacaName = computed(() => family.value.name(params[seriesType.value]))
const fileBase = computed(() => family.value.fileBase(params[seriesType.value]))
const crossing = computed(() => seriesType.value === 'parsec' && !!nacaCoordinates.value && surfacesCross(nacaCoordinates.value))

// The static page is rendered without a query, so the tab from ?series= is applied after mount (no hydration mismatch)
onMounted(() => {
  const q = route.query.series as Family
  if (FAMILY_KEYS.includes(q)) seriesType.value = q
  regenerateCoordinates()
})
watch(seriesType, (s) => {
  router.replace({ query: { ...route.query, series: s === '4-digit' ? undefined : s } })
})

// Watch for parameter changes
watch(
  () => [seriesType.value, params],
  () => {
    regenerateCoordinates()
    analysisResults.value = null // the old polar belongs to the previous shape
  },
  { deep: true }
)

const regenerateCoordinates = () => {
  nacaCoordinates.value = coordinates(false)
}

const handleExportParameters = () => {
  if (!nacaCoordinates.value) return
  if (seriesType.value === 'cst') return exportCSTParameters(params.cst, fileBase.value)
  exportNACAParameters(seriesType.value, params[seriesType.value], currentNacaName.value, fileBase.value)
}

// CST files carry CST_Airfoil as the name inside and the _cst_ suffix
const handleExportCoordinates = (format: 'selig' | 'lednicer') => {
  if (!nacaCoordinates.value) return
  const cst = seriesType.value === 'cst'
  exportCoordinates(nacaCoordinates.value, cst ? fileBase.value : currentNacaName.value, fileBase.value, cst ? 'cst' : 'naca', format)
}

// Same point list as the Selig file; the label shows the result for 2 s
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
const handleCopyPoints = async () => {
  if (!nacaCoordinates.value) return
  try {
    await navigator.clipboard.writeText(pointsToClipboardText(nacaCoordinates.value))
    copyState.value = 'copied'
  }
  catch {
    copyState.value = 'failed' // no clipboard API, or permission refused
  }
  setTimeout(() => { copyState.value = 'idle' }, 2000)
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
    const analysisCoords = coordinates(true) // denser: 150 points

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
      subtitle="Generate and analyze NACA 4-digit, 5-digit, 16-series, 6-series, Riblett GA, CST and PARSEC airfoils"
      eyebrow="Tools"
    >
      <template #actions>
        <VButton color="light" size="sm" :disabled="!nacaCoordinates" @click="handleExportParameters">
          <Icon name="heroicons:arrow-down-tray-20-solid" class="h-4 w-4 shrink-0" aria-hidden="true" />
          Parameters (CSV)
        </VButton>
        <VButton color="light" size="sm" :disabled="!nacaCoordinates" @click="handleExportCoordinates('selig')">
          <Icon name="heroicons:arrow-down-tray-20-solid" class="h-4 w-4 shrink-0" aria-hidden="true" />
          Selig (.dat)
        </VButton>
        <VButton color="light" size="sm" :disabled="!nacaCoordinates" @click="handleExportCoordinates('lednicer')">
          <Icon name="heroicons:arrow-down-tray-20-solid" class="h-4 w-4 shrink-0" aria-hidden="true" />
          Lednicer (.dat)
        </VButton>
        <VButton color="light" size="sm" :disabled="!nacaCoordinates" @click="handleCopyPoints">
          <Icon :name="copyState === 'copied' ? 'heroicons:check' : 'heroicons:clipboard-document'" class="h-4 w-4 shrink-0" aria-hidden="true" />
          {{ copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy points' }}
        </VButton>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Inputs -->
      <div class="min-w-0 space-y-6">
        <VPanel title="Parameters">
          <NACAParameterEditor
            :series-type="seriesType"
            :params="params[seriesType]"
            :naca-name="currentNacaName"
            @update:series-type="seriesType = $event"
            @update:params="params[seriesType] = $event"
          />
        </VPanel>

        <CSTParameterEditor
          v-if="seriesType === 'cst'"
          :parameters="params.cst"
          @update:parameters="params.cst = $event"
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
          <p v-if="crossing" class="mt-2 text-xs text-warning-700" role="status">
            The upper and lower surfaces cross; adjust the crest or trailing-edge parameters.
          </p>
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
        <section>
          <h3 class="mb-1 font-semibold text-gray-900">PARSEC</h3>
          <p>
            Helmut Sobieczky's PARSEC method (1998) builds each surface from six powers of x, fixed by 11 parameters
            with a direct geometric meaning: leading-edge radius, the position, height and curvature of the upper and
            lower crests, and the trailing-edge height, thickness, direction and wedge angle. That makes it a common
            choice for airfoil optimization, where each parameter moves one visible feature of the shape.
          </p>
        </section>
      </div>
    </VPanel>
  </div>
</template>
