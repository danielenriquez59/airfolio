<script setup lang="ts">
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

definePageMeta({
  layout: 'default',
})

const { searchAirfoils } = useAirfoilSearch()

import CompareNotesTab from '~/layers/landing/components/compare/CompareNotesTab.vue'

// State
const selectedAirfoilIds = ref<string[]>([])
const activeTab = ref<'chart' | 'table' | 'notes'>('chart')
const isLoadingList = ref(false)
const isLoadingSelected = ref(false)
const error = ref<string | null>(null)

// All airfoils for selection panel
const airfoilsList = ref<Airfoil[]>([])

// Selected airfoils with full data
const selectedAirfoils = ref<Airfoil[]>([])

// Color palette for geometry overlays
const COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
]

// Transform selected airfoils to geometry format for the chart
const geometries = computed(() =>
  selectedAirfoils.value.map((airfoil, idx) => ({
    name: airfoil.name,
    upperX: airfoil.upper_x_coordinates ?? [],
    upperY: airfoil.upper_y_coordinates ?? [],
    lowerX: airfoil.lower_x_coordinates ?? [],
    lowerY: airfoil.lower_y_coordinates ?? [],
    color: COLORS[idx % COLORS.length],
  }))
)

// Fetch all airfoils for selection panel
const fetchAirfoilsList = async () => {
  isLoadingList.value = true
  error.value = null

  try {
    // Fetch in batches to get all airfoils
    const batchSize = 1000
    let allAirfoils: Airfoil[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const result = await searchAirfoils({
        page,
        limit: batchSize,
        thicknessMin: 0,
        thicknessMax: 1,
        camberMin: 0,
        camberMax: 1,
      })

      if (result.data.length > 0) {
        allAirfoils = [...allAirfoils, ...result.data]
        page++
        hasMore = result.data.length === batchSize && allAirfoils.length < result.count
      } else {
        hasMore = false
      }
    }

    airfoilsList.value = allAirfoils
  } catch (err: any) {
    console.error('Error fetching airfoils list:', err)
    error.value = err.message || 'Failed to load airfoils'
  } finally {
    isLoadingList.value = false
  }
}

// Fetch full data for selected airfoils
const fetchSelectedAirfoils = async () => {
  if (selectedAirfoilIds.value.length === 0) {
    selectedAirfoils.value = []
    return
  }

  isLoadingSelected.value = true

  try {
    // Get full data for selected airfoils from the already loaded list
    selectedAirfoils.value = airfoilsList.value.filter(a =>
      selectedAirfoilIds.value.includes(a.id)
    )
  } finally {
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
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Geometry Compare</h1>
      <p class="text-lg text-gray-600">
        Select up to 10 airfoils to overlay and compare their geometry profiles.
      </p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-800">{{ error }}</p>
      <button
        type="button"
        class="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        @click="fetchAirfoilsList"
      >
        Try again
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Selection Panel (Sidebar) -->
      <div class="lg:col-span-1">
        <CompareAirfoilSelectionPanel
          v-model="selectedAirfoilIds"
          :airfoils="airfoilsList"
          :max-selection="10"
          :is-loading="isLoadingList"
        />
      </div>

      <!-- Main Content -->
      <div class="lg:col-span-3">
        <!-- Tabs -->
        <div class="bg-white rounded-lg shadow">
          <div class="border-b border-gray-200">
            <nav class="flex -mb-px">
              <button
                type="button"
                :class="[
                  'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'chart'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                ]"
                @click="activeTab = 'chart'"
              >
                Geometry Overlay
              </button>
              <button
                type="button"
                :class="[
                  'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'table'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                ]"
                @click="activeTab = 'table'"
              >
                Summary Table
              </button>
              <button
                type="button"
                :class="[
                  'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'notes'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                ]"
                @click="activeTab = 'notes'"
              >
                Notes
              </button>
            </nav>
          </div>

          <!-- Tab Content -->
          <div class="p-6">
            <!-- Notes Tab -->
            <div v-if="activeTab === 'notes'">
              <CompareNotesTab storage-key="notes" />
            </div>

            <!-- Loading State -->
            <div v-else-if="isLoadingSelected" class="text-center py-12">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p class="mt-2 text-sm text-gray-600">Loading airfoil data...</p>
            </div>

            <!-- Empty State -->
            <div v-else-if="selectedAirfoils.length === 0" class="text-center py-12 text-gray-500">
              <Icon name="heroicons:chart-bar" class="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Select airfoils from the panel to compare their geometry.</p>
            </div>

            <!-- Chart Tab -->
            <div v-else-if="activeTab === 'chart'">
              <AirfoilGeometry
                :geometries="geometries"
                :show-legend="true"
                :aspect-ratio="7"
                :zoomable="true"
              />
            </div>

            <!-- Table Tab -->
            <div v-else-if="activeTab === 'table'">
              <GeometryCompareGeometrySummaryTable :airfoils="selectedAirfoils" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>



