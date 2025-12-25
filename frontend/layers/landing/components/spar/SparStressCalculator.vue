<script setup lang="ts">
import type { SparCalculationResult, UnitSystem } from '~/types/spar.types'
import SchrenkInputGroup from '~/layers/landing/components/schrenk/SchrenkInputGroup.vue'

interface Props {
  result: SparCalculationResult
  unitSystem: UnitSystem
}

const props = defineProps<Props>()

// Calculator inputs
const appliedMoment = ref<number>(0)
const yieldStress = ref<number>(250) // MPa default for aluminum

// Unit labels
const momentUnit = computed(() => {
  switch (props.unitSystem) {
    case 'mm': return 'N-mm'
    case 'in': return 'lbf-in'
    case 'm': return 'N-m'
    case 'ft': return 'lbf-ft'
    default: return 'N-mm'
  }
})
const stressUnit = computed(() => {
  switch (props.unitSystem) {
    case 'mm': return 'MPa'
    case 'in': return 'ksi'
    case 'm': return 'MPa'
    case 'ft': return 'ksi'
    default: return 'MPa'
  }
})
const momentStep = computed(() => {
  switch (props.unitSystem) {
    case 'mm': return 1000
    case 'in': return 100
    case 'm': return 100
    case 'ft': return 10
    default: return 1000
  }
})
const stressStep = computed(() => {
  switch (props.unitSystem) {
    case 'mm': return 10
    case 'in': return 1
    case 'm': return 10
    case 'ft': return 1
    default: return 10
  }
})

// Calculate bending stress: σ = M*c/I
// where c = sparHeight/2 (distance from neutral axis to outer fiber)
const bendingStress = computed(() => {
  if (!props.result.valid || props.result.netMomentOfInertia === 0 || appliedMoment.value === 0) {
    return 0
  }

  const c = props.result.sparHeight / 2 // Distance to outer fiber
  const I = props.result.netMomentOfInertia
  const M = appliedMoment.value

  // σ = M*c/I
  const stress = (M * c) / I

  // Convert to appropriate units based on unit system
  // mm: stress is in N/mm² = MPa (already correct)
  // in: stress is in lbf/in² = psi, convert to ksi
  // m: stress is in N/m² = Pa, convert to MPa
  // ft: stress is in lbf/ft² = psf, convert to ksi
  switch (props.unitSystem) {
    case 'mm': return stress // N/mm² = MPa
    case 'in': return stress / 1000 // psi to ksi
    case 'm': return stress / 1000000 // Pa to MPa
    case 'ft': return stress / 144000 // psf to ksi (144 in²/ft² * 1000)
    default: return stress
  }
})

// Calculate factor of safety: FoS = σ_yield / σ_actual
const factorOfSafety = computed(() => {
  if (bendingStress.value === 0 || yieldStress.value === 0) {
    return 0
  }

  // Yield stress is already in correct units (user inputs MPa or ksi)
  return yieldStress.value / bendingStress.value
})

const fosColor = computed(() => {
  const fos = factorOfSafety.value
  if (fos === 0) return 'text-slate-500'
  if (fos < 1) return 'text-red-600'
  if (fos < 1.5) return 'text-orange-600'
  if (fos < 2) return 'text-yellow-600'
  return 'text-green-600'
})

const fosStatus = computed(() => {
  const fos = factorOfSafety.value
  if (fos === 0) return 'N/A'
  if (fos < 1) return 'Unsafe'
  if (fos < 1.5) return 'Marginal'
  if (fos < 2) return 'Acceptable'
  return 'Safe'
})
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
    <div class="flex items-center gap-2 mb-4 text-slate-900 font-semibold border-b border-slate-100 pb-2">
      <Icon name="heroicons:beaker" class="h-5 w-5 text-blue-600" />
      <h2>Stress & Safety Factor</h2>
    </div>

    <div class="space-y-1">
      <SchrenkInputGroup
        label="Applied Moment"
        name="appliedMoment"
        :model-value="appliedMoment"
        @update:model-value="appliedMoment = $event"
        :unit="momentUnit"
        :step="momentStep"
        tooltip="Bending moment applied to the spar. Hint: Use the Schrenk lift calculator to determine the applied moment."
      />
      
      <SchrenkInputGroup
        label="Material Yield Stress"
        name="yieldStress"
        :model-value="yieldStress"
        @update:model-value="yieldStress = $event"
        :unit="stressUnit"
        :step="stressStep"
        tooltip="Yield strength of the spar material (e.g., 250 MPa for aluminum)"
      />

      <!-- Results -->
      <div v-if="result.valid && appliedMoment > 0" class="mt-4 pt-4 border-t border-slate-100">
        <!-- Bending Stress -->
        <div class="mb-3 p-3 bg-slate-50 rounded-lg">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Bending Stress (σ)
          </p>
          <p class="text-lg font-bold text-slate-800">
            {{ bendingStress.toFixed(2) }}
            <span class="text-sm font-normal text-slate-400 ml-1">{{ stressUnit }}</span>
          </p>
        </div>

        <!-- Factor of Safety -->
        <div class="p-3 bg-blue-50 rounded-lg">
          <p class="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            Factor of Safety
          </p>
          <div class="flex items-baseline gap-3">
            <p class="text-2xl font-bold" :class="fosColor">
              {{ factorOfSafety > 0 ? factorOfSafety.toFixed(2) : 'N/A' }}
            </p>
            <span class="text-sm font-medium" :class="fosColor">
              {{ fosStatus }}
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-2">
            σ<sub>yield</sub> / σ<sub>actual</sub> = {{ yieldStress }} / {{ bendingStress.toFixed(2) }}
          </p>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!result.valid" class="mt-4 pt-4 border-t border-slate-100 text-center py-4 text-slate-400">
        <Icon name="heroicons:exclamation-triangle" class="h-8 w-8 mx-auto mb-1 opacity-50" />
        <p class="text-xs">Valid spar geometry required</p>
      </div>

      <div v-else class="mt-4 pt-4 border-t border-slate-100 text-center py-4 text-slate-400">
        <Icon name="heroicons:calculator" class="h-8 w-8 mx-auto mb-1 opacity-50" />
        <p class="text-xs">Enter applied moment to calculate</p>
      </div>
    </div>
  </div>
</template>

