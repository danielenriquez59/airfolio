<script setup lang="ts">
import type { CSTParameters } from '~/composables/useCSTParameters'
import type { Database } from '~/types/database.types'
import SparAirfoilSelector from '~/layers/landing/components/spar/SparAirfoilSelector.vue'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

interface Props {
  parameters: CSTParameters
  /** Off while the parent refits the weights itself on a count change */
  refitOnOrderChange?: boolean
}

interface Emits {
  (e: 'update:parameters', params: CSTParameters): void
  (e: 'update-order', order: number): void
}

const props = withDefaults(defineProps<Props>(), { refitOnOrderChange: true })
const emit = defineEmits<Emits>()

const { fetchAirfoilGeometry } = useAirfoils()
const { fitCSTToGeometry } = useCSTParameters()

// Airfoil fit state
const selectedAirfoil = ref<Airfoil | null>(null)
const isFitting = ref(false)

const handleFitToAirfoil = async (weights = props.parameters.order + 1) => {
  if (!selectedAirfoil.value) return

  isFitting.value = true
  try {
    // Weights are fitted (and shown) in the standard CST frame: true LE at the origin, unit chord along x
    emit('update:parameters', fitCSTToGeometry(await fetchAirfoilGeometry(selectedAirfoil.value.id), weights))
  } catch (err) {
    console.error('Error fitting CST parameters:', err)
  } finally {
    isFitting.value = false
  }
}

/** Displayed count is order + 1; default 4 (order 3) when parent omits order */
const DEFAULT_INPUT_ORDER = 4
const inputOrder = ref(
  String((props.parameters.order ?? DEFAULT_INPUT_ORDER - 1) + 1)
)

// Watch for inputOrder changes and auto-update weights
watch(inputOrder, (newValue) => {
  const count = parseInt(newValue)
  if (isNaN(count) || count < 3 || count > 21) {
    return
  }

  const newOrder = count - 1
  if (newOrder !== props.parameters.order) {
    // Read before the emit: the value from before this count change
    const refit = props.refitOnOrderChange && selectedAirfoil.value
    emit('update-order', newOrder)
    // Re-fit instead of keeping the parent's default weights; the fit awaits a fetch, so it lands after that reset
    if (refit)
      handleFitToAirfoil(count)
  }
})

// Reset invalid input values on blur
const handleInputBlur = () => {
  const count = parseInt(inputOrder.value)
  if (isNaN(count) || count < 3 || count > 21) {
    inputOrder.value = String(props.parameters.order + 1)
  }
}

// Sync inputOrder when parameters.order changes externally
watch(() => props.parameters.order, (newOrder) => {
  inputOrder.value = String(newOrder + 1)
})

const handleWeightChange = (index: number, isUpper: boolean, value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return

  const newParams = { ...props.parameters }
  if (isUpper) {
    newParams.upperWeights = [...newParams.upperWeights]
    newParams.upperWeights[index] = numValue
  } else {
    newParams.lowerWeights = [...newParams.lowerWeights]
    newParams.lowerWeights[index] = numValue
  }
  emit('update:parameters', newParams)
}

const handleEdgeChange = (key: 'leWeight' | 'teThickness', value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return

  emit('update:parameters', { ...props.parameters, [key]: numValue })
}

</script>

