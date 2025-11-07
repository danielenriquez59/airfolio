<script setup lang="ts">
import type { SearchParams } from '~/composables/useAirfoilSearch'
import { useDebounceFn } from '@vueuse/core'
import { usePerformanceStore } from '~/stores/performance'

definePageMeta({
  layout: 'detail',
})

const { searchAirfoils } = useAirfoilSearch()
const { submitAnalysis } = useAnalysis()

// Name filter states
const includeName = ref<string>('')
const excludeName = ref<string>('')

// Geometry filter states
const thicknessEnabled = ref(false)
const thicknessMin = ref<number | undefined>()
const thicknessMax = ref<number | undefined>()

const camberEnabled = ref(false)
const camberMin = ref<number | undefined>()
const camberMax = ref<number | undefined>()

// Analysis parameters
const reynoldsNumber = ref<number>(100)
const machNumber = ref<number>(0)
const alphaMin = ref<number>(-5)
const alphaMax = ref<number>(20)
const nCrit = ref<number>(9)

// Matched airfoil count
const matchedCount = ref<number>(0)
const isLoadingCount = ref(false)

// Analysis submission state
const isSubmittingAnalysis = ref(false)
const analysisError = ref<string | null>(null)
const analysisResponse = ref<{
  job_id: string | null
  cached: boolean
  results?: any
} | null>(null)
const searchResult = ref<{ data: Array<{ id: string; name: string }> } | null>(null)

// Helper functions to convert between display (percentage) and database (decimal) format
const percentageToDecimal = (value: number): number => value / 100
const decimalToPercentage = (value: number): number => value * 100

// Validation for name filters (alphanumeric, max 8 characters)
const validateNameFilter = (value: string): boolean => {
  if (!value) return true // Empty is valid
  const alphanumericRegex = /^[a-zA-Z0-9]*$/
  return alphanumericRegex.test(value) && value.length <= 8
}

const includeNameValid = computed(() => validateNameFilter(includeName.value))
const excludeNameValid = computed(() => validateNameFilter(excludeName.value))

// Sanitize name filter inputs (remove non-alphanumeric, limit to 8 chars)
const sanitizeNameInput = (value: string): string => {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
}

// Debounced function to update airfoil count
const updateAirfoilCount = useDebounceFn(async () => {
  isLoadingCount.value = true
  try {
    const params: SearchParams = {
      includeName: includeName.value.trim() || undefined,
      excludeName: excludeName.value.trim() || undefined,
      thicknessMin: thicknessEnabled.value && thicknessMin.value !== undefined
        ? percentageToDecimal(thicknessMin.value)
        : undefined,
      thicknessMax: thicknessEnabled.value && thicknessMax.value !== undefined
        ? percentageToDecimal(thicknessMax.value)
        : undefined,
      camberMin: camberEnabled.value && camberMin.value !== undefined
        ? percentageToDecimal(camberMin.value)
        : undefined,
      camberMax: camberEnabled.value && camberMax.value !== undefined
        ? percentageToDecimal(camberMax.value)
        : undefined,
      page: 1,
      limit: 1, // We only need count
    }

    const result = await searchAirfoils(params)
    matchedCount.value = result.count
  } catch (error) {
    console.error('Error fetching airfoil count:', error)
    matchedCount.value = 0
  } finally {
    isLoadingCount.value = false
  }
}, 300)

// Watch filter changes to update count
watch([includeName, excludeName, thicknessEnabled, thicknessMin, thicknessMax, camberEnabled, camberMin, camberMax], () => {
  updateAirfoilCount()
}, { immediate: true })

// Validation computed properties
const reynoldsValid = computed(() => {
  return reynoldsNumber.value >= 80 && reynoldsNumber.value <= 5000
})

const alphaValid = computed(() => {
  return alphaMin.value >= -25 && alphaMin.value <= 90 &&
         alphaMax.value >= -25 && alphaMax.value <= 90 &&
         alphaMin.value < alphaMax.value
})

const machValid = computed(() => {
  return machNumber.value >= 0 && machNumber.value <= 0.8
})

const nCritValid = computed(() => {
  return Number.isInteger(nCrit.value) && nCrit.value >= 5 && nCrit.value <= 9
})

