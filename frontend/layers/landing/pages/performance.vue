<script setup lang="ts">
import type { SearchParams } from '~/composables/useAirfoilSearch'
import { useDebounceFn } from '@vueuse/core'

definePageMeta({
  layout: 'detail',
})

const { searchAirfoils } = useAirfoilSearch()

// Geometry filter states
const thicknessEnabled = ref(false)
const thicknessMin = ref<number | undefined>()
const thicknessMax = ref<number | undefined>()

const camberEnabled = ref(false)
const camberMin = ref<number | undefined>()
const camberMax = ref<number | undefined>()

// Analysis parameters
const reynoldsNumber = ref<number | undefined>()
const alphaMin = ref<number | undefined>()
const alphaMax = ref<number | undefined>()
const nCrit = ref<number | undefined>()

// Matched airfoil count
const matchedCount = ref<number>(0)
const isLoadingCount = ref(false)

// Helper functions to convert between display (percentage) and database (decimal) format
const percentageToDecimal = (value: number): number => value / 100
const decimalToPercentage = (value: number): number => value * 100

// Debounced function to update airfoil count
const updateAirfoilCount = useDebounceFn(async () => {
  isLoadingCount.value = true
  try {
    const params: SearchParams = {
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
watch([thicknessEnabled, thicknessMin, thicknessMax, camberEnabled, camberMin, camberMax], () => {
  if (thicknessEnabled.value || camberEnabled.value) {
    updateAirfoilCount()
  } else {
    // If no filters enabled, get total count
    updateAirfoilCount()
  }
}, { immediate: true })

// Validation computed properties
const reynoldsValid = computed(() => {
  if (reynoldsNumber.value === undefined) return false
  return reynoldsNumber.value >= 80 && reynoldsNumber.value <= 5000
})

const alphaValid = computed(() => {
  if (alphaMin.value === undefined || alphaMax.value === undefined) return false
  return alphaMin.value >= -25 && alphaMin.value <= 90 &&
         alphaMax.value >= -25 && alphaMax.value <= 90 &&
         alphaMin.value < alphaMax.value
})

const nCritValid = computed(() => {
  if (nCrit.value === undefined) return false
  return Number.isInteger(nCrit.value) && nCrit.value >= 5 && nCrit.value <= 9
})

const canRunAnalysis = computed(() => {
  return reynoldsValid.value && alphaValid.value && nCritValid.value && matchedCount.value > 0
})

// Placeholder handler for run button
const handleRunAnalysis = () => {
  console.log('Run Performance Analysis', {
    filters: {
      thickness: thicknessEnabled.value ? {
        min: thicknessMin.value,
        max: thicknessMax.value,
      } : null,
      camber: camberEnabled.value ? {
        min: camberMin.value,
        max: camberMax.value,
      } : null,
    },
    parameters: {
      reynolds: reynoldsNumber.value,
      alphaRange: [alphaMin.value, alphaMax.value, 0.5], // Step size hardcoded to 0.5
      nCrit: nCrit.value,
    },
    matchedAirfoils: matchedCount.value,
  })
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
          <p v-if="reynoldsNumber !== undefined && !reynoldsValid" class="mt-1 text-xs text-red-600">
            Reynolds number must be between 80 and 5000.
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
          <p v-if="alphaMin !== undefined && alphaMax !== undefined && !alphaValid" class="mt-1 text-xs text-red-600">
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
          <p v-if="nCrit !== undefined && !nCritValid" class="mt-1 text-xs text-red-600">
            N_crit must be an integer between 5 and 9.
          </p>
        </div>
      </div>
    </div>

    <!-- Run Button -->
    <div class="bg-white rounded-lg shadow p-6">
      <button
        type="button"
        :disabled="!canRunAnalysis"
        :class="[
          'w-full px-6 py-3 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
          canRunAnalysis
            ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        ]"
        @click="handleRunAnalysis"
      >
        Run Performance Analysis
      </button>
      <p v-if="!canRunAnalysis" class="mt-2 text-xs text-gray-500 text-center">
        <span v-if="matchedCount === 0">No airfoils match the selected filters.</span>
        <span v-else-if="!reynoldsValid || !alphaValid || !nCritValid">Please fill in all analysis parameters with valid values.</span>
      </p>
    </div>
  </div>
</template>

