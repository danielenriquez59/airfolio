<script setup lang="ts">
import type { NACA4Params, NACA5Params } from '~/composables/useNACAGenerator'
import Collapsible from '~/layers/ui/components/Collapsible/Collapsible.vue'

interface Props {
  seriesType: '4-digit' | '5-digit'
  naca4Params: NACA4Params
  naca5Params: NACA5Params
  nacaName: string
}

interface Emits {
  (e: 'update:seriesType', type: '4-digit' | '5-digit'): void
  (e: 'update:naca4Params', params: NACA4Params): void
  (e: 'update:naca5Params', params: NACA5Params): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const camberExpanded = ref(true)
const thicknessExpanded = ref(true)

// 4-Digit handlers
const handleNACA4Change = (key: keyof NACA4Params, value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return
  const newParams = { ...props.naca4Params, [key]: numValue }
  emit('update:naca4Params', newParams)
}

// 5-Digit handlers
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
  <div class="w-full">
    <!-- 4-Digit Parameters -->
    <div v-if="seriesType === '4-digit'" class="grid grid-cols-2 gap-4">
      <!-- Max Camber -->
      <div class="border border-blue-200 rounded-lg overflow-hidden">
        <Collapsible
          v-model="camberExpanded"
          :title="`Max Camber (M) - ${(naca4Params.m * 100).toFixed(1)}%`"
          :classes="{
            button: 'w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors',
            title: 'flex items-center gap-2 font-semibold text-slate-800',
            panel: 'p-4 bg-blue-50/50'
          }"
        >
          <template #title>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Max Camber (M)</span>
              <span class="text-sm font-mono text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                {{ (naca4Params.m * 100).toFixed(1) }}%
              </span>
            </div>
          </template>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <label class="text-xs text-blue-600 font-medium w-20">Value:</label>
              <input
                type="number"
                :value="naca4Params.m"
                min="0"
                max="0.095"
                step="0.001"
                class="flex-1 px-3 py-2 bg-white border border-blue-200 rounded text-right font-mono text-sm focus:outline-none focus:border-blue-400"
                @change="handleNACA4Change('m', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <input
              type="range"
              min="0"
              max="0.095"
              step="0.001"
              :value="naca4Params.m"
              class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-blue-200 accent-blue-600"
              @input="handleNACA4Change('m', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <p class="text-xs text-gray-500">Range: 0% to 9.5%</p>
          </div>
        </Collapsible>
      </div>

      <!-- Camber Position -->
      <div class="border border-blue-200 rounded-lg overflow-hidden">
        <Collapsible
          v-model="camberExpanded"
          :title="`Camber Position (P) - ${(naca4Params.p * 100).toFixed(1)}% chord`"
          :classes="{
            button: 'w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors',
            title: 'flex items-center gap-2 font-semibold text-slate-800',
            panel: 'p-4 bg-blue-50/50'
          }"
        >
          <template #title>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Camber Position (P)</span>
              <span class="text-sm font-mono text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                {{ (naca4Params.p * 10).toFixed(1) }} / 10 chord
              </span>
            </div>
          </template>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <label class="text-xs text-blue-600 font-medium w-20">Value:</label>
              <input
                type="number"
                :value="naca4Params.p"
                min="0.1"
                max="0.9"
                step="0.1"
                class="flex-1 px-3 py-2 bg-white border border-blue-200 rounded text-right font-mono text-sm focus:outline-none focus:border-blue-400"
                @change="handleNACA4Change('p', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.1"
              :value="naca4Params.p"
              class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-blue-200 accent-blue-600"
              @input="handleNACA4Change('p', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <p class="text-xs text-gray-500">Increments of 10% chord</p>
          </div>
        </Collapsible>
      </div>

      <!-- Thickness -->
      <div class="col-span-2 border border-blue-200 rounded-lg overflow-hidden">
        <Collapsible
          v-model="thicknessExpanded"
          :title="`Thickness - ${(naca4Params.t * 100).toFixed(1)}%`"
          :classes="{
            button: 'w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors',
            title: 'flex items-center gap-2 font-semibold text-slate-800',
            panel: 'p-4 bg-blue-50/50'
          }"
        >
          <template #title>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Thickness</span>
              <span class="text-sm font-mono text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                {{ (naca4Params.t * 100).toFixed(1) }}%
              </span>
            </div>
          </template>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <label class="text-xs text-blue-600 font-medium w-20">Value:</label>
              <input
                type="number"
                :value="naca4Params.t"
                min="0.01"
                max="0.40"
                step="0.01"
                class="flex-1 px-3 py-2 bg-white border border-blue-200 rounded text-right font-mono text-sm focus:outline-none focus:border-blue-400"
                @change="handleNACA4Change('t', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <input
              type="range"
              min="0.01"
              max="0.40"
              step="0.01"
              :value="naca4Params.t"
              class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-blue-200 accent-blue-600"
              @input="handleNACA4Change('t', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <p class="text-xs text-gray-500">Range: 1% to 40%</p>
          </div>
        </Collapsible>
      </div>
    </div>

    <!-- 5-Digit Parameters -->
    <div v-else class="grid grid-cols-2 gap-4">
      <!-- Design Cl -->
      <div class="border border-green-200 rounded-lg overflow-hidden">
        <Collapsible
          v-model="camberExpanded"
          :title="`Design Lift Coefficient (Cl) - ${naca5Params.cl.toFixed(2)}`"
          :classes="{
            button: 'w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 transition-colors',
            title: 'flex items-center gap-2 font-semibold text-slate-800',
            panel: 'p-4 bg-green-50/50'
          }"
        >
          <template #title>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Design Lift Coeff (Cl)</span>
              <span class="text-sm font-mono text-green-600 bg-green-100 px-2 py-0.5 rounded">
                {{ naca5Params.cl.toFixed(2) }}
              </span>
            </div>
          </template>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <label class="text-xs text-green-600 font-medium w-20">Value:</label>
              <input
                type="number"
                :value="naca5Params.cl"
                min="0"
                max="1.5"
                step="0.15"
                class="flex-1 px-3 py-2 bg-white border border-green-200 rounded text-right font-mono text-sm focus:outline-none focus:border-green-400"
                @change="handleNACA5Change('cl', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.15"
              :value="naca5Params.cl"
              class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-green-200 accent-green-600"
              @input="handleNACA5Change('cl', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <p class="text-xs text-gray-500">Ideal Design Lift Coefficient</p>
          </div>
        </Collapsible>
      </div>

      <!-- Camber Position -->
      <div class="border border-green-200 rounded-lg overflow-hidden">
        <Collapsible
          v-model="camberExpanded"
          :title="`Camber Position (P) - ${(naca5Params.p * 100).toFixed(0)}% chord`"
          :classes="{
            button: 'w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 transition-colors',
            title: 'flex items-center gap-2 font-semibold text-slate-800',
            panel: 'p-4 bg-green-50/50'
          }"
        >
          <template #title>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Camber Position (P)</span>
              <span class="text-sm font-mono text-green-600 bg-green-100 px-2 py-0.5 rounded">
                {{ (naca5Params.p * 100).toFixed(0) }}% chord
              </span>
            </div>
          </template>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <label class="text-xs text-green-600 font-medium w-20">Value:</label>
              <input
                type="number"
                :value="naca5Params.p"
                min="0.05"
                max="0.25"
                step="0.05"
                class="flex-1 px-3 py-2 bg-white border border-green-200 rounded text-right font-mono text-sm focus:outline-none focus:border-green-400"
                @change="handleNACA5Change('p', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <input
              type="range"
              min="0.05"
              max="0.25"
              step="0.05"
              :value="naca5Params.p"
              class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-green-200 accent-green-600"
              @input="handleNACA5Change('p', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <p class="text-xs text-gray-500">Standard positions: 5%, 10%, 15%, 20%, 25%</p>
          </div>
        </Collapsible>
      </div>

      <!-- Thickness -->
      <div class="col-span-2 border border-green-200 rounded-lg overflow-hidden">
        <Collapsible
          v-model="thicknessExpanded"
          :title="`Thickness (XX) - ${(naca5Params.t * 100).toFixed(1)}%`"
          :classes="{
            button: 'w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 transition-colors',
            title: 'flex items-center gap-2 font-semibold text-slate-800',
            panel: 'p-4 bg-green-50/50'
          }"
        >
          <template #title>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Thickness (XX)</span>
              <span class="text-sm font-mono text-green-600 bg-green-100 px-2 py-0.5 rounded">
                {{ (naca5Params.t * 100).toFixed(1) }}%
              </span>
            </div>
          </template>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <label class="text-xs text-green-600 font-medium w-20">Value:</label>
              <input
                type="number"
                :value="naca5Params.t"
                min="0.01"
                max="0.40"
                step="0.01"
                class="flex-1 px-3 py-2 bg-white border border-green-200 rounded text-right font-mono text-sm focus:outline-none focus:border-green-400"
                @change="handleNACA5Change('t', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <input
              type="range"
              min="0.01"
              max="0.40"
              step="0.01"
              :value="naca5Params.t"
              class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-green-200 accent-green-600"
              @input="handleNACA5Change('t', parseFloat(($event.target as HTMLInputElement).value))"
            />
            <p class="text-xs text-gray-500">Range: 1% to 40%</p>
          </div>
        </Collapsible>
      </div>
    </div>
  </div>
</template>