<template>
  <div class="space-y-6">
    <!-- Fit to Airfoil -->
    <VPanel title="Fit to airfoil" description="Fit the weights to an existing airfoil from the catalog.">
      <div class="flex items-center gap-2">
        <SparAirfoilSelector
          v-model="selectedAirfoil"
          class="min-w-0 flex-1"
          input-id="cst-fit-search"
          label="Airfoil to fit"
          hide-label
          :show-selection-summary="false"
        />
        <VButton
          type="button"
          color="light"
          :disabled="!selectedAirfoil || isFitting"
          @click="handleFitToAirfoil()"
        >
          <Icon :name="isFitting ? 'heroicons:arrow-path' : 'heroicons:sparkles'"  class="h-4 w-4" :class="{ 'animate-spin': isFitting }" aria-hidden="true" />
          <span class="whitespace-nowrap">{{ isFitting ? 'Fitting...' : 'Fit' }}</span>
        </VButton>
      </div>
    </VPanel>

    <slot />

    <!-- Parameters -->
    <VPanel title="CST parameters">
      <div class="flex items-center justify-between gap-3">
        <label for="cst-order" class="text-sm font-medium text-gray-700">Weights count (N+1)</label>
        <input
          id="cst-order"
          v-model="inputOrder"
          type="number"
          min="3"
          max="8"
          class="num h-9 w-20 rounded-lg border border-gray-300 px-2 text-right text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          @blur="handleInputBlur"
        >
      </div>

      <!-- Upper / Lower weights: label | slider | value -->
      <div
        v-for="side in ([
          { key: 'upper', title: 'Upper weights', weights: parameters.upperWeights, isUpper: true, min: '-0.5', max: '1.0' },
          { key: 'lower', title: 'Lower weights', weights: parameters.lowerWeights, isUpper: false, min: '-1.0', max: '0.5' },
        ] as const)"
        :key="side.key"
        class="mt-5 border-t border-gray-200 pt-4"
      >
        <div class="mb-2 flex items-baseline justify-between">
          <h3 class="data-label">{{ side.title }}</h3>
          <span class="text-xs text-gray-500"><span class="num">{{ side.weights.length }}</span> weights</span>
        </div>
        <div class="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
          <div
            v-for="(weight, index) in side.weights"
            :key="`${side.key}-${index}`"
            class="grid grid-cols-[2rem_1fr_7rem] items-center gap-2"
          >
            <label :for="`cst-${side.key}-${index}`" class="num text-xs text-gray-500">A{{ index }}</label>
            <input
              type="range"
              :min="side.min"
              :max="side.max"
              step="0.001"
              :value="weight"
              :aria-label="`${side.title} A${index}`"
              class="w-full cursor-pointer accent-primary-600"
              @input="handleWeightChange(index, side.isUpper, ($event.target as HTMLInputElement).value)"
            >
            <input
              :id="`cst-${side.key}-${index}`"
              type="number"
              :value="weight"
              step="0.001"
              class="num h-8 w-full rounded-lg border border-gray-300 px-2 text-right text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              @input="handleWeightChange(index, side.isUpper, ($event.target as HTMLInputElement).value)"
            >
          </div>
        </div>
      </div>

      <!-- LE Mod Weight & TE Thickness -->
      <div class="mt-5 space-y-1.5 border-t border-gray-200 pt-4">
        <h3 class="data-label mb-2">Leading / trailing edge</h3>
        <div
          v-for="edge in ([
            { key: 'leWeight', id: 'cst-le', label: 'LE', title: 'LE modification weight', aria: 'LE mod weight', min: '-2.0', max: '2.0', step: '0.001' },
            { key: 'teThickness', id: 'cst-te', label: 'TE', title: 'TE thickness (Δζ)', aria: 'TE thickness (Δζ)', min: '0', max: '0.02', step: '0.0001' },
          ] as const)"
          :key="edge.key"
          class="grid grid-cols-[2rem_1fr_7rem] items-center gap-2"
        >
          <label :for="edge.id" class="text-xs text-gray-500" :title="edge.title">{{ edge.label }}</label>
          <input
            type="range"
            :min="edge.min"
            :max="edge.max"
            :step="edge.step"
            :value="parameters[edge.key]"
            :aria-label="edge.aria"
            class="w-full cursor-pointer accent-primary-600"
            @input="handleEdgeChange(edge.key, ($event.target as HTMLInputElement).value)"
          >
          <input
            :id="edge.id"
            type="number"
            step="0.0001"
            :value="parameters[edge.key]"
            class="num h-8 w-full rounded-lg border border-gray-300 px-2 text-right text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            @input="handleEdgeChange(edge.key, ($event.target as HTMLInputElement).value)"
          >
        </div>
        <p class="pt-1 text-xs text-gray-500">LE = leading-edge mod weight · TE = trailing-edge thickness (Δζ)</p>
      </div>
    </VPanel>
  </div>
</template>
