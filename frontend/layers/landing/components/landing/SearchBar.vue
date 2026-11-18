<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import type { Database } from '~/types/database.types'
import { formatCategoryName } from '~/utils/categoryUtils'

type Category = Database['public']['Tables']['categories']['Row']

const route = useRoute()
const { fetchCategories } = useCategories()

// Search query state
const searchQuery = ref((route.query.q as string) || '')

// Filter states (geometry ranges in percent of chord)
const ranges = [
  { key: 'thickness', label: 'Thickness', enabled: ref(false), min: ref<number | undefined>(), max: ref<number | undefined>() },
  { key: 'camber', label: 'Camber', enabled: ref(false), min: ref<number | undefined>(), max: ref<number | undefined>() },
  { key: 'area', label: 'Area', enabled: ref(false), min: ref<number | undefined>(), max: ref<number | undefined>() },
]

const categoryEnabled = ref(false)
const selectedCategoryIds = ref<string[]>([])
const allCategories = ref<Category[]>([])

// Mobile only: the rail is always visible on lg+
const showFilters = ref(false)

// Helper functions to convert between display (percentage) and database (decimal) format
const percentageToDecimal = (value: number): number => value / 100

// Initialize from URL params on mount
onMounted(async () => {
  // Fetch all categories
  try {
    allCategories.value = await fetchCategories()
  } catch (err) {
    console.error('Error fetching categories:', err)
  }

  // Check geometry filters; URL stores percentage values (10 for 10%)
  for (const r of ranges) {
    const minQ = route.query[`${r.key}Min`] as string
    const maxQ = route.query[`${r.key}Max`] as string
    if (minQ || maxQ) {
      r.enabled.value = true
      r.min.value = minQ ? parseFloat(minQ) : undefined
      r.max.value = maxQ ? parseFloat(maxQ) : undefined
    }
  }

  // Check category filters
  if (route.query.categoryIds) {
    categoryEnabled.value = true
    const categoryIdsStr = route.query.categoryIds as string
    selectedCategoryIds.value = categoryIdsStr.split(',')
  }
})

// Watch checkbox toggles - disable filters when unchecked
for (const r of ranges) {
  watch(r.enabled, (enabled) => {
    if (!enabled) {
      r.min.value = undefined
      r.max.value = undefined
      updateURL()
    }
  })
}

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

// Debounced update for search input (500ms delay)
const debouncedSearchUpdate = useDebounceFn(() => {
  updateURL()
}, 500)

// Watch search query for search-as-you-type
watch(searchQuery, () => {
  debouncedSearchUpdate()
})

// Watch number inputs with debouncing
for (const r of ranges) {
  watch([r.min, r.max], () => {
    if (r.enabled.value) {
      // Only update if at least one value is set
      if (r.min.value !== undefined || r.max.value !== undefined) {
        debouncedUpdate()
      } else {
        // If both are cleared, update immediately to remove params
        updateURL()
      }
    }
  })
}

// Checkbox list: ticking any category enables the category filter
watch(selectedCategoryIds, (ids) => {
  categoryEnabled.value = ids.length > 0
  updateURL()
})

// Update URL function - stores percentage values (10 for 10%) in URL
const updateURL = () => {
  const query: Record<string, string> = {}

  // Keep the chosen sort; this query replaces the whole URL
  for (const k of ['sortBy', 'sortDir'])
    if (typeof route.query[k] === 'string') query[k] = route.query[k] as string

  // Add search query if present
  if (searchQuery.value.trim()) {
    query.q = searchQuery.value.trim()
  }

  // Add geometry filters if enabled (store as percentage in URL)
  for (const r of ranges) {
    if (!r.enabled.value)
      continue
    if (r.min.value !== undefined && r.min.value !== null)
      query[`${r.key}Min`] = r.min.value.toString()
    if (r.max.value !== undefined && r.max.value !== null)
      query[`${r.key}Max`] = r.max.value.toString()
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

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' ||
    ranges.some(r => r.enabled.value) ||
    categoryEnabled.value
})

// Clear all filters
const clearFilters = () => {
  searchQuery.value = ''
  for (const r of ranges) {
    r.enabled.value = false
    r.min.value = undefined
    r.max.value = undefined
  }
  categoryEnabled.value = false
  selectedCategoryIds.value = []
  updateURL()
}

function formatRange(min?: number, max?: number) {
  if (min !== undefined && max !== undefined)
    return `${min}–${max}%`
  return min !== undefined ? `≥ ${min}%` : `≤ ${max}%`
}

