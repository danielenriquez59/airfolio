<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { AnalysisConditions } from '~/composables/useAnalysis'
import type { FlapConfig, ControlSurfaceResponse } from '~/composables/useControlSurface'
import AirfoilPolarPlots from '~/components/analysis/AirfoilPolarPlots.vue'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

definePageMeta({
  layout: 'default',
})

useHead({
  title: 'Control Surface Analysis - Airfolio',
  meta: [
    {
      name: 'description',
      content: 'Analyze airfoil performance with control surface deflections. Compare multiple flap configurations and visualize geometry changes.'
    }
  ]
})

const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const { fetchAirfoilByName } = useAirfoils()
const { submitControlSurfaceAnalysis } = useControlSurface()

// Get airfoil slug from query param
const airfoilSlug = computed(() => route.query.airfoil as string)

// State
const airfoil = ref<Airfoil | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const isAnalyzing = ref(false)
const analysisError = ref<string | null>(null)
const results = ref<ControlSurfaceResponse | null>(null)

// Flap configurations (up to 3)
const flapConfigs = ref<FlapConfig[]>([
  { deflection: 5, hinge_point: 0.75 }, // Default: 5 degree deflection
])

// Flow conditions
const reynoldsNumber = ref(500) // in thousands
const machNumber = ref(0.0)
const alphaMin = ref(-5)
const alphaMax = ref(15)
const alphaStep = ref(0.5)
const nCrit = ref(9.0)

// Add flap configuration
const addFlapConfig = () => {
  if (flapConfigs.value.length < 3) {
    flapConfigs.value.push({ deflection: 0, hinge_point: 0.75 })
  }
}

// Remove flap configuration
const removeFlapConfig = (index: number) => {
  if (flapConfigs.value.length > 1) {
    flapConfigs.value.splice(index, 1)
  }
}

// Validate flap configurations
const isValidConfig = computed(() => {
  return flapConfigs.value.every(config => {
    const deflection = config.deflection
    const hinge = config.hinge_point
    return deflection >= -30 && deflection <= 30 && hinge >= 0.5 && hinge <= 0.9
  })
})

// Prepare geometries for display
const geometriesForDisplay = computed(() => {
  if (!airfoil.value) return []

  const geometries: Array<{
    name: string
    upperX: number[]
    upperY: number[]
    lowerX: number[]
    lowerY: number[]
    color: string
  }> = []

  // Polars (performanceDataForPlots) list an 'Original' series first only when a 0° config ran,
  // then the deflected configs in order; colour each shape with its polar series index.
  const polarOffset = results.value?.results.some(r => r.deflection === 0) ? 1 : 0

  // Always add original airfoil: neutral unless it also has a polar series (index 0)
  geometries.push({
    name: 'Original',
    upperX: airfoil.value.upper_x_coordinates || [],
    upperY: airfoil.value.upper_y_coordinates || [],
    lowerX: airfoil.value.lower_x_coordinates || [],
    lowerY: airfoil.value.lower_y_coordinates || [],
    color: polarOffset ? seriesColor(0) : chartColors.tick,
  })

  // Add deflected configurations if results are available
  if (results.value) {
    let deflectedIndex = 0
    results.value.results.forEach((result) => {
      if (result.deflection !== 0) {
        geometries.push({
          name: `δ=${result.deflection}° @ ${(result.hinge_point * 100).toFixed(0)}%`,
          upperX: result.geometry.upper_x,
          upperY: result.geometry.upper_y,
          lowerX: result.geometry.lower_x,
          lowerY: result.geometry.lower_y,
          color: seriesColor(polarOffset + deflectedIndex++),

        })
      }
    })
  }

  return geometries
})

// Prepare performance data for plots
const performanceDataForPlots = computed(() => {
  if (!results.value) return []

  const performanceData: Array<{
    name: string
    alpha: number[]
    CL: number[]
    CD: number[]
    CM: number[]
  }> = []

  // Add original airfoil performance (deflection = 0)
  const originalResult = results.value.results.find(r => r.deflection === 0)
  if (originalResult) {
    performanceData.push({
      name: 'Original',
      alpha: originalResult.performance.alpha || [],
      CL: originalResult.performance.CL || [],
      CD: originalResult.performance.CD || [],
      CM: originalResult.performance.CM || [],
    })
  }

  // Add deflected configurations
  results.value.results.forEach(result => {
    if (result.deflection !== 0) {
      performanceData.push({
        name: `δ=${result.deflection}° @ ${(result.hinge_point * 100).toFixed(0)}%`,
        alpha: result.performance.alpha || [],
        CL: result.performance.CL || [],
        CD: result.performance.CD || [],
        CM: result.performance.CM || [],
      })
    }
  })

  return performanceData
})