const canRunAnalysis = computed(() => {
  // Button is disabled if: invalid parameters OR no airfoils match geometry filters
  return reynoldsValid.value && machValid.value && alphaValid.value && nCritValid.value && matchedCount.value > 0
})

// Handler for run button - submits analysis request
const handleRunAnalysis = async () => {
  if (!canRunAnalysis.value) return

  isSubmittingAnalysis.value = true
  analysisError.value = null
  analysisResponse.value = null

  try {
    // First, fetch all matching airfoil IDs
    const searchParams: SearchParams = {
      includeName: includeName.value.trim() || undefined,
      excludeName: excludeName.value.trim() || undefined,
      thicknessMin: thicknessEnabled.value && thicknessMin.value !== undefined
        ? percentageToDecimal(thicknessMin.value)
        : undefined,
      thicknessMax: thicknessEnabled.value && thicknessMax.value !== undefined
        ? percentageToDecimal(thicknessMax.value)
        : undefined,
      camberMin: camberEnabled.value && camberMin.value !== undefined
        ? percentageToDecimal(camberMin.value)
        : undefined,
      camberMax: camberEnabled.value && camberMax.value !== undefined
        ? percentageToDecimal(camberMax.value)
        : undefined,
      page: 1,
      limit: 10000, // Get all matching airfoils (adjust if needed)
    }

    const result = await searchAirfoils(searchParams)
    searchResult.value = result
    const airfoilIds = result.data.map(airfoil => airfoil.id)

    if (airfoilIds.length === 0) {
      analysisError.value = 'No airfoils match the selected filters.'
      return
    }

    // Prepare analysis conditions
    const conditions = {
      Re: reynoldsNumber.value * 1000, // Convert thousands to actual value
      Mach: machNumber.value,
      alpha_range: [alphaMin.value, alphaMax.value, 0.5] as [number, number, number],
      n_crit: nCrit.value,
    }

    // Submit analysis request
    const response = await submitAnalysis(airfoilIds, conditions)
    analysisResponse.value = response

    if (response.cached && response.results) {
      console.log('Analysis results returned from cache:', response.results)
      // Store results in performance store
      const performanceStore = usePerformanceStore()
      performanceStore.setLatestData({
        results: response.results,
        airfoilNames: result.data.map((a: { id: string; name: string }) => a.name),
        conditions: {
          Re: reynoldsNumber.value * 1000,
          Mach: machNumber.value,
          alpha_range: [alphaMin.value, alphaMax.value, 0.5] as [number, number, number],
          n_crit: nCrit.value,
        },
      })
      // Auto-redirect to compare page
      await navigateTo('/compare')
    } else if (response.job_id) {
      console.log('Analysis job submitted:', response.job_id)
      // TODO: Poll for job completion and redirect when done
    } else if (response.results) {
      // Results returned immediately (non-cached)
      console.log('Analysis results returned immediately:', response.results)
      // Store results in performance store
      const performanceStore = usePerformanceStore()
      performanceStore.setLatestData({
        results: response.results,
        airfoilNames: result.data.map((a: { id: string; name: string }) => a.name),
        conditions: {
          Re: reynoldsNumber.value * 1000,
          Mach: machNumber.value,
          alpha_range: [alphaMin.value, alphaMax.value, 0.5] as [number, number, number],
          n_crit: nCrit.value,
        },
      })
      // Auto-redirect to compare page
      await navigateTo('/compare')
    }
  } catch (error: any) {
    console.error('Error submitting analysis:', error)
    analysisError.value = error.message || 'Failed to submit analysis request. Please try again.'
  } finally {
    isSubmittingAnalysis.value = false
  }
}

