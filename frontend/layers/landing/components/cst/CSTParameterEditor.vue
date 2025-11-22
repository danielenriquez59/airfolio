<script setup lang="ts">
import type { CSTParameters } from '~/composables/useCSTParameters'
import NACAExportButtons from '~/layers/landing/components/naca/NACAExportButtons.vue'

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

const inputOrder = ref(String(props.parameters.order + 1))

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
            <span class="font-semibold text-slate-800">Upper Weights</span>
            <span class="text-xs text-slate-400">{{ parameters.upperWeights.length }} weights</span>
          </div>
        </div>
        <div class="p-4 bg-purple-50/50 max-h-[300px] overflow-y-auto space-y-2">
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
        </div>
      </div>

      <!-- Lower Weights -->
      <div class="border border-red-200 rounded-lg overflow-hidden">
        <div class="w-full flex items-center justify-between p-4 bg-red-50">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-red-500"></div>
            <span class="font-semibold text-slate-800">Lower Weights</span>
            <span class="text-xs text-slate-400">{{ parameters.lowerWeights.length }} weights</span>
          </div>
        </div>
        <div class="p-4 bg-red-50/50 max-h-[300px] overflow-y-auto space-y-2">
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
        </div>
      </div>

      <!-- LE Mod Weight & TE Thickness Combined -->
      <div class="border border-blue-200 rounded-lg overflow-hidden">
        <div class="w-full flex items-center justify-between p-4 bg-blue-50">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-blue-500"></div>
            <span class="font-semibold text-slate-800">LE Mod Weight & TE Thickness</span>
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

