<script setup lang="ts">
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

const { fetchRandomAirfoils } = useAirfoils()

const featuredAirfoils = ref<Airfoil[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// Fetch 3 random airfoils
const loadFeaturedAirfoils = async () => {
  try {
    loading.value = true
    error.value = null
    featuredAirfoils.value = []
    
    const airfoils = await fetchRandomAirfoils(4)
    
    if (airfoils && airfoils.length > 0) {
      featuredAirfoils.value = airfoils
    } else {
      // Empty result - might mean database is empty
      console.warn('No airfoils returned from fetchRandomAirfoils')
      featuredAirfoils.value = []
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load featured airfoils'
    console.error('Error loading featured airfoils:', err)
    featuredAirfoils.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadFeaturedAirfoils()
})
</script>

<template>
  <section class="py-16 bg-gray-50">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-gray-900">Discover Airfoils</h2>
        <p class="mt-4 text-lg text-gray-600">
          Find a new favorite airfoil.
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12 text-red-600">
        <p>{{ error }}</p>
        <button
          class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          @click="loadFeaturedAirfoils"
        >
          Try Again
        </button>
      </div>

      <!-- Airfoils Grid -->
      <div
        v-else-if="featuredAirfoils.length > 0"
        class="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <AirfoilCard
          v-for="airfoil in featuredAirfoils"
          :key="airfoil.id"
          :airfoil-id="airfoil.id"
        />
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-12 text-gray-500">
        <p>No featured airfoils available at this time.</p>
      </div>
    </div>
  </section>
</template>
