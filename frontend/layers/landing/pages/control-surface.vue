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
  { deflection: 0, hinge_point: 0.75 }, // Default: original airfoil
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
  if (!airfoil.value || !results.value) return []

  const geometries: Array<{
    name: string
    upperX: number[]
    upperY: number[]
    lowerX: number[]
    lowerY: number[]
    color: string
  }> = []

  // Add original airfoil
  geometries.push({
    name: 'Original',
    upperX: airfoil.value.upper_x_coordinates || [],
    upperY: airfoil.value.upper_y_coordinates || [],
    lowerX: airfoil.value.lower_x_coordinates || [],
    lowerY: airfoil.value.lower_y_coordinates || [],
    color: '#3B82F6', // Blue
  })

  // Add deflected configurations
  const colors = ['#EF4444', '#10B981', '#F59E0B'] // Red, Green, Amber
  results.value.results.forEach((result, index) => {
    if (result.deflection !== 0) {
      geometries.push({
        name: `δ=${result.deflection}° @ ${(result.hinge_point * 100).toFixed(0)}%`,
        upperX: result.geometry.upper_x,
        upperY: result.geometry.upper_y,
        lowerX: result.geometry.lower_x,
        lowerY: result.geometry.lower_y,
        color: colors[index % colors.length],
      })
    }
  })

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
  <div class="min-h-screen bg-gray-50 py-12">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8">
        <button
          type="button"
          @click="router.back()"
          class="mb-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <Icon name="heroicons:arrow-left" class="h-4 w-4" />
          Back
        </button>
        <h1 class="text-3xl font-bold text-gray-900">Control Surface Analysis</h1>
        <p v-if="airfoil" class="mt-2 text-lg text-gray-600">
          Airfoil: {{ airfoil.name }}
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p class="text-gray-600">Loading airfoil...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <Icon name="heroicons:exclamation-triangle" class="h-12 w-12 text-red-600 mx-auto mb-4" />
        <h2 class="text-lg font-semibold text-red-900 mb-2">Error</h2>
        <p class="text-red-800">{{ error }}</p>
      </div>

      <!-- Main Content -->
      <div v-else-if="airfoil" class="space-y-8">
        <!-- Flap Configuration Table -->
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-semibold text-gray-900">Flap Configurations</h2>
              <span class="text-xs text-gray-500">(Up to three)</span>
            </div>
            <button
              v-if="flapConfigs.length < 3"
              type="button"
              @click="addFlapConfig"
              class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Add Configuration
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deflection (deg)
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hinge Point (% chord)
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(config, index) in flapConfigs" :key="index">
                  <td class="px-4 py-3 whitespace-nowrap">
                    <VInput
                      v-model.number="config.deflection"
                      type="number"
                      step="0.5"
                      min="-30"
                      max="30"
                      wrapper-class="w-32"
                      size="sm"
                    />
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    <VInput
                      v-model.number="config.hinge_point"
                      type="number"
                      step="0.01"
                      min="0.5"
                      max="0.9"
                      wrapper-class="w-32"
                      size="sm"
                    />
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    <button
                      v-if="flapConfigs.length > 1"
                      type="button"
                      @click="removeFlapConfig(index)"
                      class="text-red-600 hover:text-red-800"
                      title="Remove configuration"
                    >
                      <Icon name="heroicons:trash-20-solid" class="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-2 text-xs text-gray-500">
            Deflection range: -30° to +30° | Hinge point range: 50% to 90% chord
          </p>
        </div>

        <!-- Flow Conditions -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Flow Conditions</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Reynolds Number (×1000)
              </label>
              <VInput
                v-model.number="reynoldsNumber"
                type="number"
                step="100"
                min="1"
                wrapper-class="w-full"
                size="lg"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Mach Number
              </label>
              <VInput
                v-model.number="machNumber"
                type="number"
                step="0.1"
                min="0"
                wrapper-class="w-full"
                size="lg"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                N-crit
              </label>
              <VInput
                v-model.number="nCrit"
                type="number"
                step="0.5"
                min="1"
                wrapper-class="w-full"
                size="lg"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Alpha Min (deg)
              </label>
              <VInput
                v-model.number="alphaMin"
                type="number"
                step="1"
                wrapper-class="w-full"
                size="lg"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Alpha Max (deg)
              </label>
              <VInput
                v-model.number="alphaMax"
                type="number"
                step="1"
                wrapper-class="w-full"
                size="lg"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Alpha Step (deg)
              </label>
              <VInput
                v-model.number="alphaStep"
                type="number"
                step="0.1"
                min="0.1"
                wrapper-class="w-full"
                size="lg"
              />
            </div>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="flex justify-center">
          <button
            type="button"
            @click="handleAnalysis"
            :disabled="!isValidConfig || isAnalyzing"
            class="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Icon
              v-if="isAnalyzing"
              name="heroicons:arrow-path"
              class="h-5 w-5 animate-spin"
            />
            <span>{{ isAnalyzing ? 'Running Analysis...' : 'Run Performance Analysis' }}</span>
          </button>
        </div>

        <!-- Analysis Error -->
        <div v-if="analysisError" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-red-800">{{ analysisError }}</p>
        </div>

        <!-- Results -->
        <div v-if="results" class="space-y-8">
          <!-- Geometry Overlay -->
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Airfoil Geometry Comparison</h2>
            <AirfoilGeometry
              :geometries="geometriesForDisplay"
              :show-legend="true"
              height="500"
            />
          </div>

          <!-- Performance Plots -->
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Performance Comparison</h2>
            <AirfoilPolarPlots :performance-data="performanceDataForPlots" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

