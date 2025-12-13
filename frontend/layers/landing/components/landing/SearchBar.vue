<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import type { Database } from '~/types/database.types'
import { formatCategoryName } from '~/utils/categoryUtils'

type Category = Database['public']['Tables']['categories']['Row']

const route = useRoute()
const { fetchCategories } = useCategories()

// Search query state
const searchQuery = ref((route.query.q as string) || '')

// Filter states
const thicknessEnabled = ref(false)
const thicknessMin = ref<number | undefined>()
const thicknessMax = ref<number | undefined>()

const camberEnabled = ref(false)
const camberMin = ref<number | undefined>()
const camberMax = ref<number | undefined>()

const categoryEnabled = ref(false)
const selectedCategoryIds = ref<string[]>([])
const allCategories = ref<Category[]>([])

const showFilters = ref(true)

// Helper functions to convert between display (percentage) and database (decimal) format
const percentageToDecimal = (value: number): number => value / 100
const decimalToPercentage = (value: number): number => value * 100

// Initialize from URL params on mount
onMounted(async () => {
  // Fetch all categories
  try {
    allCategories.value = await fetchCategories()
  } catch (err) {
    console.error('Error fetching categories:', err)
  }

  // Check thickness filters
  // URL stores percentage values (10 for 10%), convert to decimal if needed
  if (route.query.thicknessMin || route.query.thicknessMax) {
    thicknessEnabled.value = true
    const minVal = route.query.thicknessMin 
      ? parseFloat(route.query.thicknessMin as string) 
      : undefined
    const maxVal = route.query.thicknessMax 
      ? parseFloat(route.query.thicknessMax as string) 
      : undefined
    
    // Convert from database format (0.1) to display format (10) if needed
    // If value is < 1, it's likely in decimal format, convert to percentage
    thicknessMin.value = minVal !== undefined 
      ? (minVal < 1 ? decimalToPercentage(minVal) : minVal)
      : undefined
    thicknessMax.value = maxVal !== undefined 
      ? (maxVal < 1 ? decimalToPercentage(maxVal) : maxVal)
      : undefined
  }

  // Check camber filters
  if (route.query.camberMin || route.query.camberMax) {
    camberEnabled.value = true
    const minVal = route.query.camberMin 
      ? parseFloat(route.query.camberMin as string) 
      : undefined
    const maxVal = route.query.camberMax 
      ? parseFloat(route.query.camberMax as string) 
      : undefined
    
    // Convert from database format (0.1) to display format (10) if needed
    camberMin.value = minVal !== undefined 
      ? (minVal < 1 ? decimalToPercentage(minVal) : minVal)
      : undefined
    camberMax.value = maxVal !== undefined 
      ? (maxVal < 1 ? decimalToPercentage(maxVal) : maxVal)
      : undefined
  }

  // Check category filters
  if (route.query.categoryIds) {
    categoryEnabled.value = true
    const categoryIdsStr = route.query.categoryIds as string
    selectedCategoryIds.value = categoryIdsStr.split(',')
  }
})

// Watch checkbox toggles - disable filters when unchecked
watch(thicknessEnabled, (enabled) => {
  if (!enabled) {
    thicknessMin.value = undefined
    thicknessMax.value = undefined
    updateURL()
  }
})

watch(camberEnabled, (enabled) => {
  if (!enabled) {
    camberMin.value = undefined
    camberMax.value = undefined
    updateURL()
  }
})

watch(categoryEnabled, (enabled) => {
  if (!enabled) {
    selectedCategoryIds.value = []
    updateURL()
  }
})

// Debounced update for number inputs (300ms delay)
const debouncedUpdate = useDebounceFn(() => {
  updateURL()
}, 300)

// Watch number inputs with debouncing
watch([thicknessMin, thicknessMax], () => {
  if (thicknessEnabled.value) {
    // Only update if at least one value is set
    if (thicknessMin.value !== undefined || thicknessMax.value !== undefined) {
      debouncedUpdate()
    } else {
      // If both are cleared, update immediately to remove params
      updateURL()
    }
  }
})

watch([camberMin, camberMax], () => {
  if (camberEnabled.value) {
    // Only update if at least one value is set
    if (camberMin.value !== undefined || camberMax.value !== undefined) {
      debouncedUpdate()
    } else {
      // If both are cleared, update immediately to remove params
      updateURL()
    }
  }
})

watch(selectedCategoryIds, () => {
  if (categoryEnabled.value) {
    updateURL()
  }
})

