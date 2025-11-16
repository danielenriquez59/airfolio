<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'

const route = useRoute()

// Search query state
const searchQuery = ref((route.query.q as string) || '')

// Filter states
const thicknessEnabled = ref(false)
const thicknessMin = ref<number | undefined>()
const thicknessMax = ref<number | undefined>()

const camberEnabled = ref(false)
const camberMin = ref<number | undefined>()
const camberMax = ref<number | undefined>()

// Helper functions to convert between display (percentage) and database (decimal) format
const percentageToDecimal = (value: number): number => value / 100
const decimalToPercentage = (value: number): number => value * 100

// Initialize from URL params on mount
onMounted(() => {
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
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
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

      <!-- Filter Rows -->
      <div class="grid grid-cols-3 gap-4 items-center max-w-xs">
        <!-- Header Row -->
        <div class="text-xs font-medium text-gray-600">Filter</div>
        <div class="text-xs font-medium text-gray-600">Min %</div>
        <div class="text-xs font-medium text-gray-600">Max %</div>
        
        <!-- Thickness Filter Row -->
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="thicknessEnabled"
            type="checkbox"
            class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700">Thickness</span>
        </label>
        <div class="flex items-center gap-2">
          <VInput
            v-model.number="thicknessMin"
            type="number"
            step="1"
            min="0"
            max="100"
            placeholder="0"
            size="sm"
            wrapper-class="w-24"
            :disabled="!thicknessEnabled"
          />
        </div>
        <div class="flex items-center gap-2">
          <VInput
            v-model.number="thicknessMax"
            type="number"
            step="1"
            min="0"
            max="100"
            placeholder="0"
            size="sm"
            wrapper-class="w-24"
            :disabled="!thicknessEnabled"
          />
        </div>

        <!-- Camber Filter Row -->
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="camberEnabled"
            type="checkbox"
            class="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <span class="text-sm font-medium text-gray-700">Camber</span>
        </label>
        <div class="flex items-center gap-2">
          <VInput
            v-model.number="camberMin"
            type="number"
            step="1"
            min="0"
            max="100"
            placeholder="0"
            size="sm"
            wrapper-class="w-24"
            :disabled="!camberEnabled"
          />
        </div>
        <div class="flex items-center gap-2">
          <VInput
            v-model.number="camberMax"
            type="number"
            step="1"
            min="0"
            max="100"
            placeholder="0"
            size="sm"
            wrapper-class="w-24"
            :disabled="!camberEnabled"
          />
        </div>
      </div>
    </div>
  </div>
</template>

