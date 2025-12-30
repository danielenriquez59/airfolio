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
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <PageHeader
      title="Spar Moment of Inertia Calculator"
      subtitle="Wing structural analysis tool"
    />

    <!-- Info Section -->
    <div class="mb-6">
      <Collapsible
        v-model="infoExpanded"
        title="About this Calculator"
        :classes="{
          button: 'w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors rounded-lg border border-blue-200',
          title: 'flex items-center gap-2 font-semibold text-slate-800',
          panel: 'p-4 bg-blue-50/50 rounded-b-lg border-x border-b border-blue-200'
        }"
      >
        <p class="text-slate-700 leading-relaxed mb-4">
          The Spar Moment of Inertia Calculator helps you design wing spars by calculating the structural properties of different spar cross-sections positioned within an airfoil. The calculator supports hollow rectangular tubes, I-beams, and C-channels. It determines the spar height based on the airfoil thickness at the selected chord location (minus skin thickness), then computes the moment of inertia (Ix) using the appropriate formula for each cross-section type.
        </p>
        <p class="text-slate-700 leading-relaxed mb-4">
          The moment of inertia is a critical parameter for structural analysis, determining how the spar resists bending loads. Higher moment of inertia values indicate greater resistance to bending, which is essential for wing structural design.
        </p>
        <div class="pt-4 border-t border-blue-200">
          <p class="text-sm text-slate-600 mb-2">
            <strong>Cross-Section Types:</strong>
          </p>
          <ul class="text-sm text-slate-600 list-disc list-inside space-y-1 mb-3">
            <li><strong>Hollow Rectangle:</strong> Ix = (BH³ - bh³) / 12</li>
            <li><strong>I-Beam:</strong> Parallel axis theorem applied to flanges and web</li>
            <li><strong>C-Channel:</strong> Open channel section with centroidal axis calculation</li>
          </ul>
          <p class="text-sm text-slate-600 mb-2">
            <strong>Key Assumptions:</strong>
          </p>
          <ul class="text-sm text-slate-600 list-disc list-inside space-y-1">
            <li>Spar height is constrained by airfoil thickness minus skin thickness</li>
            <li>Skin thickness is uniform and creates inner boundary for spar</li>
            <li>Wall/flange thickness is uniform throughout the cross-section</li>
            <li>All dimensions are in millimeters</li>
          </ul>
        </div>
      </Collapsible>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Left Sidebar: Inputs -->
      <div class="lg:col-span-3 space-y-6">
        <!-- Airfoil Selection -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div class="flex items-center gap-2 mb-4 text-slate-900 font-semibold border-b border-slate-100 pb-2">
            <Icon name="heroicons:paper-airplane" class="h-5 w-5 text-blue-600" />
            <h2>Airfoil</h2>
          </div>
          <SparAirfoilSelector v-model="selectedAirfoil" />
        </div>

        <!-- Input Parameters -->
        <SparInputPanel v-model="inputs" />

        <!-- Stress Calculator -->
        <SparStressCalculator :result="result" :unit-system="inputs.unitSystem" />
      </div>

      <!-- Right Area: Visualization and Results -->
      <div class="lg:col-span-9 space-y-6">
        <div class="h-[400px]">
          <SparVisualizer
            v-if="!isLoading"
            :data="airfoilData"
            :inputs="inputs"
            :result="result"
          />
          <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex items-center justify-center h-full">
            <div class="text-center">
              <Icon name="heroicons:arrow-path" class="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
              <p class="text-slate-600">Loading airfoil data...</p>
            </div>
          </div>
        </div>

        <!-- Results -->
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

