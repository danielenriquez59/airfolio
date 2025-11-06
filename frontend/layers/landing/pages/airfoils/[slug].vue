<script setup lang="ts">
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

definePageMeta({
  layout: 'detail',
})

const route = useRoute()
const { fetchAirfoilByName } = useAirfoils()
const { downloadLednicer, downloadSelig } = useAirfoilDownload()

const airfoil = ref<Airfoil | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const airfoilSlug = computed(() => route.params.slug as string)

// Helper function to create URL-friendly slug from airfoil name
const createSlug = (name: string): string => {
  return encodeURIComponent(name)
}

// Fetch airfoil data by name (slug)
onMounted(async () => {
  try {
    loading.value = true
    error.value = null
    const data = await fetchAirfoilByName(airfoilSlug.value)
    
    if (!data) {
      error.value = 'Airfoil not found'
      return
    }
    
    airfoil.value = data
    
    // Update URL if slug doesn't match (for proper SEO/redirects)
    const currentSlug = createSlug(data.name)
    if (route.params.slug !== currentSlug) {
      await navigateTo(`/airfoils/${currentSlug}`, { replace: true })
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load airfoil'
    console.error('Error loading airfoil:', err)
  } finally {
    loading.value = false
  }
})

useHead({
  title: airfoil.value ? `${airfoil.value.name} - Airfolio` : 'Airfoil Details - Airfolio',
})
</script>

<template>
  <div>
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <p class="text-red-600 text-lg mb-4">{{ error }}</p>
        <NuxtLink
          to="/"
          class="text-indigo-600 hover:text-indigo-800 underline"
        >
          Return to Home
        </NuxtLink>
      </div>

      <!-- Airfoil Details -->
      <div v-else-if="airfoil" class="max-w-4xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-4xl font-bold text-gray-900 uppercase tracking-wide mb-2">
            {{ airfoil.name.toUpperCase() }}
          </h1>
          <p v-if="airfoil.description" class="text-lg text-gray-600">
            {{ airfoil.description }}
          </p>
        </div>

        <!-- Geometry Visualization -->
        <div class="mb-8 bg-white rounded-lg shadow p-6">
          <AirfoilGeometry
            v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
            :upper-x="airfoil.upper_x_coordinates"
            :upper-y="airfoil.upper_y_coordinates"
            :lower-x="airfoil.lower_x_coordinates"
            :lower-y="airfoil.lower_y_coordinates"
            :name="airfoil.name"
            :height="400"
            :aspect-ratio="null"
            :show-grid="true"
            :zoomable="true"
            :show-points-on-hover="true"
          />
          <div v-else class="text-center py-8 text-gray-400">
            Geometry data not available
          </div>
        </div>

        <!-- Metadata -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Geometry Parameters</h2>
            <dl class="space-y-3">
              <div v-if="airfoil.thickness_pct">
                <dt class="text-sm text-gray-500">Thickness</dt>
                <dd class="text-lg font-semibold text-gray-900">
                  {{ (airfoil.thickness_pct * 100).toFixed(2) }}%
                  <span v-if="airfoil.thickness_loc_pct" class="text-sm text-gray-600 font-normal">
                    @ {{ (airfoil.thickness_loc_pct * 100).toFixed(1) }}% x/c
                  </span>
                </dd>
              </div>
              <div v-if="airfoil.camber_pct">
                <dt class="text-sm text-gray-500">Camber</dt>
                <dd class="text-lg font-semibold text-gray-900">
                  {{ (airfoil.camber_pct * 100).toFixed(2) }}%
                  <span v-if="airfoil.camber_loc_pct" class="text-sm text-gray-600 font-normal">
                    @ {{ (airfoil.camber_loc_pct * 100).toFixed(1) }}% x/c
                  </span>
                </dd>
              </div>
              <div v-if="airfoil.le_radius">
                <dt class="text-sm text-gray-500">Leading Edge Radius</dt>
                <dd class="text-lg font-semibold text-gray-900">
                  {{ airfoil.le_radius.toFixed(4) }}
                </dd>
              </div>
              <div v-if="airfoil.te_thickness">
                <dt class="text-sm text-gray-500">Trailing Edge Thickness</dt>
                <dd class="text-lg font-semibold text-gray-900">
                  {{ airfoil.te_thickness.toFixed(4) }}
                </dd>
              </div>
              <div v-if="airfoil.upper_surface_nodes !== null">
                <dt class="text-sm text-gray-500">Upper Surface Nodes</dt>
                <dd class="text-lg font-semibold text-gray-900">
                  {{ airfoil.upper_surface_nodes }}
                </dd>
              </div>
              <div v-if="airfoil.lower_surface_nodes !== null">
                <dt class="text-sm text-gray-500">Lower Surface Nodes</dt>
                <dd class="text-lg font-semibold text-gray-900">
                  {{ airfoil.lower_surface_nodes }}
                </dd>
              </div>
            </dl>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Additional Information</h2>
            <dl class="space-y-3">
              <div v-if="airfoil.source_url">
                <dt class="text-sm text-gray-500">Source</dt>
                <dd>
                  <a
                    :href="airfoil.source_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                  >
                    {{ airfoil.source_url }}
                    <Icon name="heroicons:arrow-top-right-on-square" class="h-4 w-4" />
                  </a>
                </dd>
              </div>
              <div v-if="airfoil.created_at">
                <dt class="text-sm text-gray-500">Added</dt>
                <dd class="text-gray-900">
                  {{ new Date(airfoil.created_at).toLocaleDateString() }}
                </dd>
              </div>
              <div
                v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates && airfoil.upper_surface_nodes && airfoil.lower_surface_nodes"
              >
                <dt class="text-sm text-gray-500">Download</dt>
                <dd class="flex flex-col gap-2">
                  <button
                    type="button"
                    @click="() => downloadLednicer(airfoil!)"
                    class="text-left text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer"
                  >
                    Download Lednicer Format
                    <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    @click="() => downloadSelig(airfoil!)"
                    class="text-left text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer"
                  >
                    Download Selig Format
                    <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
                  </button>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
  </div>
</template>