// Handle analysis submission
const handleAnalysis = async () => {
  if (!airfoil.value || !isValidConfig.value) return

  // Clear existing results before starting new analysis
  results.value = null
  isAnalyzing.value = true
  analysisError.value = null

  try {
    const conditions: AnalysisConditions = {
      Re: reynoldsNumber.value * 1000, // Convert to actual Reynolds number
      Mach: machNumber.value,
      alpha_range: [alphaMin.value, alphaMax.value, alphaStep.value],
      n_crit: nCrit.value,
    }

    const response = await submitControlSurfaceAnalysis({
      airfoil_id: airfoil.value.id,
      conditions,
      flap_configs: flapConfigs.value,
    })

    results.value = response
  } catch (err: any) {
    console.error('Error running control surface analysis:', err)
    analysisError.value = err.message || 'Analysis failed'
  } finally {
    isAnalyzing.value = false
  }
}

// Fetch airfoil data
onMounted(async () => {
  try {
    loading.value = true
    error.value = null

    if (!airfoilSlug.value) {
      error.value = 'No airfoil specified'
      return
    }

    const data = await fetchAirfoilByName(airfoilSlug.value)

    if (!data) {
      error.value = 'Airfoil not found'
      return
    }

    airfoil.value = data
  } catch (err: any) {
    error.value = err.message || 'Failed to load airfoil'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Tools"
      title="Control Surface Analysis"
      subtitle="Deflect a trailing-edge flap and compare geometry and polars for up to three configurations."
    >
      <template #actions>
        <VButton type="button" color="light" size="sm" @click="router.back()">
          <Icon name="heroicons:arrow-left" class="h-4 w-4" aria-hidden="true" />
          Back
        </VButton>
      </template>
    </PageHeader>

    <VPanel v-if="loading">
      <VStateBlock variant="loading" title="Loading airfoil" />
    </VPanel>

    <VPanel v-else-if="error">
      <VStateBlock variant="error" title="Could not load airfoil" :description="error" />
    </VPanel>

    <div v-else-if="airfoil" class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Inputs -->
      <div class="min-w-0 space-y-6">
        <VPanel title="Airfoil">
          <NuxtLink
            :to="`/airfoils/${encodeURIComponent(airfoil.name)}`"
            class="inline-flex items-center gap-1 rounded text-base font-semibold text-primary-700 hover:text-primary-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {{ airfoil.display_name || airfoil.name }}
            <Icon name="heroicons:arrow-up-right" class="h-4 w-4" aria-hidden="true" />
          </NuxtLink>
          <dl class="mt-3 grid grid-cols-2 gap-4">
            <VStat
              label="Thickness"
              :value="airfoil.thickness_pct != null ? (airfoil.thickness_pct * 100).toFixed(2) : 'N/A'"
              :unit="airfoil.thickness_pct != null ? '%' : undefined"
            />
            <VStat
              label="Camber"
              :value="airfoil.camber_pct != null ? (airfoil.camber_pct * 100).toFixed(2) : 'N/A'"
              :unit="airfoil.camber_pct != null ? '%' : undefined"
            />
          </dl>
        </VPanel>

        <VPanel title="Flap configurations" description="Up to three">
          <template #actions>
            <VButton
              v-if="flapConfigs.length < 3"
              type="button"
              color="light"
              size="sm"
              @click="addFlapConfig"
            >
              <Icon name="heroicons:plus" class="h-4 w-4" aria-hidden="true" />
              Add
            </VButton>
          </template>

          <div class="grid grid-cols-[1.25rem_1fr_1fr_2rem] items-center gap-2">
            <span aria-hidden="true" />
            <span class="data-label">Deflection (deg)</span>
            <span class="data-label">Hinge (x/c)</span>
            <span aria-hidden="true" />
            <template v-for="(flap, index) in flapConfigs" :key="index">
              <span class="num text-sm text-gray-500">{{ index + 1 }}</span>
              <VInput
                v-model.number="flap.deflection"
                type="number"
                step="0.5"
                min="-30"
                max="30"
                class="num text-right"
                :aria-label="`Configuration ${index + 1} deflection in degrees`"
              />
              <VInput
                v-model.number="flap.hinge_point"
                type="number"
                step="0.01"
                min="0.5"
                max="0.9"
                class="num text-right"
                :aria-label="`Configuration ${index + 1} hinge point as chord fraction`"
              />
              <button
                v-if="flapConfigs.length > 1"
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-error-50 hover:text-error-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                :aria-label="`Remove configuration ${index + 1}`"
                title="Remove configuration"
                @click="removeFlapConfig(index)"
              >
                <Icon name="heroicons:trash-20-solid" class="h-4 w-4" aria-hidden="true" />
              </button>
              <span v-else aria-hidden="true" />
            </template>
          </div>
          <p class="mt-3 text-xs text-gray-500">
            Deflection −30° to +30° · hinge point 0.50 to 0.90 chord
          </p>
        </VPanel>

        <VPanel title="Flow conditions">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="cs-re" class="mb-1.5 block text-sm font-medium text-gray-700">Re (×1000)</label>
              <VInput id="cs-re" v-model.number="reynoldsNumber" type="number" step="100" min="1" class="num" />
            </div>
            <div>
              <label for="cs-mach" class="mb-1.5 block text-sm font-medium text-gray-700">Mach</label>
              <VInput id="cs-mach" v-model.number="machNumber" type="number" step="0.1" min="0" class="num" />
            </div>
            <div>
              <label for="cs-ncrit" class="mb-1.5 block text-sm font-medium text-gray-700">N-crit</label>
              <VInput id="cs-ncrit" v-model.number="nCrit" type="number" step="0.5" min="1" class="num" />
            </div>
            <div>
              <label for="cs-astep" class="mb-1.5 block text-sm font-medium text-gray-700">α step (deg)</label>
              <VInput id="cs-astep" v-model.number="alphaStep" type="number" step="0.1" min="0.1" class="num" />
            </div>
            <div>
              <label for="cs-amin" class="mb-1.5 block text-sm font-medium text-gray-700">α min (deg)</label>
              <VInput id="cs-amin" v-model.number="alphaMin" type="number" step="1" class="num" />
            </div>
            <div>
              <label for="cs-amax" class="mb-1.5 block text-sm font-medium text-gray-700">α max (deg)</label>
              <VInput id="cs-amax" v-model.number="alphaMax" type="number" step="1" class="num" />
            </div>
          </div>

          <div class="mt-5 border-t border-gray-200 pt-4">
            <VButton
              type="button"
              color="primary"
              block
              :disabled="!isValidConfig || isAnalyzing"
              :aria-describedby="!isValidConfig ? 'cs-run-reason' : undefined"
              @click="handleAnalysis"
            >
              <Icon
                v-if="isAnalyzing"
                name="heroicons:arrow-path"
                class="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              <span>{{ isAnalyzing ? 'Running analysis…' : 'Run NN analysis' }}</span>
            </VButton>
            <p v-if="!isValidConfig" id="cs-run-reason" class="mt-2 text-xs text-error-700">
              Each configuration needs a deflection between −30° and 30° and a hinge point between 0.50 and 0.90.
            </p>
          </div>
        </VPanel>
      </div>

      <!-- Results -->
      <div class="min-w-0 space-y-6 lg:col-span-2">
        <VPanel
          title="Geometry"
          :description="results ? 'Original and deflected configurations' : 'Deflected shapes appear after the analysis runs'"
        >
          <AirfoilGeometry
            :geometries="geometriesForDisplay"
            :show-legend="true"
            :aspect-ratio="3.5"
          />
        </VPanel>

        <VPanel title="Performance comparison">
          <VStateBlock
            v-if="isAnalyzing"
            variant="loading"
            title="Running analysis"
            description="This can take a few moments."
          />
          <VStateBlock
            v-else-if="analysisError"
            variant="error"
            title="Analysis failed"
            :description="analysisError"
          />
          <AirfoilPolarPlots v-else-if="results" :performance-data="performanceDataForPlots" />
          <VStateBlock
            v-else
            icon="heroicons:chart-bar"
            title="No results yet"
            description="Set the flap configurations and flow conditions, then run the analysis."
          />
        </VPanel>
      </div>
    </div>
  </div>
</template>
