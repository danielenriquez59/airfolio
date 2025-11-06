<script setup lang="ts">
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

definePageMeta({
  layout: false, // No layout - just white background
})

const route = useRoute()
const { fetchAirfoilByName } = useAirfoils()

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
  <div class="min-h-screen bg-white">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            :aspect-ratio="2.5"
            :show-grid="true"
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
                  {{ airfoil.thickness_pct.toFixed(2) }}%
                  <span v-if="airfoil.thickness_loc_pct" class="text-sm text-gray-600 font-normal">
                    @ {{ airfoil.thickness_loc_pct.toFixed(1) }}%
                  </span>
                </dd>
              </div>
              <div v-if="airfoil.camber_pct">
                <dt class="text-sm text-gray-500">Camber</dt>
                <dd class="text-lg font-semibold text-gray-900">
                  {{ airfoil.camber_pct.toFixed(2) }}%
                  <span v-if="airfoil.camber_loc_pct" class="text-sm text-gray-600 font-normal">
                    @ {{ airfoil.camber_loc_pct.toFixed(1) }}%
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
            </dl>
          </div>
        </div>

        <!-- Back Button -->
        <div class="text-center">
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Icon name="heroicons:arrow-left" class="h-5 w-5" />
            Back to Home
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

