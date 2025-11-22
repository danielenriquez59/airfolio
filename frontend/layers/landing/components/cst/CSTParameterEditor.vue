<script setup lang="ts">
import type { CSTParameters } from '~/composables/useCSTParameters'
import Collapsible from '~/layers/ui/components/Collapsible/Collapsible.vue'

interface Props {
  parameters: CSTParameters
}

interface Emits {
  (e: 'update:parameters', params: CSTParameters): void
  (e: 'update-order', order: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const upperExpanded = ref(true)
const lowerExpanded = ref(true)
const leExpanded = ref(false)
const teExpanded = ref(false)

const inputOrder = ref(String(props.parameters.order + 1))

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

const handleUpdateOrder = () => {
  const count = parseInt(inputOrder.value)
  if (isNaN(count) || count < 3 || count > 21) {
    inputOrder.value = String(props.parameters.order + 1)
    return
  }

  const newOrder = count - 1
  emit('update-order', newOrder)
}
</script>

<template>
  <div class="space-y-4 w-full">
    <!-- Order Control -->
    <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
      <Icon name="heroicons:cog-6-tooth-20-solid" class="w-4 h-4 text-slate-400" />
      <label class="text-sm font-medium text-slate-700">Weights Count (N+1):</label>
      <input
        v-model="inputOrder"
        type="number"
        min="3"
        max="21"
        class="w-16 px-2 py-1 border border-slate-300 rounded text-center font-mono text-sm focus:outline-none focus:border-blue-500"
      />
      <button
        type="button"
        class="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
        @click="handleUpdateOrder"
      >
        <Icon name="heroicons:arrow-path-20-solid" class="w-3 h-3" />
        Reset
      </button>
    </div>

    <!-- 2x2 Grid Layout -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Upper Weights -->
      <div class="border border-purple-200 rounded-lg overflow-hidden">
        <Collapsible
          v-model="upperExpanded"
          :title="`Upper Weights (${parameters.upperWeights.length} weights)`"
          :classes="{
            button: 'w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 transition-colors',
            title: 'flex items-center gap-2 font-semibold text-slate-800',
            panel: 'p-4 bg-purple-50/50 max-h-[300px] overflow-y-auto space-y-2'
          }"
        >
          <template #title>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-purple-500"></div>
              <span>Upper Weights</span>
              <span class="text-xs text-slate-400">{{ parameters.upperWeights.length }} weights</span>
            </div>
          </template>
          <div
            v-for="(weight, index) in parameters.upperWeights"
            :key="`upper-${index}`"
            class="flex items-center gap-2"
          >
            <label class="text-[10px] font-bold text-slate-400 w-10 text-right shrink-0">
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
              class="w-16 p-0.5 text-right text-xs border border-slate-300 rounded focus:outline-none focus:border-purple-400"
              @input="handleWeightChange(index, true, ($event.target as HTMLInputElement).value)"
            />
          </div>
        </Collapsible>
      </div>

      <!-- Lower Weights -->
      <div class="border border-red-200 rounded-lg overflow-hidden">
        <Collapsible
          v-model="lowerExpanded"
          :title="`Lower Weights (${parameters.lowerWeights.length} weights)`"
          :classes="{
            button: 'w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 transition-colors',
            title: 'flex items-center gap-2 font-semibold text-slate-800',
            panel: 'p-4 bg-red-50/50 max-h-[300px] overflow-y-auto space-y-2'
          }"
        >
          <template #title>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Lower Weights</span>
              <span class="text-xs text-slate-400">{{ parameters.lowerWeights.length }} weights</span>
            </div>
          </template>
          <div
            v-for="(weight, index) in parameters.lowerWeights"
            :key="`lower-${index}`"
            class="flex items-center gap-2"
          >
            <label class="text-[10px] font-bold text-slate-400 w-10 text-right shrink-0">
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
              class="w-16 p-0.5 text-right text-xs border border-slate-300 rounded focus:outline-none focus:border-red-400"
              @input="handleWeightChange(index, false, ($event.target as HTMLInputElement).value)"
            />
          </div>
        </Collapsible>
      </div>

      <!-- Leading Edge Weight -->
      <div class="border border-purple-200 rounded-lg overflow-hidden">
        <Collapsible
          v-model="leExpanded"
          title="LE Mod Weight"
          :classes="{
            button: 'w-full flex items-center justify-between p-4 bg-purple-50/50 hover:bg-purple-100 transition-colors',
            title: 'text-xs font-bold text-purple-700 uppercase tracking-wide',
            panel: 'p-4 bg-purple-50/50'
          }"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs text-purple-600">Value:</span>
            <input
              type="number"
              step="0.0001"
              :value="parameters.leWeight"
              class="w-20 px-2 py-1 bg-white border border-purple-200 rounded text-right font-mono text-sm focus:outline-none focus:border-purple-400"
              @input="handleLEWeightChange(($event.target as HTMLInputElement).value)"
            />
          </div>
          <input
            type="range"
            min="-2.0"
            max="2.0"
            step="0.001"
            :value="parameters.leWeight"
            class="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-purple-200 accent-purple-500"
            @input="handleLEWeightChange(($event.target as HTMLInputElement).value)"
          />
        </Collapsible>
      </div>

      <!-- Trailing Edge Thickness -->
      <div class="border border-red-200 rounded-lg overflow-hidden">
        <Collapsible
          v-model="teExpanded"
          title="TE Thickness (Δζ)"
          :classes="{
            button: 'w-full flex items-center justify-between p-4 bg-red-50/50 hover:bg-red-100 transition-colors',
            title: 'text-xs font-bold text-red-700 uppercase tracking-wide',
            panel: 'p-4 bg-red-50/50'
          }"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs text-red-600">Value:</span>
            <input
              type="number"
              step="0.0001"
              :value="parameters.teThickness"
              class="w-20 px-2 py-1 bg-white border border-red-200 rounded text-right font-mono text-sm focus:outline-none focus:border-red-400"
              @input="handleTEThicknessChange(($event.target as HTMLInputElement).value)"
            />
          </div>
          <input
            type="range"
            min="0"
            max="0.02"
            step="0.0001"
            :value="parameters.teThickness"
            class="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-red-200 accent-red-500"
            @input="handleTEThicknessChange(($event.target as HTMLInputElement).value)"
          />
        </Collapsible>
      </div>
    </div>
  </div>
</template>