// Chips for the active-filter summary; removing one goes through the same state the controls use
const activeFilters = computed(() => {
  const chips: { key: string; label: string; remove: () => void }[] = []
  if (searchQuery.value.trim()) {
    chips.push({
      key: 'q',
      label: `“${searchQuery.value.trim()}”`,
      remove: () => {
        searchQuery.value = ''
        updateURL()
      },
    })
  }
  for (const r of ranges) {
    if (r.enabled.value && (r.min.value !== undefined || r.max.value !== undefined)) {
      chips.push({
        key: r.key,
        label: `${r.label} ${formatRange(r.min.value, r.max.value)}`,
        remove: () => {
          r.enabled.value = false
        },
      })
    }
  }
  for (const id of selectedCategoryIds.value) {
    const name = allCategories.value.find(c => c.id === id)?.name
    chips.push({
      key: `cat-${id}`,
      label: name ? formatCategoryName(name) : 'Category',
      remove: () => {
        selectedCategoryIds.value = selectedCategoryIds.value.filter(c => c !== id)
      },
    })
  }
  return chips
})

const filterCount = computed(() => activeFilters.value.filter(c => c.key !== 'q').length)
</script>

<template>
  <div class="lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:items-start lg:gap-6">
    <!-- Filter rail -->
    <aside
      id="search-filters"
      class="mb-4 lg:sticky lg:top-20 lg:mb-0 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
      :class="showFilters ? 'block' : 'hidden'"
      aria-label="Filters"
    >
      <VPanel title="Filters">
        <template v-if="hasActiveFilters" #actions>
          <button
            type="button"
            class="rounded text-sm font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            @click="clearFilters"
          >
            Clear all
          </button>
        </template>

        <div class="space-y-5">
          <!-- Geometry ranges (percent of chord) -->
          <fieldset v-for="r in ranges" :key="r.key">
            <legend class="w-full">
              <label class="flex cursor-pointer items-center gap-2">
                <input
                  v-model="r.enabled.value"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                >
                <span class="text-sm font-medium text-gray-900">{{ r.label }}</span>
                <span class="ml-auto text-xs text-gray-500">%</span>
              </label>
            </legend>
            <div class="mt-2 grid grid-cols-2 gap-2">
              <VInput
                v-model.number="r.min.value"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="Min"
                :aria-label="`${r.label} minimum %`"
                size="md"
                class="num"
                :disabled="!r.enabled.value"
              />
              <VInput
                v-model.number="r.max.value"
                type="number"
                step="1"
                min="0"
                max="100"
                placeholder="Max"
                :aria-label="`${r.label} maximum %`"
                size="md"
                class="num"
                :disabled="!r.enabled.value"
              />
            </div>
          </fieldset>

          <!-- Categories -->
          <fieldset>
            <legend class="text-sm font-medium text-gray-900">
              Category
            </legend>
            <div class="mt-2 max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-gray-200 p-1">
              <label
                v-for="category in allCategories"
                :key="category.id"
                class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <input
                  v-model="selectedCategoryIds"
                  type="checkbox"
                  :value="category.id"
                  class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                >
                {{ formatCategoryName(category.name) }}
              </label>
              <p v-if="!allCategories.length" class="px-2 py-1.5 text-sm text-gray-500">
                No categories
              </p>
            </div>
          </fieldset>
        </div>
      </VPanel>
    </aside>

    <div class="min-w-0 lg:col-start-2 lg:row-start-1">
      <!-- Search Input Row -->
      <div class="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <VInput
          v-model="searchQuery"
          placeholder="Search for an airfoil..."
          aria-label="Search airfoils"
          type="search"
          prepend-icon="heroicons:magnifying-glass"
          wrapper-class="w-full min-w-0 sm:w-auto sm:flex-1"
          @keydown="handleKeydown"
        />
        <VButton
          type="button"
          class="flex-1 sm:flex-none lg:hidden"
          :aria-expanded="showFilters"
          aria-controls="search-filters"
          @click="showFilters = !showFilters"
        >
          <Icon name="heroicons:adjustments-horizontal" class="mr-1.5 h-4 w-4" />
          Filters
          <span v-if="filterCount" class="num ml-1.5 rounded-full bg-primary-600 px-1.5 text-xs text-white">{{ filterCount }}</span>
        </VButton>
        <VButton
          type="button"
          color="primary"
          class="flex-1 sm:flex-none"
          @click="handleSearch"
        >
          Search
        </VButton>
      </div>

      <slot name="toolbar" />

      <!-- Active filters -->
      <div v-if="activeFilters.length" class="mb-4 flex flex-wrap items-center gap-2">
        <span class="data-label">Active</span>
        <button
          v-for="chip in activeFilters"
          :key="chip.key"
          type="button"
          class="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          :aria-label="`Remove filter ${chip.label}`"
          @click="chip.remove"
        >
          {{ chip.label }}
          <Icon name="heroicons:x-mark" class="h-3.5 w-3.5 text-gray-400" />
        </button>
        <button
          type="button"
          class="rounded text-xs font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          @click="clearFilters"
        >
          Clear all
        </button>
      </div>

      <slot :clear-filters="clearFilters" />
    </div>
  </div>
</template>
