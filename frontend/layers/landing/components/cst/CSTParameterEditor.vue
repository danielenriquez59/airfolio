<script setup lang="ts">
import type { CSTParameters } from '~/composables/useCSTParameters'
import type { Database } from '~/types/database.types'
import NACAExportButtons from '~/layers/landing/components/naca/NACAExportButtons.vue'
import { useDebounceFn } from '@vueuse/core'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

interface Props {
  parameters: CSTParameters
  onExportParameters?: () => void
  onExportSelig?: () => void
  onExportLednicer?: () => void
}

interface Emits {
  (e: 'update:parameters', params: CSTParameters): void
  (e: 'update-order', order: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { searchAirfoilsByPrefix } = useAirfoilAutocomplete()
const { fetchAirfoilGeometry } = useAirfoils()
const { fitCSTParameters } = useCSTParameters()

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

    const fitted = fitCSTParameters(
      geometry.upper_x_coordinates,
      geometry.upper_y_coordinates,
      geometry.lower_x_coordinates,
      geometry.lower_y_coordinates,
      props.parameters.order
    )
    emit('update:parameters', fitted)
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
  <div class="space-y-4 w-full">
    <!-- Fit to Airfoil -->
    <div class="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
      <div class="flex items-center gap-2">
        <Icon name="heroicons:magnifying-glass-20-solid" class="w-4 h-4 text-gray-400" />
        <label class="text-sm font-medium text-gray-700">Fit to Airfoil</label>
      </div>
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <input
            v-model="airfoilSearchQuery"
            type="text"
            placeholder="Search airfoil name..."
            class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6"
            @focus="showDropdown = airfoilSearchResults.length > 0"
            @blur="window.setTimeout(() => { showDropdown = false }, 200)"
          />
          <div class="absolute inset-y-0 right-0 flex items-center pr-2">
            <Icon v-if="isSearching" name="heroicons:arrow-path" class="h-4 w-4 animate-spin text-gray-400" />
            <button
              v-else-if="selectedAirfoil || airfoilSearchQuery"
              type="button"
              class="text-gray-400 hover:text-gray-600"
              @click="clearAirfoilSelection"
            >
              <Icon name="heroicons:x-mark-20-solid" class="h-5 w-5" />
            </button>
          </div>
          <!-- Dropdown Results -->
          <Transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="showDropdown && airfoilSearchResults.length > 0"
              class="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 max-h-60 overflow-auto"
            >
              <ul class="py-1">
                <li
                  v-for="airfoil in airfoilSearchResults"
                  :key="airfoil.id"
                  class="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
                  @mousedown.prevent="selectAirfoil(airfoil)"
                >
                  <div class="font-medium">{{ airfoil.name }}</div>
                  <div v-if="airfoil.thickness_pct" class="text-xs text-gray-500">
                    Thickness: {{ (airfoil.thickness_pct * 100).toFixed(1) }}%
                    <span v-if="airfoil.camber_pct" class="ml-2">Camber: {{ (airfoil.camber_pct * 100).toFixed(1) }}%</span>
                  </div>
                </li>
              </ul>
            </div>
          </Transition>
        </div>
        <button
          type="button"
          :disabled="!selectedAirfoil || isFitting"
          class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
          @click="handleFitToAirfoil"
        >
          <div v-if="isFitting" class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          <Icon v-else name="heroicons:sparkles" class="h-4 w-4" />
          {{ isFitting ? 'Fitting...' : 'Fit to Airfoil' }}
        </button>
      </div>
    </div>

    <!-- Order Control -->
    <div class="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
      <Icon name="heroicons:cog-6-tooth-20-solid" class="w-4 h-4 text-gray-400" />
      <label class="text-sm font-medium text-gray-700">Weights Count (N+1):</label>
      <input
        v-model="inputOrder"
        type="number"
        min="3"
        max="8"
        class="w-16 px-2 py-1 border border-gray-300 rounded text-center font-mono text-sm focus:outline-none focus:border-blue-500"
        @blur="handleInputBlur"
      />
    </div>

    <!-- 2x2 Grid Layout -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Upper Weights -->
      <div class="border border-purple-200 rounded-lg overflow-hidden">
        <div class="w-full flex items-center justify-between p-4 bg-purple-50">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-purple-500"></div>
            <span class="font-semibold text-gray-800">Upper Weights</span>
            <span class="text-xs text-gray-400">{{ parameters.upperWeights.length }} weights</span>
          </div>
        </div>
        <div class="p-4 bg-purple-50/50 max-h-[300px] overflow-y-auto space-y-2">
          <div
            v-for="(weight, index) in parameters.upperWeights"
            :key="`upper-${index}`"
            class="flex items-center gap-2"
          >
            <label class="text-[10px] font-bold text-gray-400 w-10 text-right shrink-0">
              A{{ index }}
            </label>
            <input
              type="range"
              min="-0.5"
              max="1.0"
              step="0.001"
              :value="weight"
              class="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-purple-500"
              @input="handleWeightChange(index, true, ($event.target as HTMLInputElement).value)"
            />
            <input
              type="number"
              :value="weight"
              step="0.001"
              class="w-16 p-0.5 text-right text-xs border border-gray-300 rounded focus:outline-none focus:border-purple-400"
              @input="handleWeightChange(index, true, ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>

      <!-- Lower Weights -->
      <div class="border border-red-200 rounded-lg overflow-hidden">
        <div class="w-full flex items-center justify-between p-4 bg-red-50">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-red-500"></div>
            <span class="font-semibold text-gray-800">Lower Weights</span>
            <span class="text-xs text-gray-400">{{ parameters.lowerWeights.length }} weights</span>
          </div>
        </div>
        <div class="p-4 bg-red-50/50 max-h-[300px] overflow-y-auto space-y-2">
          <div
            v-for="(weight, index) in parameters.lowerWeights"
            :key="`lower-${index}`"
            class="flex items-center gap-2"
          >
            <label class="text-[10px] font-bold text-gray-400 w-10 text-right shrink-0">
              A{{ index }}
            </label>
            <input
              type="range"
              min="-1.0"
              max="0.5"
              step="0.001"
              :value="weight"
              class="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-red-500"
              @input="handleWeightChange(index, false, ($event.target as HTMLInputElement).value)"
            />
            <input
              type="number"
              :value="weight"
              step="0.001"
              class="w-16 p-0.5 text-right text-xs border border-gray-300 rounded focus:outline-none focus:border-red-400"
              @input="handleWeightChange(index, false, ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>

      <!-- LE Mod Weight & TE Thickness Combined -->
      <div class="border border-blue-200 rounded-lg overflow-hidden">
        <div class="w-full flex items-center justify-between p-4 bg-blue-50">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-blue-500"></div>
            <span class="font-semibold text-gray-800">LE Mod Weight & TE Thickness</span>
          </div>
        </div>
        <div class="p-4 bg-blue-50/50 space-y-4">
          <!-- LE Mod Weight -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-blue-600 font-medium">LE Mod Weight:</span>
              <input
                type="number"
                step="0.0001"
                :value="parameters.leWeight"
                class="w-20 px-2 py-1 bg-white border border-blue-200 rounded text-right font-mono text-sm focus:outline-none focus:border-blue-400"
                @input="handleLEWeightChange(($event.target as HTMLInputElement).value)"
              />
            </div>
            <input
              type="range"
              min="-2.0"
              max="2.0"
              step="0.001"
              :value="parameters.leWeight"
              class="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-blue-200 accent-blue-500"
              @input="handleLEWeightChange(($event.target as HTMLInputElement).value)"
            />
          </div>

          <!-- TE Thickness -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-blue-600 font-medium">TE Thickness (Δζ):</span>
              <input
                type="number"
                step="0.0001"
                :value="parameters.teThickness"
                class="w-20 px-2 py-1 bg-white border border-blue-200 rounded text-right font-mono text-sm focus:outline-none focus:border-blue-400"
                @input="handleTEThicknessChange(($event.target as HTMLInputElement).value)"
              />
            </div>
            <input
              type="range"
              min="0"
              max="0.02"
              step="0.0001"
              :value="parameters.teThickness"
              class="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-blue-200 accent-blue-500"
              @input="handleTEThicknessChange(($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>

      <!-- Export Buttons -->
      <NACAExportButtons
        :on-export-parameters="onExportParameters"
        :on-export-selig="onExportSelig"
        :on-export-lednicer="onExportLednicer"
      />
    </div>
  </div>
</template>

