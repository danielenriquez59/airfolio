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
  <section class="py-12 sm:py-16" aria-labelledby="featured-airfoils-title">
    <div class="page-container">
      <div class="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="featured-airfoils-title" class="text-xl font-semibold tracking-tight text-gray-900">
            Discover airfoils
          </h2>
          <p class="mt-1 text-sm text-gray-500">
            A random selection from the catalog.
          </p>
        </div>
        <NuxtLink
          to="/search"
          class="inline-flex items-center gap-1 rounded text-sm font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Browse all
          <Icon name="heroicons:arrow-right" class="h-4 w-4" aria-hidden="true" />
        </NuxtLink>
      </div>

      <!-- 4 items: the 4th is hidden at lg (3 columns) so the row stays full -->
      <div v-if="loading" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AirfoilCardSkeleton
          v-for="i in 4"
          :key="`skeleton-${i}`"
          :class="i === 4 ? 'lg:hidden xl:block' : ''"
        />
      </div>

      <VPanel v-else-if="error">
        <VStateBlock variant="error" title="Could not load airfoils" :description="error">
          <VButton color="primary" @click="loadFeaturedAirfoils">
            Try again
          </VButton>
        </VStateBlock>
      </VPanel>

      <div
        v-else-if="featuredAirfoils.length > 0"
        class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <AirfoilCard
          v-for="(airfoil, index) in featuredAirfoils"
          :key="airfoil.id"
          :airfoil="airfoil"
          :class="index === 3 ? 'lg:hidden xl:block' : ''"
        />
      </div>

      <VPanel v-else>
        <VStateBlock title="No airfoils available" description="No featured airfoils are available at this time." />
      </VPanel>
    </div>
  </section>
</template>
