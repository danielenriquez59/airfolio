<script setup lang="ts">
interface Conditions {
  reynolds: number
  mach: number
  alphaStart: number
  alphaEnd: number
  alphaStep: number
  nCrit: number
}

interface Props {
  isLoading?: boolean
  description?: string
  initialConditions?: Conditions
}

interface Emits {
  (e: 'analyze', conditions: Conditions): void
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  description: 'NeuralFoil analysis of the generated section. Results are not cached.',
})

const emit = defineEmits<Emits>()

const reynolds = ref<number>(100) // Reynolds number in thousands
const mach = ref<number>(0)
const alphaStart = ref<number>(-5)
const alphaEnd = ref<number>(20)
const alphaStep = ref<number>(0.5)
const nCrit = ref<number>(9)
const error = ref('')

// The parent may only know them after mount (e.g. read from localStorage)
watch(() => props.initialConditions, (c) => {
  if (!c)
    return
  reynolds.value = c.reynolds
  mach.value = c.mach
  alphaStart.value = c.alphaStart
  alphaEnd.value = c.alphaEnd
  alphaStep.value = c.alphaStep
  nCrit.value = c.nCrit
}, { immediate: true })

const fields = [
  { id: 'naca-re', label: 'Reynolds (thousands)', model: reynolds, min: 10, step: 10, help: 'e.g. 100 = Re 100,000', wide: true },
  { id: 'naca-mach', label: 'Mach', model: mach, min: 0, max: 1, step: 0.01 },
  { id: 'naca-ncrit', label: 'N-Crit', model: nCrit, min: 1, max: 20, step: 0.5 },
  { id: 'naca-alpha-start', label: 'Alpha start (deg)', model: alphaStart, step: 0.5 },
  { id: 'naca-alpha-end', label: 'Alpha end (deg)', model: alphaEnd, step: 0.5 },
  { id: 'naca-alpha-step', label: 'Alpha step (deg)', model: alphaStep, min: 0.1, step: 0.1 },
]

function validationError() {
  // v-model.number leaves '' in an emptied field
  if (fields.some(f => typeof f.model.value !== 'number' || !Number.isFinite(f.model.value)))
    return 'Fill in every flow condition.'
  if (reynolds.value <= 0)
    return 'Reynolds number must be positive.'
  if (alphaStart.value >= alphaEnd.value)
    return 'Alpha start must be less than alpha end.'
  if (alphaStep.value <= 0)
    return 'Alpha step must be positive.'
  return ''
}

function handleSubmit() {
  if (props.isLoading)
    return
  error.value = validationError()
  if (error.value)
    return

  emit('analyze', {
    reynolds: reynolds.value,
    mach: mach.value,
    alphaStart: alphaStart.value,
    alphaEnd: alphaEnd.value,
    alphaStep: alphaStep.value,
    nCrit: nCrit.value,
  })
}
</script>

<template>
  <VPanel title="Performance analysis" :description="description">
    <!-- Extra controls above the flow conditions, e.g. a solver choice -->
    <slot />
    <div class="grid grid-cols-2 gap-x-3 gap-y-4">
      <div v-for="field in fields" :key="field.id" :class="field.wide ? 'col-span-2' : ''">
        <label :for="field.id" class="mb-1 block text-sm font-medium text-gray-700">
          {{ field.label }}
        </label>
        <input
          :id="field.id"
          v-model.number="field.model.value"
          type="number"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          class="num h-9 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
        <p v-if="field.help" class="mt-1 text-xs text-gray-500">
          {{ field.help }}
        </p>
      </div>
    </div>

    <div class="mt-5">
      <p v-if="error" class="mb-3 text-sm text-error-700" role="alert">
        {{ error }}
      </p>
      <VButton
        type="button"
        color="primary"
        block
        :disabled="isLoading"
        @click="handleSubmit"
      >
        <Icon
          v-if="isLoading"
          name="heroicons:arrow-path-20-solid"
          class="w-5 h-5 animate-spin"
        />
        <span>{{ isLoading ? 'Running Analysis...' : 'Run Analysis' }}</span>
      </VButton>
      <p v-if="isLoading" class="mt-2 text-xs text-gray-500 text-center">
        Analysis may take a few moments.
      </p>
    </div>
  </VPanel>
</template>
