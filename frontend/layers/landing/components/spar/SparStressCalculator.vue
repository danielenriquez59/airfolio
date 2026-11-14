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
  if (fos === 0) return 'text-gray-500'
  if (fos < 1) return 'text-error-600'
  if (fos < 2) return 'text-warning-700'
  return 'text-success-700'
})

const fosTone = computed(() => {
  const fos = factorOfSafety.value
  if (fos === 0)
    return 'neutral'
  if (fos < 1)
    return 'error'
  if (fos < 2)
    return 'warning'
  return 'success'
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
  <VPanel title="Stress & safety factor">
    <div class="space-y-3">
      <SchrenkInputGroup
        label="Applied Moment"
        name="appliedMoment"
        :model-value="appliedMoment"
        :unit="momentUnit"
        tooltip="Bending moment applied to the spar. Hint: Use the Schrenk lift calculator to determine the applied moment."
        @update:model-value="appliedMoment = $event"
      />
      <SchrenkInputGroup
        label="Material Yield Stress"
        name="yieldStress"
        :model-value="yieldStress"
        :unit="stressUnit"
        tooltip="Yield strength of the spar material (e.g., 250 MPa for aluminum)"
        @update:model-value="yieldStress = $event"
      />
    </div>

    <div class="mt-5 border-t border-gray-200 pt-4">
      <template v-if="result.valid && appliedMoment > 0">
        <dl class="grid grid-cols-2 gap-4">
          <VStat label="Bending stress (σ)" :value="bendingStress.toFixed(2)" :unit="stressUnit" />
          <div class="min-w-0">
            <dt class="data-label truncate">
              Factor of safety
            </dt>
            <dd class="mt-1 flex flex-wrap items-baseline gap-2">
              <span class="font-mono text-lg font-medium tabular-nums" :class="fosColor">
                {{ factorOfSafety > 0 ? factorOfSafety.toFixed(2) : 'N/A' }}
              </span>
              <VBadge :tone="fosTone">
                {{ fosStatus }}
              </VBadge>
            </dd>
          </div>
        </dl>
        <p class="num mt-3 text-xs text-gray-500">
          σ<sub>yield</sub> / σ<sub>actual</sub> = {{ yieldStress }} / {{ bendingStress.toFixed(2) }}
        </p>
      </template>

      <VStateBlock
        v-else-if="!result.valid"
        variant="error"
        title="Valid spar geometry required"
        class="!py-4"
      />
      <VStateBlock
        v-else
        icon="heroicons:calculator"
        title="Enter applied moment to calculate"
        class="!py-4"
      />
    </div>
  </VPanel>
</template>
