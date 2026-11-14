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
  return num / 100
})
const thicknessMax = computed(() => {
  const val = route.query.thicknessMax
  if (!val) return undefined
  const num = parseFloat(val as string)
  return num / 100
})
const camberMin = computed(() => {
  const val = route.query.camberMin
  if (!val) return undefined
  const num = parseFloat(val as string)
  return num / 100
})
const camberMax = computed(() => {
  const val = route.query.camberMax
  if (!val) return undefined
  const num = parseFloat(val as string)
  return num / 100
})
const areaMin = computed(() => {
  const val = route.query.areaMin
  if (!val) return undefined
  const num = parseFloat(val as string)
  return num / 100
})
const areaMax = computed(() => {
  const val = route.query.areaMax
  if (!val) return undefined
  const num = parseFloat(val as string)
  return num / 100
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
  { value: 'uploadDate', label: 'Upload Date' },
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
      areaMin: areaMin.value,
      areaMax: areaMax.value,
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
  title: () => searchQuery.value
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
    <PageHeader title="Airfoil search" />

    <LandingSearchBar>
      <template #toolbar>
        <!-- Results toolbar: count + sort -->
        <div class="mb-3 mt-4 flex items-center justify-between gap-3">
          <p class="text-sm text-gray-600" aria-live="polite">
            <template v-if="isLoading">
              Searching…
            </template>
            <template v-else>
              <span class="num font-medium text-gray-900">{{ totalCount }}</span>
              {{ totalCount === 1 ? 'airfoil' : 'airfoils' }}
            </template>
          </p>

          <div class="flex">
            <Menu as="div" class="relative">
              <MenuButton
                class="inline-flex h-9 items-center gap-1.5 rounded-l-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <span class="text-gray-500">Sort:</span>
                {{ currentSortLabel }}
                <Icon name="heroicons:chevron-down" class="h-4 w-4 text-gray-400" />
              </MenuButton>

              <transition
                enter-active-class="transition duration-100 ease-out"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="transition duration-75 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
              >
                <MenuItems
                  class="absolute right-0 z-20 mt-1 w-44 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg focus:outline-none"
                >
                  <MenuItem
                    v-for="option in sortOptions"
                    :key="option.value"
                    v-slot="{ active }"
                  >
                    <button
                      class="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                      :class="[
                        active ? 'bg-gray-50' : '',
                        sortBy === option.value ? 'font-medium text-primary-700' : 'text-gray-700',
                      ]"
                      @click="updateSort(option.value)"
                    >
                      {{ option.label }}
                      <Icon v-if="sortBy === option.value" name="heroicons:check" class="h-4 w-4" />
                    </button>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>

            <button
              class="-ml-px inline-flex h-9 items-center rounded-r-lg border border-gray-300 bg-white px-2.5 text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary-500"
              :title="sortDir === 'asc' ? 'Ascending' : 'Descending'"
              :aria-label="sortDir === 'asc' ? 'Sort ascending (click for descending)' : 'Sort descending (click for ascending)'"
              @click="toggleSortDirection"
            >
              <Icon
                :name="sortDir === 'asc' ? 'heroicons:bars-arrow-up' : 'heroicons:bars-arrow-down'"
                class="h-4 w-4"
              />
            </button>
          </div>
        </div>
      </template>

      <template #default="{ clearFilters }">
        <!-- Loading State (Initial Load) -->
        <div v-if="isLoading" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <AirfoilCardSkeleton
            v-for="i in 12"
            :key="`skeleton-${i}`"
            thumbnail
          />
        </div>

        <!-- Empty State -->
        <div v-else-if="searchResults.length === 0" class="rounded-xl border border-gray-200 bg-white">
          <VStateBlock
            title="No airfoils match these filters"
            description="Try widening the ranges or removing a category."
            icon="heroicons:magnifying-glass"
          >
            <VButton color="primary" @click="clearFilters">
              Clear filters
            </VButton>
            <VButton to="/">
              Return to Home
            </VButton>
          </VStateBlock>
        </div>

        <!-- Results Grid -->
        <div
          v-else
          class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        >
          <AirfoilCard
            v-for="airfoil in searchResults"
            :key="airfoil.id"
            :airfoil="airfoil"
            thumbnail
          />

          <!-- Loading More Indicator -->
          <VStateBlock
            v-if="isLoadingMore"
            variant="loading"
            description="Loading more…"
            class="col-span-full"
          />

          <!-- End of Results Message -->
          <p
            v-if="!hasMore && searchResults.length > 0"
            class="col-span-full py-6 text-center text-sm text-gray-500"
          >
            End of results · <span class="num">{{ totalCount }}</span> shown
          </p>
        </div>
      </template>
    </LandingSearchBar>
  </div>
</template>
