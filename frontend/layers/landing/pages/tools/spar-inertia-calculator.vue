<script setup lang="ts">
import type { SparInputs, AirfoilDataPoint, SparCalculationResult } from '~/types/spar.types'
import type { Database } from '~/types/database.types'
import { generateNACA0012, processAirfoilCoordinates, calculateSparProperties } from '~/composables/useSparCalculator'
import Collapsible from '~/layers/ui/components/Collapsible/Collapsible.vue'

definePageMeta({
  layout: 'detail',
})

// SEO
useSeoMeta({
  title: 'Spar Moment of Inertia Calculator - Wing Structural Analysis',
  description: 'Calculate moment of inertia for wing spar cross-sections. Select airfoils, input spar geometry, and visualize structural properties for aircraft design.',
  ogTitle: 'Spar Moment of Inertia Calculator - Wing Structural Analysis',
  ogDescription: 'Calculate moment of inertia for wing spar cross-sections with airfoil visualization.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

type Airfoil = Database['public']['Tables']['airfoils']['Row']

// Default parameters matching React reference
const defaultInputs: SparInputs = {
  chordLength: 1000,      // mm
  skinThickness: 5,       // mm
  skinOffset: 0,          // mm
  sparLocation: 0.3,      // 30% chord
  sparWidth: 50,          // mm
  sparWallThickness: 5,   // mm
  crossSection: 'hollow-rectangle',
  unitSystem: 'mm'
}

const inputs = ref<SparInputs>({ ...defaultInputs })
const selectedAirfoil = ref<Airfoil | null>(null)
const airfoilData = ref<AirfoilDataPoint[]>([])
const isLoading = ref(false)
const infoExpanded = ref(false)

const { fetchAirfoil } = useAirfoils()

// Generate default NACA 0012 on mount
onMounted(() => {
  airfoilData.value = generateNACA0012(inputs.value.chordLength, inputs.value.skinThickness)
})

// Watch for airfoil selection changes
watch(selectedAirfoil, async (newAirfoil) => {
  if (!newAirfoil) {
    // Use default NACA 0012
    airfoilData.value = generateNACA0012(inputs.value.chordLength, inputs.value.skinThickness)
    return
  }

  isLoading.value = true
  try {
    const fullAirfoil = await fetchAirfoil(newAirfoil.id)
    if (fullAirfoil && fullAirfoil.upper_x_coordinates && fullAirfoil.upper_y_coordinates &&
        fullAirfoil.lower_x_coordinates && fullAirfoil.lower_y_coordinates) {
      airfoilData.value = processAirfoilCoordinates(
        fullAirfoil.upper_x_coordinates,
        fullAirfoil.upper_y_coordinates,
        fullAirfoil.lower_x_coordinates,
        fullAirfoil.lower_y_coordinates,
        inputs.value.chordLength,
        inputs.value.skinThickness
      )
    } else {
      // Fallback to default if data incomplete
      airfoilData.value = generateNACA0012(inputs.value.chordLength, inputs.value.skinThickness)
    }
  } catch (error) {
    console.error('Error loading airfoil:', error)
    // Fallback to default on error
    airfoilData.value = generateNACA0012(inputs.value.chordLength, inputs.value.skinThickness)
  } finally {
    isLoading.value = false
  }
}, { immediate: false })

// Watch for input changes that affect airfoil processing
watch([() => inputs.value.chordLength, () => inputs.value.skinThickness], () => {
  if (selectedAirfoil.value) {
    // Reload selected airfoil with new parameters
    const currentAirfoil = selectedAirfoil.value
    selectedAirfoil.value = null
    nextTick(() => {
      selectedAirfoil.value = currentAirfoil
    })
  } else {
    // Regenerate default
    airfoilData.value = generateNACA0012(inputs.value.chordLength, inputs.value.skinThickness)
  }
})

// Calculate spar properties
const result = computed<SparCalculationResult>(() => {
  if (airfoilData.value.length === 0) {
    return {
      sparHeight: 0,
      outerMomentOfInertia: 0,
      innerMomentOfInertia: 0,
      netMomentOfInertia: 0,
      area: 0,
      valid: false,
      error: 'No airfoil data available'
    }
  }
  return calculateSparProperties(inputs.value, airfoilData.value)
})
</script>

<template>
  <div>
    <PageHeader
      title="Spar Moment of Inertia Calculator"
      subtitle="Tool for sizing, estimating structural inertia, and fit-checking your spar design"
      eyebrow="Tools"
    >
      <template #actions>
        <VButton color="light" size="sm" @click="inputs = { ...defaultInputs }">
          <Icon name="heroicons:arrow-uturn-left" class="h-4 w-4" aria-hidden="true" />
          Reset
        </VButton>
      </template>
    </PageHeader>

    <!-- Info Section -->
    <div class="mb-6">
      <Collapsible
        v-model="infoExpanded"
        title="About this calculator"
        :classes="{
          button: 'rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 hover:bg-primary-100 transition-colors',
          title: 'flex items-center gap-2',
          panel: 'mt-2 rounded-lg border border-primary-100 bg-primary-50 p-4 text-gray-700',
        }"
      >
        <p class="mb-4 leading-relaxed">
          The Spar Moment of Inertia Calculator helps you design wing spars by calculating the structural properties of different spar cross-sections positioned within an airfoil. The calculator supports hollow rectangular tubes, I-beams, and C-channels. It determines the spar height based on the airfoil thickness at the selected chord location (minus skin thickness), then computes the moment of inertia (Ix) using the appropriate formula for each cross-section type.
        </p>
        <p class="mb-4 leading-relaxed">
          The moment of inertia is a critical parameter for structural analysis, determining how the spar resists bending loads. Higher moment of inertia values indicate greater resistance to bending, which is essential for wing structural design.
        </p>
        <div class="border-t border-primary-100 pt-4">
          <p class="mb-2 font-semibold text-gray-900">
            Cross-Section Types:
          </p>
          <ul class="mb-3 list-inside list-disc space-y-1">
            <li><strong>Hollow Rectangle:</strong> Ix = (BH³ - bh³) / 12</li>
            <li><strong>I-Beam:</strong> Parallel axis theorem applied to flanges and web</li>
            <li><strong>C-Channel:</strong> Open channel section with centroidal axis calculation</li>
          </ul>
          <p class="mb-2 font-semibold text-gray-900">
            Key Assumptions:
          </p>
          <ul class="list-inside list-disc space-y-1">
            <li>Spar height is constrained by airfoil thickness minus skin thickness</li>
            <li>Skin thickness is uniform and creates inner boundary for spar</li>
            <li>Wall/flange thickness is uniform throughout the cross-section</li>
            <li>All dimensions are in millimeters</li>
          </ul>
        </div>
      </Collapsible>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Inputs -->
      <div class="min-w-0 space-y-6">
        <VPanel title="Airfoil" description="Defaults to NACA 0012 when empty">
          <SparAirfoilSelector v-model="selectedAirfoil" />
        </VPanel>

        <SparInputPanel v-model="inputs" />

        <SparStressCalculator :result="result" :unit-system="inputs.unitSystem" />
      </div>

      <!-- Visualization and results -->
      <div class="min-w-0 space-y-6 lg:col-span-2">
        <VPanel title="Cross section">
          <div class="h-[320px] sm:h-[400px]">
            <SparVisualizer
              v-if="!isLoading"
              :data="airfoilData"
              :inputs="inputs"
              :result="result"
            />
            <VStateBlock v-else variant="loading" title="Loading airfoil data" class="h-full" />
          </div>
        </VPanel>

        <SparResults
          :result="result"
          :spar-location="inputs.sparLocation"
          :cross-section="inputs.crossSection"
          :unit-system="inputs.unitSystem"
        />
      </div>
    </div>
  </div>
</template>
