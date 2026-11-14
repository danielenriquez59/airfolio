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

// Unique ids so labels stay linked when the form is rendered more than once
const uid = useId()
</script>

<template>
  <div class="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
    <!-- Reynolds Number -->
    <div>
      <label :for="`${uid}-re`" class="mb-1 block text-sm font-medium text-gray-700">
        Reynolds number <span class="font-normal text-gray-500">(thousands)</span>
      </label>
      <VInput
        :id="`${uid}-re`"
        v-model.number="reynoldsNumber"
        type="number"
        step="1"
        min="80"
        max="5000"
        placeholder="1000"
        class="num"
        :error="!reynoldsValid"
      />
      <p class="mt-1 text-xs text-gray-500">
        Range: 80k - 5000k
      </p>
      <p v-if="!reynoldsValid" class="mt-1 text-xs text-error-600">
        Reynolds number must be between 80 and 5000.
      </p>
    </div>

    <!-- Mach Number -->
    <div>
      <label :for="`${uid}-mach`" class="mb-1 block text-sm font-medium text-gray-700">
        Mach number
      </label>
      <VInput
        :id="`${uid}-mach`"
        v-model.number="machNumber"
        type="number"
        step="0.05"
        min="0"
        max="0.8"
        placeholder="0.0"
        class="num"
        :error="!machValid"
      />
      <p class="mt-1 text-xs text-gray-500">
        Range: 0 - 0.8, Step size: 0.05
      </p>
      <p v-if="!machValid" class="mt-1 text-xs text-error-600">
        Mach number must be between 0 and 0.8.
      </p>
    </div>

    <!-- Alpha Range -->
    <fieldset class="sm:col-span-2">
      <legend class="mb-1 block text-sm font-medium text-gray-700">
        Alpha range <span class="font-normal text-gray-500">(degrees)</span>
      </legend>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label :for="`${uid}-amin`" class="mb-1 block text-xs text-gray-500">Min</label>
          <VInput
            :id="`${uid}-amin`"
            v-model.number="alphaMin"
            type="number"
            step="0.5"
            min="-25"
            max="90"
            placeholder="-10"
            class="num"
            :error="!alphaValid"
          />
        </div>
        <div>
          <label :for="`${uid}-amax`" class="mb-1 block text-xs text-gray-500">Max</label>
          <VInput
            :id="`${uid}-amax`"
            v-model.number="alphaMax"
            type="number"
            step="0.5"
            min="-25"
            max="90"
            placeholder="20"
            class="num"
            :error="!alphaValid"
          />
        </div>
      </div>
      <p class="mt-1 text-xs text-gray-500">
        Range: -25° to 90°, Step size: 0.5°
      </p>
      <p v-if="!alphaValid" class="mt-1 text-xs text-error-600">
        Alpha range must be between -25° and 90°, and min must be less than max.
      </p>
    </fieldset>

    <!-- N_crit -->
    <div>
      <div class="mb-1 flex items-center gap-1.5">
        <label :for="`${uid}-ncrit`" class="block text-sm font-medium text-gray-700">
          N_crit
        </label>
        <div class="group relative">
          <button
            type="button"
            class="flex rounded-full text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="About N_crit"
            :aria-describedby="`${uid}-ncrit-tip`"
          >
            <Icon name="heroicons:information-circle" class="h-4 w-4" aria-hidden="true" />
          </button>
          <div
            :id="`${uid}-ncrit-tip`"
            role="tooltip"
            class="pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-72 max-w-[80vw] lg:left-1/2 lg:-translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            In airfoil analysis using XFOIL, Ncrit (critical amplification factor) is a key parameter that controls the transition from laminar to turbulent flow over the airfoil surface by modeling the growth of Tollmien-Schlichting waves via linear instability. It represents the logarithm of the amplification factor of the most-amplified frequency that triggers transition, and its value is chosen based on the ambient disturbance level in the operating environment. A higher Ncrit value indicates a less sensitive flow, promoting laminar flow over a larger portion of the airfoil, while a lower value indicates a more sensitive flow, leading to earlier transition to turbulence. Typical Ncrit values range from 12–14 for high-performance sailplanes where laminar flow is desired, 9 for average wind tunnel conditions (the default in XFOIL), and 4–8 for dirty or highly turbulent environments.
            <div class="absolute left-2 top-full lg:left-1/2 -mt-1 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      </div>
      <VInput
        :id="`${uid}-ncrit`"
        v-model.number="nCrit"
        type="number"
        step="1"
        min="5"
        max="9"
        placeholder="7"
        class="num"
        :error="!nCritValid"
      />
      <p class="mt-1 text-xs text-gray-500">
        Range: 5 - 9 (integer only)
      </p>
      <p v-if="!nCritValid" class="mt-1 text-xs text-error-600">
        N_crit must be an integer between 5 and 9.
      </p>
    </div>
  </div>
</template>
