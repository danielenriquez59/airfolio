<script setup lang="ts">
import type { Database } from '~/types/database.types'
import { useDebounceFn, onClickOutside } from '@vueuse/core'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

const { searchAirfoilsByPrefix } = useAirfoilAutocomplete()

const searchQuery = ref('')
const suggestions = ref<Airfoil[]>([])
const showSuggestions = ref(false)
const isLoading = ref(false)
const selectedIndex = ref(-1)
const searchContainerRef = ref<HTMLElement | null>(null)

// Debounced search function with 300ms delay
const debouncedSearch = useDebounceFn(async (query: string) => {
  if (query.length < 2) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }

  isLoading.value = true
  try {
    const results = await searchAirfoilsByPrefix(query, 15)
    suggestions.value = results
    showSuggestions.value = true
    selectedIndex.value = -1
  } catch (error) {
    console.error('Error fetching autocomplete suggestions:', error)
    suggestions.value = []
  } finally {
    isLoading.value = false
  }
}, 300)

// Watch search query and trigger debounced search
watch(searchQuery, (newQuery) => {
  if (newQuery.length >= 2) {
    debouncedSearch(newQuery)
  } else {
    suggestions.value = []
    showSuggestions.value = false
    selectedIndex.value = -1
  }
})

const handleSearch = () => {
  // Navigate to search page with search query
  if (searchQuery.value.trim()) {
    showSuggestions.value = false
    navigateTo(`/search?q=${encodeURIComponent(searchQuery.value)}`)
  }
}

const handleSuggestionClick = (airfoil: Airfoil) => {
  const slug = encodeURIComponent(airfoil.name)
  navigateTo(`/airfoils/${slug}`)
  showSuggestions.value = false
  searchQuery.value = ''
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    if (showSuggestions.value && selectedIndex.value >= 0 && suggestions.value[selectedIndex.value]) {
      // Select highlighted suggestion
      handleSuggestionClick(suggestions.value[selectedIndex.value])
    } else {
      // Perform regular search
      handleSearch()
    }
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (showSuggestions.value && suggestions.value.length > 0) {
      selectedIndex.value = Math.min(selectedIndex.value + 1, suggestions.value.length - 1)
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (showSuggestions.value) {
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
    }
  } else if (event.key === 'Escape') {
    showSuggestions.value = false
    selectedIndex.value = -1
  }
}

// Close suggestions when clicking outside
onClickOutside(searchContainerRef, () => {
  showSuggestions.value = false
})
</script>

<template>
  <div>
    <div class="relative px-6 lg:px-8">
      <div class="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
        <div class="text-center">
          <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Airfolio
          </h1>
          
          <div class="mt-10 flex items-center justify-center">
            <div ref="searchContainerRef" class="relative w-full max-w-lg">
              <VInput
                v-model="searchQuery"
                placeholder="Search for an airfoil..."
                size="lg"
                prepend-icon="heroicons:magnifying-glass"
                wrapper-class="w-full"
                @keydown="handleKeydown"
                @focus="showSuggestions = searchQuery.length >= 2 && suggestions.length > 0"
              >
                <template #append>
                  <button
                    type="button"
                    class="rounded-full bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center justify-center"
                    @click="handleSearch"
                  >
                    <Icon name="heroicons:magnifying-glass" class="h-5 w-5" />
                  </button>
                </template>
              </VInput>

              <!-- Loading State -->
              <Transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="opacity-0 scale-95"
                enter-to-class="opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="opacity-100 scale-100"
                leave-to-class="opacity-0 scale-95"
              >
                <div
                  v-if="isLoading && searchQuery.length >= 2"
                  class="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200"
                  @click.stop
                >
                  <div class="px-4 py-3 text-center text-gray-500">
                    <div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                    <span class="ml-2">Searching...</span>
                  </div>
                </div>
              </Transition>

              <!-- Autocomplete Dropdown -->
              <Transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="opacity-0 scale-95"
                enter-to-class="opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="opacity-100 scale-100"
                leave-to-class="opacity-0 scale-95"
              >
                <div
                  v-if="showSuggestions && !isLoading && suggestions.length > 0"
                  class="absolute z-50 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 max-h-60 overflow-auto"
                  @click.stop
                >
                  <!-- Suggestions List -->
                  <button
                    v-for="(airfoil, index) in suggestions"
                    :key="airfoil.id"
                    type="button"
                    :class="[
                      'w-full text-left px-4 py-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors',
                      selectedIndex === index ? 'bg-indigo-50' : ''
                    ]"
                    @click="handleSuggestionClick(airfoil)"
                    @mouseenter="selectedIndex = index"
                  >
                    <div class="font-medium text-gray-900 uppercase">{{ airfoil.name }}</div>
                    <div v-if="airfoil.description" class="text-sm text-gray-500 truncate">
                      {{ airfoil.description }}
                    </div>
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </div>
      <div class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]">
        <svg class="relative left-[calc(50%+3rem)] h-[21.1875rem] max-w-none -translate-x-1/2 sm:left-[calc(50%+36rem)] sm:h-[42.375rem]" viewBox="0 0 1155 678" xmlns="http://www.w3.org/2000/svg">
          <path fill="url(#ecb5b0c9-546c-4772-8c71-4d3f06d544bc)" fill-opacity=".3" d="M317.219 518.975L203.852 678 0 438.341l317.219 80.634 204.172-286.402c1.307 132.337 45.083 346.658 209.733 145.248C936.936 126.058 882.053-94.234 1031.02 41.331c119.18 108.451 130.68 295.337 121.53 375.223L855 299l21.173 362.054-558.954-142.079z" />
          <defs>
            <linearGradient id="ecb5b0c9-546c-4772-8c71-4d3f06d544bc" x1="1155.49" x2="-78.208" y1=".177" y2="474.645" gradientUnits="userSpaceOnUse">
              <stop stop-color="#9089FC" />
              <stop offset="1" stop-color="#FF80B5" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  </div>
</template>
