<script setup lang="ts">
import type { NACA4Params, NACA5Params } from '~/composables/useNACAGenerator'
import NACAExportButtons from './NACAExportButtons.vue'

interface Props {
  seriesType: '4-digit' | '5-digit'
  naca4Params: NACA4Params
  naca5Params: NACA5Params
  nacaName: string
  onExportParameters?: () => void
  onExportSelig?: () => void
  onExportLednicer?: () => void
}

interface Emits {
  (e: 'update:seriesType', type: '4-digit' | '5-digit'): void
  (e: 'update:naca4Params', params: NACA4Params): void
  (e: 'update:naca5Params', params: NACA5Params): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleNACA4Change = (key: keyof NACA4Params, value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return
  const newParams = { ...props.naca4Params, [key]: numValue }
  emit('update:naca4Params', newParams)
}

const handleNACA5Change = (key: keyof NACA5Params, value: string | number | boolean) => {
  if (typeof value === 'boolean') {
    const newParams = { ...props.naca5Params, [key]: value }
    emit('update:naca5Params', newParams)
    return
  }
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return
  const newParams = { ...props.naca5Params, [key]: numValue }
  emit('update:naca5Params', newParams)
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,640px)_minmax(280px,auto)] gap-6 items-start justify-between">
      <!-- Parameter rows -->
      <div class="space-y-4 min-w-0">
        <template v-if="seriesType === '4-digit'">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-700 w-28 shrink-0">Max Camber</span>
            <span class="text-xs text-gray-400 w-36 shrink-0 hidden sm:block">Range: 0% to 9.5%</span>
            <input
              type="range"
              min="0"
              max="0.095"
              step="0.001"
              :value="naca4Params.m"
              class="w-full max-w-80 min-w-32 h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-blue-600"
              @input="handleNACA4Change('m', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <input
              type="number"
              :value="naca4Params.m"
              min="0"
              max="0.095"
              step="0.001"
              class="w-20 shrink-0 px-2 py-1 border border-gray-300 rounded text-right font-mono text-sm focus:outline-none focus:border-blue-500"
              @change="handleNACA4Change('m', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-700 w-28 shrink-0">Camber Position</span>
            <span class="text-xs text-gray-400 w-36 shrink-0 hidden sm:block">Increments of 10% chord</span>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.1"
              :value="naca4Params.p"
              class="w-full max-w-80 min-w-32 h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-blue-600"
              @input="handleNACA4Change('p', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <input
              type="number"
              :value="naca4Params.p"
              min="0.1"
              max="0.9"
              step="0.1"
              class="w-20 shrink-0 px-2 py-1 border border-gray-300 rounded text-right font-mono text-sm focus:outline-none focus:border-blue-500"
              @change="handleNACA4Change('p', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-700 w-28 shrink-0">Thickness</span>
            <span class="text-xs text-gray-400 w-36 shrink-0 hidden sm:block">Range: 1% to 40%</span>
            <input
              type="range"
              min="0.01"
              max="0.40"
              step="0.01"
              :value="naca4Params.t"
              class="w-full max-w-80 min-w-32 h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-blue-600"
              @input="handleNACA4Change('t', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <input
              type="number"
              :value="naca4Params.t"
              min="0.01"
              max="0.40"
              step="0.01"
              class="w-20 shrink-0 px-2 py-1 border border-gray-300 rounded text-right font-mono text-sm focus:outline-none focus:border-blue-500"
              @change="handleNACA4Change('t', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </template>

        <template v-else>
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-700 w-28 shrink-0">Design Cl</span>
            <span class="text-xs text-gray-400 w-36 shrink-0 hidden sm:block">Ideal design lift coefficient</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.15"
              :value="naca5Params.cl"
              class="w-full max-w-80 min-w-32 h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-blue-600"
              @input="handleNACA5Change('cl', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <input
              type="number"
              :value="naca5Params.cl"
              min="0"
              max="1.5"
              step="0.15"
              class="w-20 shrink-0 px-2 py-1 border border-gray-300 rounded text-right font-mono text-sm focus:outline-none focus:border-blue-500"
              @change="handleNACA5Change('cl', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-700 w-28 shrink-0">Camber Position</span>
            <span class="text-xs text-gray-400 w-36 shrink-0 hidden sm:block">5%, 10%, 15%, 20%, 25%</span>
            <input
              type="range"
              min="0.05"
              max="0.25"
              step="0.05"
              :value="naca5Params.p"
              class="w-full max-w-80 min-w-32 h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-blue-600"
              @input="handleNACA5Change('p', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <input
              type="number"
              :value="naca5Params.p"
              min="0.05"
              max="0.25"
              step="0.05"
              class="w-20 shrink-0 px-2 py-1 border border-gray-300 rounded text-right font-mono text-sm focus:outline-none focus:border-blue-500"
              @change="handleNACA5Change('p', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-700 w-28 shrink-0">Thickness</span>
            <span class="text-xs text-gray-400 w-36 shrink-0 hidden sm:block">Range: 1% to 40%</span>
            <input
              type="range"
              min="0.01"
              max="0.40"
              step="0.01"
              :value="naca5Params.t"
              class="w-full max-w-80 min-w-32 h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-blue-600"
              @input="handleNACA5Change('t', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <input
              type="number"
              :value="naca5Params.t"
              min="0.01"
              max="0.40"
              step="0.01"
              class="w-20 shrink-0 px-2 py-1 border border-gray-300 rounded text-right font-mono text-sm focus:outline-none focus:border-blue-500"
              @change="handleNACA5Change('t', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </template>
      </div>

      <!-- Export buttons -->
      <NACAExportButtons
        :on-export-parameters="onExportParameters"
        :on-export-selig="onExportSelig"
        :on-export-lednicer="onExportLednicer"
      />
  </div>
</template>
