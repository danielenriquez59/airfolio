<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { SearchParams, SortField, SortDirection } from '~/composables/useAirfoilSearch'
import { useInfiniteScroll } from '@vueuse/core'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'

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

const categoryIds = computed(() => {
  const val = route.query.categoryIds as string
  if (!val) return undefined
  return val.split(',')
})

// Sort parameters from URL
const sortBy = computed(() => (route.query.sortBy as SortField) || 'name')
const sortDir = computed(() => (route.query.sortDir as SortDirection) || 'asc')

const sortOptions: { value: SortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'thickness', label: 'Thickness' },
  { value: 'camber', label: 'Camber' },
]

const currentSortLabel = computed(() => {
  const option = sortOptions.find(o => o.value === sortBy.value)
  return option?.label || 'Name'
})

const router = useRouter()

const updateSort = (field: SortField) => {
  router.push({
    query: {
      ...route.query,
      sortBy: field,
    },
  })
}

const toggleSortDirection = () => {
  router.push({
    query: {
      ...route.query,
      sortDir: sortDir.value === 'asc' ? 'desc' : 'asc',
    },
  })
}

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
      categoryIds: categoryIds.value,
      sortBy: sortBy.value,
      sortDir: sortDir.value,
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
    ? `${searchQuery.value} - Search Airfoils | Airfolio` 
    : 'Search Airfoils - Airfolio',
  meta: [
    {
      name: 'description',
      content: 'Browse and filter airfoils by name, thickness, and camber. Find the perfect airfoil for your aerodynamic design project.'
    }
  ]
})
</script>

<template>
  <div>
      <!-- Header with Results Count and Sort Controls -->
      <div class="mb-6 flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Search Results</h1>
          <p v-if="!isLoading" class="text-sm text-gray-600 mt-1">
            Airfoils Found: <span class="font-semibold">{{ totalCount }}</span>
          </p>
        </div>

        <!-- Sort Controls -->
        <div class="flex">
          <!-- Sort By Dropdown -->
          <Menu as="div" class="relative">
            <MenuButton
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            >
              <span class="text-gray-500">Sort:</span>
              {{ currentSortLabel }}
              <Icon name="heroicons:chevron-down" class="w-4 h-4 text-gray-400" />
            </MenuButton>

            <transition
              enter-active-class="transition duration-100 ease-out"
              enter-from-class="transform scale-95 opacity-0"
              enter-to-class="transform scale-100 opacity-100"
              leave-active-class="transition duration-75 ease-in"
              leave-from-class="transform scale-100 opacity-100"
              leave-to-class="transform scale-95 opacity-0"
            >
              <MenuItems
                class="absolute right-0 z-10 mt-1 w-36 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
              >
                <div class="py-1">
                  <MenuItem
                    v-for="option in sortOptions"
                    :key="option.value"
                    v-slot="{ active }"
                  >
                    <button
                      class="w-full text-left px-4 py-2 text-sm"
                      :class="[
                        active ? 'bg-gray-100' : '',
                        sortBy === option.value ? 'text-indigo-600 font-medium' : 'text-gray-700'
                      ]"
                      @click="updateSort(option.value)"
                    >
                      {{ option.label }}
                    </button>
                  </MenuItem>
                </div>
              </MenuItems>
            </transition>
          </Menu>

          <!-- Sort Direction Toggle -->
          <button
            class="inline-flex items-center px-2.5 py-1.5 text-gray-700 bg-white border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
            :title="sortDir === 'asc' ? 'Ascending' : 'Descending'"
            @click="toggleSortDirection"
          >
            <Icon
              :name="sortDir === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
              class="w-4 h-4"
            />
          </button>
        </div>
      </div>

      <!-- Loading State (Initial Load) -->
      <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AirfoilCardSkeleton
          v-for="i in 20"
          :key="`skeleton-${i}`"
          thumbnail
        />
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
        class="grid grid-cols-1 md:grid-cols-3 gap-6"
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

