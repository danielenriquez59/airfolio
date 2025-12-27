<script setup lang="ts">
import type { WingParameters } from '~/types/schrenk.types'
import { useSchrenkCalculator, type LiftDistributionType } from '~/composables/useSchrenkCalculator'
import Collapsible from '~/layers/ui/components/Collapsible/Collapsible.vue'

definePageMeta({
  layout: 'detail',
})

// SEO
useSeoMeta({
  title: 'Schrenk Lift Distribution Calculator - Engineering Design Tool',
  description: 'Calculate Schrenk lift distribution, shear forces, and bending moments for aircraft wing design. Engineering design tool for aerodynamic and structural analysis.',
  ogTitle: 'Schrenk Lift Distribution Calculator - Engineering Design Tool',
  ogDescription: 'Calculate Schrenk lift distribution, shear forces, and bending moments for aircraft wing design.',
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
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <PageHeader
      title="Schrenk Lift Distribution"
      subtitle="Structural loading calculator"
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
          The Schrenk lift calculator predicts how lift is distributed across a tapered wing by averaging the actual chord distribution with an ideal elliptical lift distribution. It calculates shear forces and bending moments at multiple spanwise stations to determine structural loads for aircraft design. It can account for a single point mass along the span. These load values help size wing spars and skins to handle both aerodynamic forces and wing weight inertia during high-g maneuvers. Ultimate loads are calculated as 1.5 Limit loads. The Hunsaker distribution utilizes the load obtained from constraining fixed total weight, fixed max stress, and fixed wing loading. 
        </p>
        <div class="pt-4 border-t border-blue-200 space-y-2">
          <p class="text-sm font-semibold text-slate-700 mb-2">References:</p>
          <a
            href="https://mar2013.lightaircraftassociation.co.uk/2010/Engineering/Design/schrenk%20approximation.pdf"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-blue-700 hover:text-blue-800 underline flex items-center gap-2 font-medium"
          >
            <Icon name="heroicons:document-text" class="h-4 w-4" />
            Schrenk Approximation Reference
          </a>
          <a
            href="https://digitalcommons.usu.edu/mae_stures/21/"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-blue-700 hover:text-blue-800 underline flex items-center gap-2 font-medium"
          >
            <Icon name="heroicons:document-text" class="h-4 w-4" />
            Minimum Induced Drag for Tapered Wings Including Structural Constraints (Hunsaker Distribution)
          </a>
        </div>
      </Collapsible>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Left Sidebar: Inputs -->
      <div class="lg:col-span-3 space-y-6">
        <!-- Distribution Type Selector -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div class="flex items-center gap-2 mb-3 text-slate-900 font-semibold">
            <Icon name="heroicons:chart-bar" class="h-5 w-5 text-blue-600" />
            <h2>Lift Distribution</h2>
          </div>
          <div class="space-y-2">
            <label for="distribution-type" class="block text-sm font-medium text-slate-700">
              Distribution Type
            </label>
            <select
              id="distribution-type"
              v-model="distributionType"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-slate-900"
            >
              <option value="elliptic">Elliptic</option>
              <option value="hunsaker">Hunsaker</option>
            </select>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div class="flex items-center gap-2 mb-4 text-slate-900 font-semibold border-b border-slate-100 pb-2">
            <Icon name="heroicons:calculator" class="h-5 w-5 text-blue-600" />
            <h2>Parameters</h2>
          </div>

          <div class="space-y-1 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
            <SchrenkInputGroup
              label="Span"
              name="span_ft"
              v-model="params.span_ft"
              unit="ft"
              tooltip="Total wingspan from tip to tip"
            />
            <SchrenkInputGroup
              label="Wing Area"
              name="wing_area_sqft"
              v-model="params.wing_area_sqft"
              unit="sq ft"
              tooltip="Total surface area of the wing"
            />
            <SchrenkInputGroup
              label="Taper Ratio"
              name="taper_ratio"
              v-model="params.taper_ratio"
              unit="λ"
              :step="0.05"
              tooltip="Tip Chord / Root Chord"
            />
            <SchrenkInputGroup
              label="Max Weight"
              name="max_weight_lb"
              v-model="params.max_weight_lb"
              unit="lb"
              :step="10"
              tooltip="Aircraft's weight at flight condition"
            />
            <SchrenkInputGroup
              label="Load Factor"
              name="load_factor_n"
              v-model="params.load_factor_n"
              unit="g"
              tooltip="Load factor at flight condition"
            />
            <SchrenkInputGroup
              label="Tail Lift"
              name="tail_lift_lb"
              v-model="params.tail_lift_lb"
              unit="lb"
              :step="10"
              tooltip="Downward force generated by the horizontal stabilizer for manuever trim"
            />
            <SchrenkInputGroup
              label="Wing Weight (Side)"
              name="wing_weight_per_side_lb"
              v-model="params.wing_weight_per_side_lb"
              unit="lb"
              tooltip="Weight of each wing structure, used to calculate inertia loads that oppose aerodynamic forces"
            />
            <SchrenkInputGroup
              label="Point Mass Wt"
              name="pointmass_weight_lb"
              v-model="params.pointmass_weight_lb"
              unit="lb"
              tooltip="Weight of a point mass such as landing gear along the wing span"
            />
            <SchrenkInputGroup
              label="Point Mass Stn"
              name="pointmass_station_in"
              v-model="params.pointmass_station_in"
              unit="in"
              tooltip="Position where point mass is attached"
            />
            <SchrenkInputGroup
              label="Root Station"
              name="wing_root_station_in"
              v-model="params.wing_root_station_in"
              unit="in"
              tooltip="Location where the wing attaches to the fuselage"
            />
          </div>
        </div>

        <!-- Key Results Summary Box -->
        <SchrenkSummary :summary="results.summary" />
      </div>

      <!-- Right Area: Charts & Data -->
      <div class="lg:col-span-9 space-y-6">
        <!-- Charts Panel -->
        <div class="h-[600px]">
          <SchrenkCharts :data="results" />
        </div>

        <!-- Data Table Panel -->
        <SchrenkDataTable :load-data="results.loadData" />
      </div>
    </div>
  </div>
</template>

