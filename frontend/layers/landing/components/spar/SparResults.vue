<script setup lang="ts">
import type { SparCalculationResult, UnitSystem } from '~/types/spar.types'
import type { SparCrossSection } from '~/types/spar.types'

interface Props {
  result: SparCalculationResult
  sparLocation: number
  crossSection: SparCrossSection
  unitSystem: UnitSystem
}

const props = defineProps<Props>()

// Determine if we should show inner I (only for hollow rectangle)
const showInnerI = computed(() => props.crossSection === 'hollow-rectangle')

// Get cross-section display name
const crossSectionName = computed(() => {
  switch (props.crossSection) {
    case 'hollow-rectangle':
      return 'Hollow Rectangle'
    case 'i-beam':
      return 'I-Beam'
    case 'c-channel':
      return 'C-Channel'
    default:
      return 'Unknown'
  }
})

// Unit labels
const lengthUnit = computed(() => props.unitSystem)
const areaUnit = computed(() => {
  switch (props.unitSystem) {
    case 'mm': return 'mm²'
    case 'in': return 'in²'
    case 'm': return 'm²'
    case 'ft': return 'ft²'
    default: return 'mm²'
  }
})
const inertiaUnit = computed(() => {
  switch (props.unitSystem) {
    case 'mm': return 'mm⁴'
    case 'in': return 'in⁴'
    case 'm': return 'm⁴'
    case 'ft': return 'ft⁴'
    default: return 'mm⁴'
  }
})

// Decimal places based on unit system
const lengthDecimals = computed(() => {
  switch (props.unitSystem) {
    case 'mm': return 2
    case 'in': return 3
    case 'm': return 4
    case 'ft': return 3
    default: return 2
  }
})
const areaDecimals = computed(() => {
  switch (props.unitSystem) {
    case 'mm': return 0
    case 'in': return 2
    case 'm': return 6
    case 'ft': return 3
    default: return 0
  }
})
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
    <div class="flex items-center gap-2 mb-4 text-slate-900 font-semibold border-b border-slate-100 pb-2">
      <Icon name="heroicons:chart-bar" class="h-5 w-5 text-blue-600" />
      <h2>Results</h2>
    </div>

    <!-- Error State -->
    <div v-if="!result.valid && result.error" class="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
      <div class="flex items-center gap-2 text-red-700">
        <Icon name="heroicons:exclamation-triangle" class="h-5 w-5" />
        <span class="text-sm font-medium">{{ result.error }}</span>
      </div>
    </div>

    <!-- Results Grid -->
    <div v-if="result.valid" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Spar Height -->
      <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
          Spar Height
        </p>
        <h3 class="text-2xl font-bold text-slate-800">
          {{ result.sparHeight.toFixed(lengthDecimals) }}
          <span class="text-sm font-normal text-slate-400 ml-1">{{ lengthUnit }}</span>
        </h3>
        <p class="text-xs text-slate-500 mt-2">
          Constrained by airfoil thickness at {{ (sparLocation * 100).toFixed(0) }}% chord
        </p>
      </div>

      <!-- Cross-Section Area -->
      <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
          Cross-Section Area
        </p>
        <h3 class="text-2xl font-bold text-slate-800">
          {{ result.area.toFixed(areaDecimals) }}
          <span class="text-sm font-normal text-slate-400 ml-1">{{ areaUnit }}</span>
        </h3>
        <p class="text-xs text-slate-500 mt-2">
          Net area of spar material
        </p>
      </div>

      <!-- Moment of Inertia (Ix) - Full Width -->
      <div class="bg-blue-50 p-4 rounded-lg border border-blue-100 md:col-span-2">
        <p class="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
          Moment of Inertia (Ix) - {{ crossSectionName }}
        </p>
        <div class="flex items-baseline gap-4 mb-4">
          <h3 class="text-4xl font-bold text-blue-900">
            {{ result.netMomentOfInertia.toExponential(3) }}
          </h3>
          <span class="text-base font-medium text-blue-500">{{ inertiaUnit }}</span>
        </div>
        
        <div v-if="showInnerI" class="grid grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <span class="block text-xs opacity-60 mb-1">Outer I</span>
            <span class="font-mono">{{ result.outerMomentOfInertia.toExponential(2) }}</span>
          </div>
          <div>
            <span class="block text-xs opacity-60 mb-1">Inner I (Hollow)</span>
            <span class="font-mono">{{ result.innerMomentOfInertia.toExponential(2) }}</span>
          </div>
        </div>
        <div v-else class="text-sm text-blue-800">
          <span class="block text-xs opacity-60 mb-1">About Centroidal Axis</span>
          <span class="font-mono">{{ result.outerMomentOfInertia.toExponential(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!result.error" class="text-center py-8 text-slate-400">
      <Icon name="heroicons:calculator" class="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p class="text-sm">Enter parameters to calculate spar properties</p>
    </div>
  </div>
</template>