// Update URL function - stores percentage values (10 for 10%) in URL
const updateURL = () => {
  const query: Record<string, string> = {}
  
  // Add search query if present
  if (searchQuery.value.trim()) {
    query.q = searchQuery.value.trim()
  }
  
  // Add thickness filters if enabled (store as percentage in URL)
  if (thicknessEnabled.value) {
    if (thicknessMin.value !== undefined && thicknessMin.value !== null) {
      query.thicknessMin = thicknessMin.value.toString()
    }
    if (thicknessMax.value !== undefined && thicknessMax.value !== null) {
      query.thicknessMax = thicknessMax.value.toString()
    }
  }
  
  // Add camber filters if enabled (store as percentage in URL)
  if (camberEnabled.value) {
    if (camberMin.value !== undefined && camberMin.value !== null) {
      query.camberMin = camberMin.value.toString()
    }
    if (camberMax.value !== undefined && camberMax.value !== null) {
      query.camberMax = camberMax.value.toString()
    }
  }
  
  // Add category filters if enabled
  if (categoryEnabled.value && selectedCategoryIds.value.length > 0) {
    query.categoryIds = selectedCategoryIds.value.join(',')
  }
  
  navigateTo({
    path: '/search',
    query,
  })
}

// Handle search input submission
const handleSearch = () => {
  updateURL()
}

// Handle Enter key in search input
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    handleSearch()
  }
}
</script>

<template>
  <div class="bg-white border-b border-gray-200 shadow-sm">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Search Input Row -->
      <div class="flex items-center gap-4 mb-4">
        <div class="flex-1">
          <VInput
            v-model="searchQuery"
            placeholder="Search for an airfoil..."
            size="lg"
            prepend-icon="heroicons:magnifying-glass"
            wrapper-class="w-full"
            @keydown="handleKeydown"
          />
        </div>
        <button
          type="button"
          class="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          @click="handleSearch"
        >
          <Icon name="heroicons:magnifying-glass" class="h-5 w-5 mr-2" />
          Search
        </button>
      </div>

      <!-- Filters Toggle Button -->
      <div class="mb-4">
        <button
          type="button"
          @click="showFilters = !showFilters"
          class="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
        >
          <Icon
            :name="showFilters ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
            class="h-5 w-5"
          />
          Filters
        </button>
      </div>

      <!-- Filters Container - 2 Column Layout -->
      <Transition
        enter-active-class="transition-all duration-150 ease-out"
        leave-active-class="transition-all duration-350 ease-in"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="showFilters" class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Left Column: Geometry Filters -->
        <div class="grid grid-cols-3 gap-2 items-center max-w-sm">
          <!-- Header Row -->
          <div class="text-xs font-medium text-gray-600 truncate">Filter</div>
          <div class="text-xs font-medium text-gray-600 truncate">Min %</div>
          <div class="text-xs font-medium text-gray-600 truncate">Max %</div>
          
          <!-- Thickness Filter Row -->
          <label class="flex items-center gap-1 cursor-pointer min-w-0">
            <input
              v-model="thicknessEnabled"
              type="checkbox"
              class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 flex-shrink-0"
            />
            <span class="text-sm font-medium text-gray-700 truncate">Thickness</span>
          </label>
          <div class="flex items-center gap-1">
            <VInput
              v-model.number="thicknessMin"
              type="number"
              step="1"
              min="0"
              max="100"
              placeholder="0"
              size="sm"
              wrapper-class="w-20"
              :disabled="!thicknessEnabled"
            />
          </div>
          <div class="flex items-center gap-1">
            <VInput
              v-model.number="thicknessMax"
              type="number"
              step="1"
              min="0"
              max="100"
              placeholder="0"
              size="sm"
              wrapper-class="w-20"
              :disabled="!thicknessEnabled"
            />
          </div>

          <!-- Camber Filter Row -->
          <label class="flex items-center gap-1 cursor-pointer min-w-0">
            <input
              v-model="camberEnabled"
              type="checkbox"
              class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 flex-shrink-0"
            />
            <span class="text-sm font-medium text-gray-700 truncate">Camber</span>
          </label>
          <div class="flex items-center gap-1">
            <VInput
              v-model.number="camberMin"
              type="number"
              step="1"
              min="0"
              max="100"
              placeholder="0"
              size="sm"
              wrapper-class="w-20"
              :disabled="!camberEnabled"
            />
          </div>
          <div class="flex items-center gap-1">
            <VInput
              v-model.number="camberMax"
              type="number"
              step="1"
              min="0"
              max="100"
              placeholder="0"
              size="sm"
              wrapper-class="w-20"
              :disabled="!camberEnabled"
            />
          </div>
        </div>

        <!-- Right Column: Category Filter -->
        <div class="flex flex-col gap-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="categoryEnabled"
              type="checkbox"
              class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <span class="text-sm font-medium text-gray-700">
              Category
              <span class="text-xs text-gray-500 ml-1">(Use Ctrl+Click to select multiple)</span>
            </span>
          </label>
          <select
            v-model="selectedCategoryIds"
            multiple
            :disabled="!categoryEnabled"
            class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option v-for="category in allCategories" :key="category.id" :value="category.id">
              {{ formatCategoryName(category.name) }}
            </option>
          </select>
        </div>
      </div>
        </Transition>
    </div>
  </div>
</template>

