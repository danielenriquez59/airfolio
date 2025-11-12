<script setup lang="ts">
interface Props {
  initialReynolds?: number
  initialMach?: number
  initialAlphaMin?: number
  initialAlphaMax?: number
  initialNcrit?: number
}

const props = withDefaults(defineProps<Props>(), {
  initialReynolds: 100,
  initialMach: 0,
  initialAlphaMin: -5,
  initialAlphaMax: 20,
  initialNcrit: 9,
})

interface AnalysisParams {
  reynoldsNumber: number
  machNumber: number
  alphaMin: number
  alphaMax: number
  nCrit: number
}

const emit = defineEmits<{
  submit: [params: AnalysisParams]
  'valid-change': [isValid: boolean]
}>()

// Form state
const reynoldsNumber = ref<number>(props.initialReynolds)
const machNumber = ref<number>(props.initialMach)
const alphaMin = ref<number>(props.initialAlphaMin)
const alphaMax = ref<number>(props.initialAlphaMax)
const nCrit = ref<number>(props.initialNcrit)

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

const isValid = computed(() => {
  return reynoldsValid.value && machValid.value && alphaValid.value && nCritValid.value
})

// Watch for validity changes
watch(isValid, (newVal) => {
  emit('valid-change', newVal)
}, { immediate: true })

// Watch for prop changes
watch(() => props.initialReynolds, (val) => {
  if (val !== undefined) reynoldsNumber.value = val
})
watch(() => props.initialMach, (val) => {
  if (val !== undefined) machNumber.value = val
})
watch(() => props.initialAlphaMin, (val) => {
  if (val !== undefined) alphaMin.value = val
})
watch(() => props.initialAlphaMax, (val) => {
  if (val !== undefined) alphaMax.value = val
})
watch(() => props.initialNcrit, (val) => {
  if (val !== undefined) nCrit.value = val
})

// Expose submit method
const submit = () => {
  if (!isValid.value) return
  
  emit('submit', {
    reynoldsNumber: reynoldsNumber.value,
    machNumber: machNumber.value,
    alphaMin: alphaMin.value,
    alphaMax: alphaMax.value,
    nCrit: nCrit.value,
  })
}

defineExpose({ submit, isValid })
</script>

<template>
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
</template>


