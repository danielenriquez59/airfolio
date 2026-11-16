<script setup lang="ts">
import type { CSTParameters } from '~/composables/useCSTParameters'
import type { Database } from '~/types/database.types'
import { useDebounceFn } from '@vueuse/core'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

interface Props {
  parameters: CSTParameters
}

interface Emits {
  (e: 'update:parameters', params: CSTParameters): void
  (e: 'update-order', order: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { searchAirfoilsByPrefix } = useAirfoilAutocomplete()
const { fetchAirfoilGeometry } = useAirfoils()
const { fitCSTNormalised } = useCSTParameters()

// Airfoil fit state
const airfoilSearchQuery = ref('')
const airfoilSearchResults = ref<Airfoil[]>([])
const selectedAirfoil = ref<Airfoil | null>(null)
const isSearching = ref(false)
const showDropdown = ref(false)
const isFitting = ref(false)

// Debounced airfoil search
const debouncedAirfoilSearch = useDebounceFn(async (query: string) => {
  if (!query || query.length < 2) {
    airfoilSearchResults.value = []
    showDropdown.value = false
    return
  }

  isSearching.value = true
  try {
    const results = await searchAirfoilsByPrefix(query, 15)
    airfoilSearchResults.value = results
    showDropdown.value = results.length > 0
  } catch (err) {
    console.error('Error searching airfoils:', err)
    airfoilSearchResults.value = []
    showDropdown.value = false
  } finally {
    isSearching.value = false
  }
}, 300)

watch(airfoilSearchQuery, (newQuery) => {
  if (selectedAirfoil.value && newQuery !== selectedAirfoil.value.name) {
    selectedAirfoil.value = null
  }
  debouncedAirfoilSearch(newQuery)
})

const selectAirfoil = (airfoil: Airfoil) => {
  selectedAirfoil.value = airfoil
  airfoilSearchQuery.value = airfoil.name
  showDropdown.value = false
}

const clearAirfoilSelection = () => {
  selectedAirfoil.value = null
  airfoilSearchQuery.value = ''
  airfoilSearchResults.value = []
  showDropdown.value = false
}

const handleFitToAirfoil = async () => {
  if (!selectedAirfoil.value) return

  isFitting.value = true
  try {
    const geometry = await fetchAirfoilGeometry(selectedAirfoil.value.id)
    if (!geometry || !geometry.upper_x_coordinates || !geometry.upper_y_coordinates || !geometry.lower_x_coordinates || !geometry.lower_y_coordinates) {
      console.error('Missing coordinate data for airfoil')
      return
    }

    // Weights are fitted (and shown) in the standard CST frame: true LE at the origin, unit chord along x
    const { params } = fitCSTNormalised(
      geometry.upper_x_coordinates,
      geometry.upper_y_coordinates,
      geometry.lower_x_coordinates,
      geometry.lower_y_coordinates,
      props.parameters.order + 1,
    )
    emit('update:parameters', params)
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
    emit('update-order', newOrder)
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

const handleLEWeightChange = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return

  const newParams = { ...props.parameters, leWeight: numValue }
  emit('update:parameters', newParams)
}

const handleTEThicknessChange = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return

  const newParams = { ...props.parameters, teThickness: numValue }
  emit('update:parameters', newParams)
}

</script>

<template>
  <div class="space-y-6">
    <!-- Fit to Airfoil -->
    <VPanel title="Fit to airfoil" description="Fit the weights to an existing airfoil from the catalog.">
      <label for="cst-fit-search" class="sr-only">Airfoil to fit</label>
      <div class="flex items-center gap-2">
        <div class="relative min-w-0 flex-1">
          <input
            id="cst-fit-search"
            v-model="airfoilSearchQuery"
            type="text"
            autocomplete="off"
            placeholder="Search airfoil name..."
            class="block h-9 w-full rounded-lg border border-gray-300 bg-white pl-3 pr-9 text-sm text-gray-900 placeholder:text-gray-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            @focus="showDropdown = airfoilSearchResults.length > 0"
            @blur="showDropdown = false"
          >
          <div class="absolute inset-y-0 right-0 flex items-center pr-2">
            <Icon v-if="isSearching" name="heroicons:arrow-path" class="h-4 w-4 animate-spin text-gray-400" aria-hidden="true" />
            <button
              v-else-if="selectedAirfoil || airfoilSearchQuery"
              type="button"
              class="rounded text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Clear airfoil search"
              @click="clearAirfoilSelection"
            >
              <Icon name="heroicons:x-mark-20-solid" class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <!-- Dropdown Results -->
          <Transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="showDropdown && airfoilSearchResults.length > 0"
              class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
            >
              <ul class="py-1">
                <li
                  v-for="airfoil in airfoilSearchResults"
                  :key="airfoil.id"
                  class="cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-primary-50"
                  @mousedown.prevent="selectAirfoil(airfoil)"
                >
                  <div class="font-medium text-gray-900">{{ airfoil.name }}</div>
                  <div v-if="airfoil.thickness_pct" class="text-xs text-gray-500">
                    Thickness: <span class="num">{{ (airfoil.thickness_pct * 100).toFixed(1) }}%</span>
                    <span v-if="airfoil.camber_pct" class="ml-2">Camber: <span class="num">{{ (airfoil.camber_pct * 100).toFixed(1) }}%</span></span>
                  </div>
                </li>
              </ul>
            </div>
          </Transition>
        </div>
        <VButton
          type="button"
          color="light"
          :disabled="!selectedAirfoil || isFitting"
          @click="handleFitToAirfoil"
        >
          <Icon :name="isFitting ? 'heroicons:arrow-path' : 'heroicons:sparkles'"  class="h-4 w-4" :class="{ 'animate-spin': isFitting }" aria-hidden="true" />
          <span class="whitespace-nowrap">{{ isFitting ? 'Fitting...' : 'Fit' }}</span>
        </VButton>
      </div>
    </VPanel>

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
        <div class="grid grid-cols-[2rem_1fr_7rem] items-center gap-2">
          <label for="cst-le" class="text-xs text-gray-500" title="LE modification weight">LE</label>
          <input
            type="range"
            min="-2.0"
            max="2.0"
            step="0.001"
            :value="parameters.leWeight"
            aria-label="LE mod weight"
            class="w-full cursor-pointer accent-primary-600"
            @input="handleLEWeightChange(($event.target as HTMLInputElement).value)"
          >
          <input
            id="cst-le"
            type="number"
            step="0.0001"
            :value="parameters.leWeight"
            class="num h-8 w-full rounded-lg border border-gray-300 px-2 text-right text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            @input="handleLEWeightChange(($event.target as HTMLInputElement).value)"
          >
        </div>
        <div class="grid grid-cols-[2rem_1fr_7rem] items-center gap-2">
          <label for="cst-te" class="text-xs text-gray-500" title="TE thickness (Δζ)">TE</label>
          <input
            type="range"
            min="0"
            max="0.02"
            step="0.0001"
            :value="parameters.teThickness"
            aria-label="TE thickness (Δζ)"
            class="w-full cursor-pointer accent-primary-600"
            @input="handleTEThicknessChange(($event.target as HTMLInputElement).value)"
          >
          <input
            id="cst-te"
            type="number"
            step="0.0001"
            :value="parameters.teThickness"
            class="num h-8 w-full rounded-lg border border-gray-300 px-2 text-right text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            @input="handleTEThicknessChange(($event.target as HTMLInputElement).value)"
          >
        </div>
        <p class="pt-1 text-xs text-gray-500">LE = leading-edge mod weight · TE = trailing-edge thickness (Δζ)</p>
      </div>
    </VPanel>
  </div>
</template>
