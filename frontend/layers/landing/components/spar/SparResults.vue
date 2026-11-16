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
  <VPanel title="Results" :description="result.valid ? `Moment of inertia (Ix), ${crossSectionName}` : undefined">
    <VStateBlock
      v-if="!result.valid && result.error"
      variant="error"
      title="Cannot size spar"
      :description="result.error"
    />

    <dl v-else-if="result.valid" class="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <VStat
        label="Ix (net)"
        :value="result.netMomentOfInertia.toExponential(3)"
        :unit="inertiaUnit"
        :hint="crossSectionName"
      />
      <template v-if="showInnerI">
        <VStat label="Outer I" :value="result.outerMomentOfInertia.toExponential(2)" :unit="inertiaUnit" />
        <VStat label="Inner I (hollow)" :value="result.innerMomentOfInertia.toExponential(2)" :unit="inertiaUnit" />
      </template>
      <VStat
        v-else
        label="I about centroidal axis"
        :value="result.outerMomentOfInertia.toExponential(2)"
        :unit="inertiaUnit"
      />
      <VStat
        label="Spar height"
        :value="result.sparHeight.toFixed(lengthDecimals)"
        :unit="lengthUnit"
        :hint="`Limited by airfoil thickness at ${(sparLocation * 100).toFixed(0)}% chord`"
      />
      <VStat
        label="Cross-section area"
        :value="result.area.toFixed(areaDecimals)"
        :unit="areaUnit"
        hint="Net area of spar material"
      />
    </dl>

    <VStateBlock
      v-else
      icon="heroicons:calculator"
      title="Enter parameters to calculate spar properties"
    />
  </VPanel>
</template>
