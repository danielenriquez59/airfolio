<script setup lang="ts">
interface Props {
  isLoading?: boolean
}

interface Emits {
  (e: 'analyze', conditions: {
    reynolds: number
    mach: number
    alphaStart: number
    alphaEnd: number
    alphaStep: number
    nCrit: number
  }): void
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
})

const emit = defineEmits<Emits>()

const reynolds = ref<number>(100) // Reynolds number in thousands
const mach = ref<number>(0)
const alphaStart = ref<number>(-5)
const alphaEnd = ref<number>(20)
const alphaStep = ref<number>(0.5)
const nCrit = ref<number>(9)

const inputClass = 'num block h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'


const handleSubmit = () => {
  if (props.isLoading) return

  // Validate inputs
  if (reynolds.value <= 0) {
    alert('Reynolds number must be positive')
    return
  }
  if (alphaStart.value >= alphaEnd.value) {
    alert('Alpha start must be less than alpha end')
    return
  }
  if (alphaStep.value <= 0) {
    alert('Alpha step must be positive')
    return
  }

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
  <VPanel title="Performance analysis" description="NeuralFoil on the generated geometry. Results are not cached.">
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2">
        <label for="cst-re" class="mb-1.5 block text-sm font-medium text-gray-700">Re (thousands)</label>
        <input
          id="cst-re"
          v-model.number="reynolds"
          type="number"
          min="10"
          step="10"
          aria-describedby="cst-re-hint"
          :class="inputClass"
        >
        <p id="cst-re-hint" class="mt-1 text-xs text-gray-500">
          e.g. 100 = Re 100,000
        </p>
      </div>
      <div>
        <label for="cst-mach" class="mb-1.5 block text-sm font-medium text-gray-700">Mach</label>
        <input id="cst-mach" v-model.number="mach" type="number" min="0" max="1" step="0.01" :class="inputClass">
      </div>
      <div>
        <label for="cst-ncrit" class="mb-1.5 block text-sm font-medium text-gray-700">N-crit</label>
        <input id="cst-ncrit" v-model.number="nCrit" type="number" min="1" max="20" step="0.5" :class="inputClass">
      </div>
      <div>
        <label for="cst-astart" class="mb-1.5 block text-sm font-medium text-gray-700">α start (deg)</label>
        <input id="cst-astart" v-model.number="alphaStart" type="number" step="0.5" :class="inputClass">
      </div>
      <div>
        <label for="cst-aend" class="mb-1.5 block text-sm font-medium text-gray-700">α end (deg)</label>
        <input id="cst-aend" v-model.number="alphaEnd" type="number" step="0.5" :class="inputClass">
      </div>
      <div>
        <label for="cst-astep" class="mb-1.5 block text-sm font-medium text-gray-700">α step (deg)</label>
        <input id="cst-astep" v-model.number="alphaStep" type="number" min="0.1" step="0.1" :class="inputClass">
      </div>
    </div>

    <div class="mt-5 border-t border-gray-200 pt-4">
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
          class="h-4 w-4 animate-spin"
          aria-hidden="true"
        />
        <span>{{ isLoading ? 'Running analysis…' : 'Run analysis' }}</span>
      </VButton>
    </div>
  </VPanel>
</template>
