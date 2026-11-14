<script setup lang="ts">
import type { WingParameters } from '~/types/schrenk.types'
import { useSchrenkCalculator, type LiftDistributionType } from '~/composables/useSchrenkCalculator'
import Collapsible from '~/layers/ui/components/Collapsible/Collapsible.vue'
import { tabButtonClasses } from '~/layers/ui/utils/buttons'

definePageMeta({
  layout: 'detail',
})

// SEO
useSeoMeta({
  title: 'Structural Loading Calculator - Engineering Design Tool',
  description: 'Calculate the root shear and moment given a lift distribution. Engineering design tool for aerodynamic and structural analysis.',
  ogTitle: 'Structural Loading Calculator - Engineering Design Tool',
  ogDescription: 'Calculate the root shear and moment given a lift distribution.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

// Default parameters from the design example
const defaultParams: WingParameters = {
  span_ft: 19.0,
  wing_area_sqft: 66.5,
  taper_ratio: 0.4,
  max_weight_lb: 850.0,
  load_factor_n: 6.0,
  tail_lift_lb: -250.0,
  wing_weight_per_side_lb: 74.0,
  pointmass_weight_lb: 25.0,
  pointmass_station_in: 30.0,
  wing_root_station_in: 15.0,
}

const params = ref<WingParameters>({ ...defaultParams })
const distributionType = ref<LiftDistributionType>('elliptic')
const { calculateWingData } = useSchrenkCalculator()

const results = computed(() => calculateWingData(params.value, distributionType.value))
const infoExpanded = ref(false)

const distributionOptions: { value: LiftDistributionType; label: string }[] = [
  { value: 'elliptic', label: 'Elliptic' },
  { value: 'hunsaker', label: 'Hunsaker' },
]

function resetParams() {
  params.value = { ...defaultParams }
  distributionType.value = 'elliptic'
}
</script>

<template>
  <div>
    <PageHeader
      title="Structural Loading Calculator"
      subtitle="Calculate the root shear and moment given a lift distribution"
      eyebrow="Tools"
    >
      <template #actions>
        <VButton color="light" size="sm" @click="resetParams">
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
          The Schrenk lift calculator predicts how lift is distributed across a tapered wing by averaging the actual chord distribution with an ideal elliptical lift distribution. It calculates shear forces and bending moments at multiple spanwise stations to determine structural loads for aircraft design. It can account for a single point mass along the span. These load values help size wing spars and skins to handle both aerodynamic forces and wing weight inertia during high-g maneuvers. Ultimate loads are calculated as 1.5 Limit loads. The Hunsaker distribution utilizes the load obtained from constraining fixed total weight, fixed max stress, and fixed wing loading.
        </p>
        <div class="space-y-2 border-t border-primary-100 pt-4">
          <p class="mb-2 font-semibold text-gray-900">
            References:
          </p>
          <a
            href="https://mar2013.lightaircraftassociation.co.uk/2010/Engineering/Design/schrenk%20approximation.pdf"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 font-medium text-primary-700 underline hover:text-primary-800"
          >
            <Icon name="heroicons:document-text" class="h-4 w-4 shrink-0" aria-hidden="true" />
            Schrenk Approximation Reference
          </a>
          <a
            href="https://digitalcommons.usu.edu/mae_stures/21/"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 font-medium text-primary-700 underline hover:text-primary-800"
          >
            <Icon name="heroicons:document-text" class="h-4 w-4 shrink-0" aria-hidden="true" />
            Minimum Induced Drag for Tapered Wings Including Structural Constraints (Hunsaker Distribution)
          </a>
        </div>
      </Collapsible>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Inputs -->
      <div class="min-w-0 space-y-6">
        <VPanel title="Lift distribution">
          <div class="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Distribution type">
            <button
              v-for="opt in distributionOptions"
              :key="opt.value"
              type="button"
              :class="tabButtonClasses(distributionType === opt.value)"
              :aria-pressed="distributionType === opt.value"
              @click="distributionType = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </VPanel>

        <VPanel title="Wing parameters">
          <div class="space-y-3">
            <SchrenkInputGroup
              v-model="params.span_ft"
              label="Span"
              name="span_ft"
              unit="ft"
              tooltip="Total wingspan from tip to tip"
            />
            <SchrenkInputGroup
              v-model="params.wing_area_sqft"
              label="Wing Area"
              name="wing_area_sqft"
              unit="sq ft"
              tooltip="Total surface area of the wing"
            />
            <SchrenkInputGroup
              v-model="params.taper_ratio"
              label="Taper Ratio"
              name="taper_ratio"
              unit="λ"
              tooltip="Tip Chord / Root Chord"
            />
            <SchrenkInputGroup
              v-model="params.max_weight_lb"
              label="Max Weight"
              name="max_weight_lb"
              unit="lb"
              tooltip="Aircraft's weight at flight condition"
            />
            <SchrenkInputGroup
              v-model="params.load_factor_n"
              label="Load Factor"
              name="load_factor_n"
              unit="g"
              tooltip="Load factor at flight condition"
            />
            <SchrenkInputGroup
              v-model="params.tail_lift_lb"
              label="Tail Lift"
              name="tail_lift_lb"
              unit="lb"
              tooltip="Downward force generated by the horizontal stabilizer for manuever trim"
            />
          </div>
          <h3 class="mb-3 mt-5 border-t border-gray-200 pt-4 text-sm font-semibold text-gray-900">
            Mass and stations
          </h3>
          <div class="space-y-3">
            <SchrenkInputGroup
              v-model="params.wing_weight_per_side_lb"
              label="Wing Weight (Side)"
              name="wing_weight_per_side_lb"
              unit="lb"
              tooltip="Weight of each wing structure, used to calculate inertia loads that oppose aerodynamic forces"
            />
            <SchrenkInputGroup
              v-model="params.pointmass_weight_lb"
              label="Point Mass Wt"
              name="pointmass_weight_lb"
              unit="lb"
              tooltip="Weight of a point mass such as landing gear along the wing span"
            />
            <SchrenkInputGroup
              v-model="params.pointmass_station_in"
              label="Point Mass Stn"
              name="pointmass_station_in"
              unit="in"
              tooltip="Position where point mass is attached"
            />
            <SchrenkInputGroup
              v-model="params.wing_root_station_in"
              label="Root Station"
              name="wing_root_station_in"
              unit="in"
              tooltip="Location where the wing attaches to the fuselage"
            />
          </div>
        </VPanel>
      </div>

      <!-- Results -->
      <div class="min-w-0 space-y-6 lg:col-span-2">
        <SchrenkSummary :summary="results.summary" />

        <div class="h-[560px]">
          <SchrenkCharts :data="results" />
        </div>

        <SchrenkDataTable :load-data="results.loadData" />
      </div>
    </div>
  </div>
</template>
