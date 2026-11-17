<script setup lang="ts">
import { onClickOutside, useDebounceFn } from '@vueuse/core'
import type { Database } from '~/types/database.types'

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
  }
  catch (error) {
    console.error('Error fetching autocomplete suggestions:', error)
    suggestions.value = []
  }
  finally {
    isLoading.value = false
  }
}, 300)

// Watch search query and trigger debounced search
watch(searchQuery, (newQuery) => {
  if (newQuery.length >= 2) {
    debouncedSearch(newQuery)
  }
  else {
    suggestions.value = []
    showSuggestions.value = false
    selectedIndex.value = -1
  }
})

function handleSearch() {
  // Navigate to search page with search query
  showSuggestions.value = false
  if (searchQuery.value.trim())
    navigateTo(`/search?q=${encodeURIComponent(searchQuery.value)}`)
  else
    navigateTo('/search')
}

function handleSuggestionClick(airfoil: Airfoil) {
  const slug = encodeURIComponent(airfoil.name)
  navigateTo(`/airfoils/${slug}`)
  showSuggestions.value = false
  searchQuery.value = ''
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    if (showSuggestions.value && selectedIndex.value >= 0 && suggestions.value[selectedIndex.value]) {
      // Select highlighted suggestion
      handleSuggestionClick(suggestions.value[selectedIndex.value])
    }
    else {
      // Perform regular search
      handleSearch()
    }
  }
  else if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (showSuggestions.value && suggestions.value.length > 0)
      selectedIndex.value = Math.min(selectedIndex.value + 1, suggestions.value.length - 1)
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (showSuggestions.value)
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
  }
  else if (event.key === 'Escape') {
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
  <section class="relative border-b border-gray-200 bg-white">
    <!-- Fine engineering grid, fading out towards the bottom -->
    <div class="hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />

    <div class="page-container relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-2">
      <div>
        <p class="data-label">
          Airfoil database &amp; analysis
        </p>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          Search, analyze and compare airfoils
        </h1>
        <p class="mt-3 max-w-xl text-base text-gray-600">
          Filter the catalog by thickness and camber, then run NeuralFoil polars
          (C<sub>L</sub>, C<sub>D</sub>, C<sub>M</sub> vs &alpha;) at your own Reynolds and Mach numbers.
        </p>

        <div ref="searchContainerRef" class="relative mt-6 max-w-xl">
          <VInput
            v-model="searchQuery"
            aria-label="Search airfoils by name"
            placeholder="Search by name, e.g. NACA 2412"
            size="lg"
            prepend-icon="heroicons:magnifying-glass"
            wrapper-class="w-full"
            @keydown="handleKeydown"
            @focus="showSuggestions = searchQuery.length >= 2 && suggestions.length > 0"
          >
            <template #append>
              <VButton
                type="button"
                color="primary"
                size="sm"
                aria-label="Search"
                @click="handleSearch"
              >
                Search
              </VButton>
            </template>
          </VInput>

          <!-- Loading State -->
          <div
            v-if="isLoading && searchQuery.length >= 2"
            class="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg"
            @click.stop
          >
            <div class="flex items-center justify-center gap-2 px-4 py-3 text-sm text-gray-500" role="status">
              <span class="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600" aria-hidden="true" />
              Searching...
            </div>
          </div>

          <!-- Autocomplete Dropdown -->
          <Transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="showSuggestions && !isLoading && suggestions.length > 0"
              class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              @click.stop
            >
              <button
                v-for="(airfoil, index) in suggestions"
                :key="airfoil.id"
                type="button"
                class="w-full px-4 py-2 text-left transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                :class="{ 'bg-primary-50': selectedIndex === index }"
                @click="handleSuggestionClick(airfoil)"
                @mouseenter="selectedIndex = index"
              >
                <div class="text-sm font-medium uppercase text-gray-900">{{ airfoil.name }}</div>
                <div v-if="airfoil.description" class="truncate text-xs text-gray-500">
                  {{ airfoil.description }}
                </div>
              </button>
            </div>
          </Transition>
        </div>

        <nav class="mt-5 flex flex-wrap gap-2" aria-label="Main tools">
          <VButton to="/search" color="light" size="sm">
            <Icon name="heroicons:squares-2x2" class="h-4 w-4" aria-hidden="true" />
            Browse airfoils
          </VButton>
          <VButton to="/performance" color="light" size="sm">
            <Icon name="heroicons:chart-bar" class="h-4 w-4" aria-hidden="true" />
            Compare performance
          </VButton>
          <VButton to="/upload" color="light" size="sm">
            <Icon name="heroicons:arrow-up-tray" class="h-4 w-4" aria-hidden="true" />
            Upload an airfoil
          </VButton>
        </nav>
      </div>

      <!-- Restrained technical motif: a NACA 2412 section with chord and mean camber line -->
      <figure class="hidden lg:block" aria-hidden="true">
        <svg viewBox="0 0 500 100" class="w-full text-primary-600" fill="none">
          <line x1="10" y1="60" x2="490" y2="60" class="stroke-gray-300" stroke-dasharray="4 4" />
          <path d="M10.0,60.0 L21.7,58.9 L55.8,56.0 L108.9,52.7 L175.8,50.6 L250.0,50.7 L324.2,52.1 L391.1,54.5 L444.2,57.2 L478.3,59.2 L490.0,60.0" class="stroke-gray-400" stroke-width="1" stroke-dasharray="2 3" />
          <path d="M490.0,60.0 L489.3,59.8 L487.1,59.4 L483.4,58.6 L478.4,57.6 L471.9,56.2 L464.1,54.7 L454.9,52.9 L444.5,50.9 L432.9,48.8 L420.2,46.6 L406.4,44.2 L391.6,41.9 L376.0,39.5 L359.5,37.1 L342.4,34.8 L324.7,32.6 L306.5,30.5 L288.0,28.6 L269.2,26.8 L250.3,25.3 L231.3,24.0 L212.5,23.0 L193.9,22.3 L175.4,22.0 L157.5,22.1 L140.1,22.7 L123.5,23.6 L107.6,25.0 L92.6,26.7 L78.7,28.8 L65.8,31.2 L54.2,33.9 L43.7,36.8 L34.6,39.9 L26.9,43.2 L20.6,46.5 L15.7,49.9 L12.3,53.3 L10.4,56.6 L10.0,60.0 L11.1,63.2 L13.6,66.2 L17.5,68.8 L22.9,71.2 L29.6,73.4 L37.7,75.2 L47.0,76.7 L57.5,78.0 L69.2,79.0 L81.9,79.7 L95.6,80.1 L110.3,80.3 L125.7,80.3 L142.0,80.1 L158.8,79.7 L176.2,79.2 L194.1,78.5 L212.4,77.8 L231.0,77.0 L249.7,76.0 L268.5,75.0 L287.1,73.9 L305.5,72.8 L323.6,71.6 L341.3,70.5 L358.4,69.4 L374.8,68.3 L390.5,67.2 L405.4,66.2 L419.2,65.2 L432.1,64.3 L443.8,63.5 L454.3,62.7 L463.6,62.0 L471.6,61.4 L478.1,60.9 L483.3,60.5 L487.0,60.2 L489.3,60.1 L490.0,60.0 Z" stroke="currentColor" stroke-width="1.5" fill="currentColor" fill-opacity="0.06" />
        </svg>
        <figcaption class="mt-2 flex justify-between font-mono text-xs text-gray-400">
          <span>x/c 0</span>
          <span>NACA 2412</span>
          <span>x/c 1</span>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.hero-grid {
  background-image:
    linear-gradient(to right, rgb(226 232 240 / 0.7) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(226 232 240 / 0.7) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: linear-gradient(to bottom, black, transparent);
}
</style>
