<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { SearchParams } from '~/composables/useAirfoilSearch'
import { useInfiniteScroll } from '@vueuse/core'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

definePageMeta({
  layout: 'search',
})

const route = useRoute()
const { searchAirfoils } = useAirfoilSearch()

const searchResults = ref<Airfoil[]>([])
const currentPage = ref(1)
const totalPages = ref(0)
const totalCount = ref(0)
const isLoading = ref(false)
const isLoadingMore = ref(false)

// Extract query params from URL
// Note: URL stores percentage values (10 for 10%), but we need to convert to decimal (0.1) for database query
const searchQuery = computed(() => (route.query.q as string) || '')
const thicknessMin = computed(() => {
  const val = route.query.thicknessMin
  if (!val) return undefined
  const num = parseFloat(val as string)
  // Convert percentage to decimal (10 -> 0.1, but if already decimal like 0.1, keep it)
  return num >= 1 ? num / 100 : num
})
const thicknessMax = computed(() => {
  const val = route.query.thicknessMax
  if (!val) return undefined
  const num = parseFloat(val as string)
  // Convert percentage to decimal (10 -> 0.1, but if already decimal like 0.1, keep it)
  return num >= 1 ? num / 100 : num
})
const camberMin = computed(() => {
  const val = route.query.camberMin
  if (!val) return undefined
  const num = parseFloat(val as string)
  // Convert percentage to decimal (10 -> 0.1, but if already decimal like 0.1, keep it)
  return num >= 1 ? num / 100 : num
})
const camberMax = computed(() => {
  const val = route.query.camberMax
  if (!val) return undefined
  const num = parseFloat(val as string)
  // Convert percentage to decimal (10 -> 0.1, but if already decimal like 0.1, keep it)
  return num >= 1 ? num / 100 : num
})

const hasMore = computed(() => currentPage.value < totalPages.value)

// Perform search with current filters
const performSearch = async (reset = false) => {
  if (reset) {
    currentPage.value = 1
    searchResults.value = []
  }

  const loadingRef = reset ? isLoading : isLoadingMore
  loadingRef.value = true

  try {
    const params: SearchParams = {
      query: searchQuery.value || undefined,
      thicknessMin: thicknessMin.value,
      thicknessMax: thicknessMax.value,
      camberMin: camberMin.value,
      camberMax: camberMax.value,
      page: currentPage.value,
      limit: 20,
    }

    const result = await searchAirfoils(params)

    if (reset) {
      searchResults.value = result.data
    } else {
      searchResults.value = [...searchResults.value, ...result.data]
    }

    totalPages.value = result.totalPages
    totalCount.value = result.count
  } catch (error) {
    console.error('Error searching airfoils:', error)
  } finally {
    loadingRef.value = false
  }
}

// Load more results
const loadMore = async () => {
  if (!hasMore.value || isLoadingMore.value || isLoading.value) return

  currentPage.value++
  await performSearch(false)
}

// Initialize search on mount and when query params change
watch(() => route.query, async () => {
  await performSearch(true)
}, { immediate: true })

// Infinite scroll setup - watch window scroll
useInfiniteScroll(
  window,
  () => {
    if (hasMore.value && !isLoadingMore.value && !isLoading.value) {
      loadMore()
    }
  },
  {
    distance: 200, // Trigger when 200px from bottom
  }
)

useHead({
  title: searchQuery.value 
    ? `Search: ${searchQuery.value} - Airfolio` 
    : 'Search Airfoils - Airfolio',
})
</script>

<template>
  <div>
      <!-- Header with Results Count -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Search Results</h1>
        <p v-if="!isLoading" class="text-sm text-gray-600 mt-1">
          Airfoils Found: <span class="font-semibold">{{ totalCount }}</span>
        </p>
      </div>

      <!-- Loading State (Initial Load) -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!isLoading && searchResults.length === 0" class="text-center py-12">
        <p class="text-gray-500 text-lg mb-4">No airfoils found matching your criteria.</p>
        <NuxtLink
          to="/"
          class="text-indigo-600 hover:text-indigo-800 underline"
        >
          Return to Home
        </NuxtLink>
      </div>

      <!-- Results Grid -->
      <div
        v-else
        class="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <AirfoilCard
          v-for="airfoil in searchResults"
          :key="airfoil.id"
          :airfoil-id="airfoil.id"
          thumbnail
        />

        <!-- Loading More Indicator -->
        <div
          v-if="isLoadingMore"
          class="col-span-full flex items-center justify-center py-8"
        >
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span class="ml-3 text-gray-600">Loading more...</span>
        </div>

        <!-- End of Results Message -->
        <div
          v-if="!hasMore && searchResults.length > 0"
          class="col-span-full text-center py-8 text-gray-500"
        >
          No more results to load
        </div>
      </div>
  </div>
</template>

