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
  <div class="p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
    <h3 class="text-lg font-semibold text-gray-900 mb-4">Performance Analysis</h3>
    <p class="text-sm text-gray-600 mb-4">
      Run NeuralFoil analysis on the NACA-generated airfoil. Results are not cached.
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Reynolds Number (thousands)
        </label>
        <input
          v-model.number="reynolds"
          type="number"
          min="10"
          step="10"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p class="mt-1 text-xs text-gray-500">
          Enter value in thousands (e.g., 100 = Re = 100,000)
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Mach Number
        </label>
        <input
          v-model.number="mach"
          type="number"
          min="0"
          max="1"
          step="0.01"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Alpha Start (deg)
        </label>
        <input
          v-model.number="alphaStart"
          type="number"
          step="0.5"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Alpha End (deg)
        </label>
        <input
          v-model.number="alphaEnd"
          type="number"
          step="0.5"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Alpha Step (deg)
        </label>
        <input
          v-model.number="alphaStep"
          type="number"
          min="0.1"
          step="0.1"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          N-Crit
        </label>
        <input
          v-model.number="nCrit"
          type="number"
          min="1"
          max="20"
          step="0.5"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>

    <div class="mt-6">
      <button
        type="button"
        :disabled="isLoading"
        class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2"
        @click="handleSubmit"
      >
        <Icon
          v-if="isLoading"
          name="heroicons:arrow-path-20-solid"
          class="w-5 h-5 animate-spin"
        />
        <span>{{ isLoading ? 'Running Analysis...' : 'Run Analysis' }}</span>
      </button>
      <p v-if="isLoading" class="mt-2 text-xs text-gray-500 text-center">
        Analysis may take a few moments.
      </p>
    </div>
  </div>
</template>