useHead({
  title: 'Performance Analysis - Airfolio',
})
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Performance Analysis</h1>
      <p class="text-lg text-gray-600">
        Configure geometry filters and analysis parameters to run performance analysis on airfoils.
      </p>
    </div>

    <!-- Geometry Filters Section -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Geometry Filters</h2>
      <p class="text-sm text-gray-600 mb-4">
        Filter airfoils by geometry parameters before running analysis.
      </p>

      <div class="space-y-4">
        <!-- Include Name Filter -->
        <div class="flex items-center gap-4 flex-wrap">
          <label class="text-sm font-medium text-gray-700 min-w-[140px]">
            Include Foils with
          </label>
          <div class="flex items-center gap-2 flex-1">
            <VInput
              :model-value="includeName"
              type="text"
              maxlength="8"
              placeholder="e.g., NACA"
              size="sm"
              wrapper-class="max-w-[120px]"
              :class="{ 'border-red-500': includeName && !includeNameValid }"
              @update:model-value="(val: string | number | undefined) => { includeName = sanitizeNameInput(String(val || '')) }"
            />
            <span class="text-sm text-gray-600">in the name</span>
          </div>
          <p v-if="includeName && !includeNameValid" class="text-xs text-red-600 mt-1">
            Only alphanumeric characters allowed (max 8)
          </p>
        </div>

        <!-- Exclude Name Filter -->
        <div class="flex items-center gap-4 flex-wrap">
          <label class="text-sm font-medium text-gray-700 min-w-[140px]">
            Exclude Foils with
          </label>
          <div class="flex items-center gap-2 flex-1">
            <VInput
              :model-value="excludeName"
              type="text"
              maxlength="8"
              placeholder="e.g., TEST"
              size="sm"
              wrapper-class="max-w-[120px]"
              :class="{ 'border-red-500': excludeName && !excludeNameValid }"
              @update:model-value="(val: string | number | undefined) => { excludeName = sanitizeNameInput(String(val || '')) }"
            />
            <span class="text-sm text-gray-600">in the name</span>
          </div>
          <p v-if="excludeName && !excludeNameValid" class="text-xs text-red-600 mt-1">
            Only alphanumeric characters allowed (max 8)
          </p>
        </div>

        <!-- Thickness Filter -->
        <div class="flex items-start gap-4 flex-wrap">
          <label class="flex items-center gap-2 cursor-pointer min-w-[120px]">
            <input
              v-model="thicknessEnabled"
              type="checkbox"
              class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span class="text-sm font-medium text-gray-700">Thickness</span>
          </label>
          <div v-if="thicknessEnabled" class="flex items-center gap-3 flex-1">
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-600 whitespace-nowrap">Min</label>
              <VInput
                v-model.number="thicknessMin"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="0"
                size="sm"
                wrapper-class="w-24"
              />
            </div>
            <span class="text-gray-400">%</span>
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-600 whitespace-nowrap">Max</label>
              <VInput
                v-model.number="thicknessMax"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="100"
                size="sm"
                wrapper-class="w-24"
              />
            </div>
            <span class="text-gray-400">%</span>
          </div>
        </div>

        <!-- Camber Filter -->
        <div class="flex items-start gap-4 flex-wrap">
          <label class="flex items-center gap-2 cursor-pointer min-w-[120px]">
            <input
              v-model="camberEnabled"
              type="checkbox"
              class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span class="text-sm font-medium text-gray-700">Camber</span>
          </label>
          <div v-if="camberEnabled" class="flex items-center gap-3 flex-1">
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-600 whitespace-nowrap">Min</label>
              <VInput
                v-model.number="camberMin"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="0"
                size="sm"
                wrapper-class="w-24"
              />
            </div>
            <span class="text-gray-400">%</span>
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-600 whitespace-nowrap">Max</label>
              <VInput
                v-model.number="camberMax"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="100"
                size="sm"
                wrapper-class="w-24"
              />
            </div>
            <span class="text-gray-400">%</span>
          </div>
        </div>
      </div>

      <!-- Airfoil Count Display -->
      <div class="mt-4 pt-4 border-t border-gray-200">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">Matching airfoils:</span>
          <span v-if="isLoadingCount" class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></span>
          <span v-else class="text-sm font-semibold text-gray-900">{{ matchedCount }} airfoil{{ matchedCount !== 1 ? 's' : '' }}</span>
        </div>
      </div>
    </div>

    <!-- Analysis Parameters Section -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Analysis Parameters</h2>
      <p class="text-sm text-gray-600 mb-4">
        Configure the flow conditions for the performance analysis.
      </p>

      <div class="space-y-6">
        <!-- Reynolds Number -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Reynolds Number (thousands)
          </label>
          <VInput
            v-model.number="reynoldsNumber"
            type="number"
            step="1"
            min="80"
            max="5000"
            placeholder="1000"
            size="lg"
            wrapper-class="max-w-xs"
          />
          <p class="mt-1 text-xs text-gray-500">
            Range: 80k - 5000k
          </p>
          <p v-if="!reynoldsValid" class="mt-1 text-xs text-red-600">
            Reynolds number must be between 80 and 5000.
          </p>
        </div>

        <!-- Mach Number -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Mach Number
          </label>
          <VInput
            v-model.number="machNumber"
            type="number"
            step="0.05"
            min="0"
            max="0.8"
            placeholder="0.0"
            size="lg"
            wrapper-class="max-w-xs"
          />
          <p class="mt-1 text-xs text-gray-500">
            Range: 0 - 0.8, Step size: 0.05
          </p>
          <p v-if="!machValid" class="mt-1 text-xs text-red-600">
            Mach number must be between 0 and 0.8.
          </p>
        </div>

        <!-- Alpha Range -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Alpha Range (degrees)
          </label>
          <div class="flex items-center gap-4 flex-wrap">
            <div class="flex-1 min-w-[200px]">
              <label class="block text-xs text-gray-600 mb-1">Min</label>
              <VInput
                v-model.number="alphaMin"
                type="number"
                step="0.5"
                min="-25"
                max="90"
                placeholder="-10"
                size="lg"
              />
            </div>
            <div class="flex-1 min-w-[200px]">
              <label class="block text-xs text-gray-600 mb-1">Max</label>
              <VInput
                v-model.number="alphaMax"
                type="number"
                step="0.5"
                min="-25"
                max="90"
                placeholder="20"
                size="lg"
              />
            </div>
          </div>
          <p class="mt-1 text-xs text-gray-500">
            Range: -25° to 90°, Step size: 0.5°
          </p>
          <p v-if="!alphaValid" class="mt-1 text-xs text-red-600">
            Alpha range must be between -25° and 90°, and min must be less than max.
          </p>
        </div>

        <!-- N_crit -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            N_crit
          </label>
          <VInput
            v-model.number="nCrit"
            type="number"
            step="1"
            min="5"
            max="9"
            placeholder="7"
            size="lg"
            wrapper-class="max-w-xs"
          />
          <p class="mt-1 text-xs text-gray-500">
            Range: 5 - 9 (integer only)
          </p>
          <p v-if="!nCritValid" class="mt-1 text-xs text-red-600">
            N_crit must be an integer between 5 and 9.
          </p>
        </div>
      </div>
    </div>

    <!-- Run Button -->
    <div class="bg-white rounded-lg shadow p-6">
      <button
        type="button"
        :disabled="!canRunAnalysis || isSubmittingAnalysis"
        :class="[
          'w-full px-6 py-3 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2',
          canRunAnalysis && !isSubmittingAnalysis
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        ]"
        @click="handleRunAnalysis"
      >
        <span v-if="isSubmittingAnalysis" class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
        <span>{{ isSubmittingAnalysis ? 'Submitting Analysis...' : 'Run Performance Analysis' }}</span>
      </button>
      <p v-if="!canRunAnalysis" class="mt-2 text-xs text-gray-500 text-center">
        <span v-if="matchedCount === 0">No airfoils match the selected filters.</span>
        <span v-else-if="!reynoldsValid || !machValid || !alphaValid || !nCritValid">Please fill in all analysis parameters with valid values.</span>
      </p>
      
      <!-- Error Message -->
      <div v-if="analysisError" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
        <p class="text-sm text-red-800">{{ analysisError }}</p>
      </div>

      <!-- Success Message -->
      <div v-if="analysisResponse && !analysisError" class="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
        <p class="text-sm text-green-800 font-medium mb-2">
          {{ analysisResponse.cached ? 'Analysis results retrieved from cache' : 'Analysis job submitted successfully' }}
        </p>
        <p v-if="analysisResponse.job_id" class="text-xs text-green-700">
          Job ID: {{ analysisResponse.job_id }}
        </p>
        <p v-if="analysisResponse.cached && analysisResponse.results" class="text-xs text-green-700 mt-2">
          Results are ready for display.
        </p>
        <p v-if="analysisResponse.results" class="text-xs text-green-700 mt-2">
          Redirecting to compare page...
        </p>
      </div>
    </div>
  </div>
</template>

