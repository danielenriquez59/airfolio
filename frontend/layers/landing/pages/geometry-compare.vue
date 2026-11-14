<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { AirfoilListItem } from '~/composables/useAirfoils'
import { navTabButtonClasses } from '~/layers/ui/utils/buttons'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

definePageMeta({
  layout: 'default',
})

const { fetchAirfoilListItems, fetchAirfoilsByIds } = useAirfoils()

import CompareNotesTab from '~/layers/landing/components/compare/CompareNotesTab.vue'

// State
const selectedAirfoilIds = ref<string[]>([])
const activeTab = ref<'chart' | 'table' | 'notes'>('chart')
const isLoadingList = ref(false)
const isLoadingSelected = ref(false)
const error = ref<string | null>(null)

// Slim catalog for selection panel
const airfoilsList = ref<AirfoilListItem[]>([])

// Selected airfoils with full coordinate data
const selectedAirfoils = ref<Airfoil[]>([])

/** Chart canvas height in px — taller values exaggerate Y for comparison. */
const plotHeight = ref(200)
const PLOT_HEIGHT_MIN = 100
const PLOT_HEIGHT_MAX = 500

// Transform selected airfoils to geometry format for the chart
const geometries = computed(() =>
  selectedAirfoils.value.map((airfoil, idx) => ({
    name: airfoil.name,
    upperX: airfoil.upper_x_coordinates ?? [],
    upperY: airfoil.upper_y_coordinates ?? [],
    lowerX: airfoil.lower_x_coordinates ?? [],
    lowerY: airfoil.lower_y_coordinates ?? [],
    color: seriesColor(idx),
  })),
)

/** Load slim list rows for the sidebar (no coordinate arrays). */
const fetchAirfoilsList = async () => {
  isLoadingList.value = true
  error.value = null

  try {
    airfoilsList.value = await fetchAirfoilListItems()
  }
  catch (err: any) {
    console.error('Error fetching airfoils list:', err)
    error.value = err.message || 'Failed to load airfoils'
  }
  finally {
    isLoadingList.value = false
  }
}

/** Load full geometry rows for the current selection only. */
const fetchSelectedAirfoils = async () => {
  if (selectedAirfoilIds.value.length === 0) {
    selectedAirfoils.value = []
    return
  }

  isLoadingSelected.value = true
  error.value = null

  try {
    selectedAirfoils.value = await fetchAirfoilsByIds(selectedAirfoilIds.value)
  }
  catch (err: any) {
    console.error('Error fetching selected airfoils:', err)
    error.value = err.message || 'Failed to load selected airfoil geometry'
    selectedAirfoils.value = []
  }
  finally {
    isLoadingSelected.value = false
  }
}

// Watch for selection changes
watch(selectedAirfoilIds, () => {
  fetchSelectedAirfoils()
}, { deep: true })

// SEO
useHead({
  title: 'Geometry Compare - Airfolio',
  meta: [
    {
      name: 'description',
      content: 'Compare airfoil geometry profiles side by side. Select up to 10 airfoils to overlay and analyze their geometric characteristics.',
    },
  ],
})

// Fetch airfoils on mount
onMounted(() => {
  fetchAirfoilsList()
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Tools"
      title="Geometry Compare"
      subtitle="Overlay up to 10 airfoil profiles and compare their geometric properties."
    />

    <div v-if="error" class="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-3" role="alert">
      <p class="text-sm text-error-800">{{ error }}</p>
      <VButton
        type="button"
        color="light"
        size="sm"
        @click="fetchAirfoilsList"
      >
        Try again
      </VButton>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Selection Panel -->
      <div class="lg:sticky lg:top-20 lg:self-start">
        <CompareAirfoilSelectionPanel
          v-model="selectedAirfoilIds"
          :airfoils="airfoilsList"
          :max-selection="10"
          :is-loading="isLoadingList"
        />
      </div>

      <!-- Results -->
      <VPanel flush class="min-w-0 lg:col-span-2">
        <div class="flex gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-gray-200 px-2 sm:px-3" role="tablist">
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'chart'"
            :class="navTabButtonClasses(activeTab === 'chart')"
            @click="activeTab = 'chart'"
          >
            Geometry Overlay
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'table'"
            :class="navTabButtonClasses(activeTab === 'table')"
            @click="activeTab = 'table'"
          >
            Summary Table
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'notes'"
            :class="navTabButtonClasses(activeTab === 'notes')"
            @click="activeTab = 'notes'"
          >
            Notes
          </button>
        </div>

        <div class="p-4 sm:p-5">
          <CompareNotesTab v-if="activeTab === 'notes'" storage-key="notes" />

          <VStateBlock
            v-else-if="isLoadingSelected"
            variant="loading"
            title="Loading airfoil data"
          />

          <VStateBlock
            v-else-if="selectedAirfoils.length === 0"
            icon="heroicons:chart-bar"
            title="No airfoils selected"
            description="Select airfoils from the panel to compare their geometry."
          />

          <div v-else-if="activeTab === 'chart'" class="space-y-4">
            <div>
              <div class="flex flex-wrap items-center gap-3">
                <label for="plot-y-height" class="data-label whitespace-nowrap">
                  Y plot height
                </label>
                <input
                  id="plot-y-height"
                  v-model.number="plotHeight"
                  type="range"
                  :min="PLOT_HEIGHT_MIN"
                  :max="PLOT_HEIGHT_MAX"
                  step="10"
                  class="min-w-[10rem] flex-1 cursor-pointer accent-primary-600"
                >
                <span class="num w-14 text-right text-sm text-gray-600">
                  {{ plotHeight }}px
                </span>
              </div>
              <p class="mt-1 text-xs text-gray-500">
                Increase height to stretch the vertical scale and make thickness differences easier to see.
              </p>
            </div>
            <AirfoilGeometry
              :geometries="geometries"
              :show-legend="true"
              :height="plotHeight"
              :zoomable="true"
              :show-ticks="true"
              :tick-step="0.1"
            />
          </div>

          <GeometryCompareGeometrySummaryTable v-else-if="activeTab === 'table'" :airfoils="selectedAirfoils" />
        </div>
      </VPanel>
    </div>
  </div>
</template>
