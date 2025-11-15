<script setup lang="ts">
import type { Database } from '~/types/database.types'

type PerformanceCache = Database['public']['Tables']['performance_cache']['Row']

interface Props {
  airfoilId: string
}

const emit = defineEmits<{
  'selection-change': [entries: any[]]
}>()

const props = defineProps<Props>()

const supabase = useSupabaseClient<Database>()

const cacheEntries = ref<PerformanceCache[]>([])
const selectedEntries = ref<string[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Filter state - now arrays for multi-select
const filters = ref({
  re: [] as number[],
  mach: [] as number[],
  ncrit: [] as number[],
  aoaMin: [] as number[],
  aoaMax: [] as number[],
  flapDeflection: [] as number[],
  flapFraction: [] as number[],
})

// Filtered entries cache
const filteredEntriesCache = ref<any[]>([])

// Dropdown state for Excel-style filters
const openFilterColumn = ref<string | null>(null)

/**
 * Toggle filter dropdown for a specific column
 */
const toggleFilterDropdown = (column: string) => {
  if (openFilterColumn.value === column) {
    openFilterColumn.value = null
  } else {
    openFilterColumn.value = column
  }
}

/**
 * Close the filter dropdown
 */
const closeFilterDropdown = () => {
  openFilterColumn.value = null
}

/**
 * Extract Re from inputs
 */
const extractRe = (inputs: any): number | null => {
  if (!inputs || inputs.Re === undefined || inputs.Re === null) return null
  return inputs.Re
}

/**
 * Extract Mach from inputs
 */
const extractMach = (inputs: any): number | null => {
  if (!inputs || inputs.Mach === undefined || inputs.Mach === null) return null
  return inputs.Mach
}

/**
 * Extract Ncrit from inputs
 */
const extractNcrit = (inputs: any): number | null => {
  if (!inputs || inputs.n_crit === undefined || inputs.n_crit === null) return null
  return inputs.n_crit
}

/**
 * Extract AoA Min from inputs (from alpha_range[0])
 */
const extractAoaMin = (inputs: any): number | null => {
  if (!inputs || !Array.isArray(inputs.alpha_range) || inputs.alpha_range.length < 1) return null
  return inputs.alpha_range[0]
}

/**
 * Extract AoA Max from inputs (from alpha_range[1])
 */
const extractAoaMax = (inputs: any): number | null => {
  if (!inputs || !Array.isArray(inputs.alpha_range) || inputs.alpha_range.length < 2) return null
  return inputs.alpha_range[1]
}

/**
 * Extract Flap Deflection from inputs
 */
const extractFlapDeflection = (inputs: any): number | null => {
  if (!inputs) return null
  const deflection = inputs.deflection ?? inputs.control_surface_deflection ?? null
  return deflection
}

/**
 * Extract Flap Fraction from inputs
 */
const extractFlapFraction = (inputs: any): number | null => {
  if (!inputs) return null
  const fraction = inputs.flap_fraction ?? inputs.control_surface_fraction ?? null
  return fraction
}

/**
 * Format condition inputs into readable string (kept for compatibility)
 */
const formatCondition = (inputs: any): string => {
  if (!inputs || typeof inputs !== 'object') return 'Unknown conditions'
  
  const parts: string[] = []
  
  // Re (Reynolds number) - format as "50k" if >= 1000
  if (inputs.Re !== undefined && inputs.Re !== null) {
    const re = inputs.Re
    if (re >= 1000) {
      parts.push(`Re ${(re / 1000).toFixed(0)}k`)
    } else {
      parts.push(`Re ${re.toFixed(0)}`)
    }
  }
  
  // Mach
  if (inputs.Mach !== undefined && inputs.Mach !== null) {
    parts.push(`Mach ${inputs.Mach.toFixed(1)}`)
  }
  
  // Ncrit
  if (inputs.n_crit !== undefined && inputs.n_crit !== null) {
    parts.push(`Ncrit ${inputs.n_crit.toFixed(0)}`)
  }
  
  // Alpha range - format as "AoA Range [start, end]"
  if (inputs.alpha_range && Array.isArray(inputs.alpha_range) && inputs.alpha_range.length === 3) {
    const [start, end] = inputs.alpha_range
    parts.push(`AoA Range [${start.toFixed(0)}, ${end.toFixed(0)}]`)
  }
  
  // Control surface fraction and deflection - check both variable names for compatibility
  // Prefer 'deflection' and 'flap_fraction' (newer) over 'control_surface_*' (legacy)
  const csDef = inputs.deflection ?? inputs.control_surface_deflection ?? 0
  if (csDef !== 0) {
    const csFrac = inputs.flap_fraction ?? inputs.control_surface_fraction ?? 0
    parts.push(`Flap Fraction ${csFrac.toFixed(2)}`)
    parts.push(`Flap Deflection ${csDef.toFixed(1)}°`)
  }
  
  return parts.join(', ')
}

/**
 * Compute unique values for each column (sorted arrays)
 */
const uniqueReValues = computed(() => {
  const values = new Set<number>()
  ;(cacheEntries.value as any[]).forEach(entry => {
    const re = extractRe(entry.inputs)
    if (re !== null) values.add(re)
  })
  return Array.from(values).sort((a, b) => a - b)
})

const uniqueMachValues = computed(() => {
  const values = new Set<number>()
  ;(cacheEntries.value as any[]).forEach(entry => {
    const mach = extractMach(entry.inputs)
    if (mach !== null) values.add(mach)
  })
  return Array.from(values).sort((a, b) => a - b)
})

const uniqueNcritValues = computed(() => {
  const values = new Set<number>()
  ;(cacheEntries.value as any[]).forEach(entry => {
    const ncrit = extractNcrit(entry.inputs)
    if (ncrit !== null) values.add(ncrit)
  })
  return Array.from(values).sort((a, b) => a - b)
})

const uniqueAoaMinValues = computed(() => {
  const values = new Set<number>()
  ;(cacheEntries.value as any[]).forEach(entry => {
    const aoaMin = extractAoaMin(entry.inputs)
    if (aoaMin !== null) values.add(aoaMin)
  })
  return Array.from(values).sort((a, b) => a - b)
})

const uniqueAoaMaxValues = computed(() => {
  const values = new Set<number>()
  ;(cacheEntries.value as any[]).forEach(entry => {
    const aoaMax = extractAoaMax(entry.inputs)
    if (aoaMax !== null) values.add(aoaMax)
  })
  return Array.from(values).sort((a, b) => a - b)
})

const uniqueFlapDeflectionValues = computed(() => {
  const values = new Set<number>()
  ;(cacheEntries.value as any[]).forEach(entry => {
    const flapDef = extractFlapDeflection(entry.inputs)
    if (flapDef !== null) values.add(flapDef)
  })
  return Array.from(values).sort((a, b) => a - b)
})

const uniqueFlapFractionValues = computed(() => {
  const values = new Set<number>()
  ;(cacheEntries.value as any[]).forEach(entry => {
    const flapFrac = extractFlapFraction(entry.inputs)
    if (flapFrac !== null) values.add(flapFrac)
  })
  return Array.from(values).sort((a, b) => a - b)
})

/**
 * Filter a single entry against current filter state
 */
const matchesFilters = (entry: PerformanceCache): boolean => {
  const re = extractRe(entry.inputs)
  const mach = extractMach(entry.inputs)
  const ncrit = extractNcrit(entry.inputs)
  const aoaMin = extractAoaMin(entry.inputs)
  const aoaMax = extractAoaMax(entry.inputs)
  const flapDef = extractFlapDeflection(entry.inputs)
  const flapFrac = extractFlapFraction(entry.inputs)
  
  // For multi-select filters: if array is empty, include all; if array has values, must match one
  if (filters.value.re.length > 0 && !filters.value.re.includes(re ?? -Infinity)) return false
  if (filters.value.mach.length > 0 && !filters.value.mach.includes(mach ?? -Infinity)) return false
  if (filters.value.ncrit.length > 0 && !filters.value.ncrit.includes(ncrit ?? -Infinity)) return false
  if (filters.value.aoaMin.length > 0 && !filters.value.aoaMin.includes(aoaMin ?? -Infinity)) return false
  if (filters.value.aoaMax.length > 0 && !filters.value.aoaMax.includes(aoaMax ?? -Infinity)) return false
  if (filters.value.flapDeflection.length > 0 && !filters.value.flapDeflection.includes(flapDef ?? -Infinity)) return false
  if (filters.value.flapFraction.length > 0 && !filters.value.flapFraction.includes(flapFrac ?? -Infinity)) return false
  
  return true
}

/**
 * Update filtered entries when cache changes
 */
watch(cacheEntries, () => {
  filteredEntriesCache.value = (cacheEntries.value as any[]).filter(matchesFilters)
})

/**
 * Update filtered entries when filters change (watch filters.value object)
 */
watch(
  () => JSON.stringify(filters.value),
  () => {
    filteredEntriesCache.value = (cacheEntries.value as any[]).filter(matchesFilters)
  }
)

// Getter for filtered entries
const filteredEntries = computed(() => filteredEntriesCache.value)

/**
 * Fetch all performance cache entries for this airfoil
 */
const fetchCacheEntries = async () => {
  if (!props.airfoilId) return
  
  loading.value = true
  error.value = null
  
  try {
    const { data, error: fetchError } = await supabase
      .from('performance_cache')
      .select('*')
      .eq('airfoil_id', props.airfoilId)
      .order('created_at', { ascending: false })
    
    if (fetchError) {
      throw fetchError
    }
    
    cacheEntries.value = data || []
    
    // Set default selection (0° deflection cases)
    setDefaultSelection()
  } catch (err: any) {
    console.error('Error fetching performance cache:', err)
    error.value = err.message || 'Failed to load performance data'
  } finally {
    loading.value = false
  }
}

/**
 * Toggle a filter value (add/remove from multi-select array)
 */
const toggleFilterValue = (filterKey: keyof typeof filters.value, value: number) => {
  const filterArray = filters.value[filterKey]
  const index = filterArray.indexOf(value)
  if (index >= 0) {
    filterArray.splice(index, 1)
  } else {
    filterArray.push(value)
  }
}

/**
 * Select all values for a filter column
 */
const selectAllFilterValues = (filterKey: keyof typeof filters.value, uniqueValues: number[]) => {
  filters.value[filterKey] = [...uniqueValues]
}

/**
 * Clear all values for a filter column
 */
const clearAllFilterValues = (filterKey: keyof typeof filters.value) => {
  filters.value[filterKey] = []
}

/**
 * Set default selection: only entries with 0° flap deflection
 */
const setDefaultSelection = () => {
  const defaultSelected = (cacheEntries.value as any[])
    .filter(entry => {
      const flapDef = extractFlapDeflection(entry.inputs)
      return flapDef === 0
    })
    .map(entry => entry.id)
  
  selectedEntries.value = defaultSelected
  emitSelectionChange()
}

/**
 * Toggle selection of a cache entry
 */
const toggleSelection = (entryId: string) => {
  const index = selectedEntries.value.indexOf(entryId)
  if (index >= 0) {
    selectedEntries.value.splice(index, 1)
  } else {
    selectedEntries.value.push(entryId)
  }
  emitSelectionChange()
}

/**
 * Select all visible (filtered) entries
 */
const selectAll = () => {
  selectedEntries.value = filteredEntries.value.map(entry => entry.id)
  emitSelectionChange()
}

/**
 * Deselect all visible (filtered) entries
 */
const deselectAll = () => {
  // Remove filtered entries from selection, keep entries not in filtered list
  const filteredIds = new Set(filteredEntries.value.map(entry => entry.id))
  selectedEntries.value = selectedEntries.value.filter(id => !filteredIds.has(id))
  emitSelectionChange()
}

/**
 * Emit selection change event with selected entries data
 */
const emitSelectionChange = () => {
  const selected = (cacheEntries.value as any[]).filter(entry => selectedEntries.value.includes(entry.id))
  emit('selection-change', selected)
}

/**
 * Refresh cache entries
 */
const refresh = async () => {
  await fetchCacheEntries()
}

defineExpose({ refresh })

/**
 * Handle click-outside to close filter dropdowns
 */
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  // Check if click is on the table or its children
  const tableContainer = document.querySelector('[data-filter-table]')
  if (tableContainer && !tableContainer.contains(target)) {
    closeFilterDropdown()
  }
}

/**
 * Handle Escape key to close filter dropdowns
 */
const handleEscapeKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    closeFilterDropdown()
  }
}

// Fetch cache entries when component mounts or airfoilId changes
watch(() => props.airfoilId, () => {
  if (props.airfoilId) {
    fetchCacheEntries()
  }
}, { immediate: true })

onMounted(() => {
  if (props.airfoilId) {
    fetchCacheEntries()
  }
  
  // Add click-outside and escape key handlers
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscapeKey)
})

onUnmounted(() => {
  // Remove event listeners
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscapeKey)
})
</script>

<template>
  <div class="bg-white rounded-lg shadow p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold text-gray-900">Performance Data <span class="text-sm text-gray-300">(Cached)</span></h2>
      <div v-if="filteredEntries.length > 0" class="flex gap-2">
        <button
          type="button"
          class="text-xs text-indigo-600 hover:text-indigo-800"
          @click="selectAll"
        >
          Select All
        </button>
        <span class="text-gray-300">|</span>
        <button
          type="button"
          class="text-xs text-indigo-600 hover:text-indigo-800"
          @click="deselectAll"
        >
          Deselect All
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-8 text-red-600">
      <p>{{ error }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="cacheEntries.length === 0" class="text-center py-8 text-gray-500">
      <p>No existing performance data</p>
    </div>

    <!-- No Matches State -->
    <div v-else-if="filteredEntries.length === 0" class="text-center py-8 text-gray-500">
      <p>No entries match the selected filters</p>
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg relative" data-filter-table>
      <table class="w-full text-sm">
        <!-- Header Row with Filter Icons -->
        <thead class="sticky top-0 bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-4 py-2 text-left font-semibold text-gray-700 w-12">
              <input
                type="checkbox"
                :checked="filteredEntries.length > 0 && filteredEntries.every(e => selectedEntries.includes(e.id))"
                :indeterminate="filteredEntries.some(e => selectedEntries.includes(e.id)) && !filteredEntries.every(e => selectedEntries.includes(e.id))"
                class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                @change="(e: any) => e.target.checked ? selectAll() : deselectAll()"
              />
            </th>
            <!-- Re Column -->
            <th class="px-4 py-2 text-left font-semibold text-gray-700 relative">
              <div class="flex items-center gap-1">
                <span>Re</span>
                <button
                  @click.stop="toggleFilterDropdown('re')"
                  class="relative inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 transition-colors"
                  :class="{ 'bg-indigo-100': filters.re.length > 0 || openFilterColumn === 're' }"
                >
                  <svg class="w-4 h-4" :class="{ 'text-indigo-600': filters.re.length > 0, 'text-gray-500': filters.re.length === 0 }" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                  <span v-if="filters.re.length > 0" class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-indigo-600 rounded-full">
                    {{ filters.re.length }}
                  </span>
                </button>
              </div>
              <!-- Filter Dropdown -->
              <div v-if="openFilterColumn === 're'" class="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-300 rounded shadow-lg z-50">
                <div class="p-3">
                  <div class="flex gap-2 mb-3">
                    <button @click.stop="selectAllFilterValues('re', uniqueReValues)" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Select All</button>
                    <button @click.stop="clearAllFilterValues('re')" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Clear</button>
                  </div>
                  <div class="max-h-40 overflow-y-auto space-y-1">
                    <label v-for="val in uniqueReValues" :key="val" class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded text-sm">
                      <input
                        type="checkbox"
                        :checked="filters.re.includes(val)"
                        @change="toggleFilterValue('re', val)"
                        class="w-3 h-3 text-indigo-600 border-gray-300 rounded"
                      />
                      <span>{{ val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </th>
            <!-- Mach Column -->
            <th class="px-4 py-2 text-left font-semibold text-gray-700 relative">
              <div class="flex items-center gap-1">
                <span>Mach</span>
                <button
                  @click.stop="toggleFilterDropdown('mach')"
                  class="relative inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 transition-colors"
                  :class="{ 'bg-indigo-100': filters.mach.length > 0 || openFilterColumn === 'mach' }"
                >
                  <svg class="w-4 h-4" :class="{ 'text-indigo-600': filters.mach.length > 0, 'text-gray-500': filters.mach.length === 0 }" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                  <span v-if="filters.mach.length > 0" class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-indigo-600 rounded-full">
                    {{ filters.mach.length }}
                  </span>
                </button>
              </div>
              <!-- Filter Dropdown -->
              <div v-if="openFilterColumn === 'mach'" class="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-300 rounded shadow-lg z-50">
                <div class="p-3">
                  <div class="flex gap-2 mb-3">
                    <button @click.stop="selectAllFilterValues('mach', uniqueMachValues)" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Select All</button>
                    <button @click.stop="clearAllFilterValues('mach')" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Clear</button>
                  </div>
                  <div class="max-h-40 overflow-y-auto space-y-1">
                    <label v-for="val in uniqueMachValues" :key="val" class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded text-sm">
                      <input
                        type="checkbox"
                        :checked="filters.mach.includes(val)"
                        @change="toggleFilterValue('mach', val)"
                        class="w-3 h-3 text-indigo-600 border-gray-300 rounded"
                      />
                      <span>{{ val.toFixed(2) }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </th>
            <!-- Ncrit Column -->
            <th class="px-4 py-2 text-left font-semibold text-gray-700 relative">
              <div class="flex items-center gap-1">
                <span>Ncrit</span>
                <button
                  @click.stop="toggleFilterDropdown('ncrit')"
                  class="relative inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 transition-colors"
                  :class="{ 'bg-indigo-100': filters.ncrit.length > 0 || openFilterColumn === 'ncrit' }"
                >
                  <svg class="w-4 h-4" :class="{ 'text-indigo-600': filters.ncrit.length > 0, 'text-gray-500': filters.ncrit.length === 0 }" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                  <span v-if="filters.ncrit.length > 0" class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-indigo-600 rounded-full">
                    {{ filters.ncrit.length }}
                  </span>
                </button>
              </div>
              <!-- Filter Dropdown -->
              <div v-if="openFilterColumn === 'ncrit'" class="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-300 rounded shadow-lg z-50">
                <div class="p-3">
                  <div class="flex gap-2 mb-3">
                    <button @click.stop="selectAllFilterValues('ncrit', uniqueNcritValues)" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Select All</button>
                    <button @click.stop="clearAllFilterValues('ncrit')" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Clear</button>
                  </div>
                  <div class="max-h-40 overflow-y-auto space-y-1">
                    <label v-for="val in uniqueNcritValues" :key="val" class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded text-sm">
                      <input
                        type="checkbox"
                        :checked="filters.ncrit.includes(val)"
                        @change="toggleFilterValue('ncrit', val)"
                        class="w-3 h-3 text-indigo-600 border-gray-300 rounded"
                      />
                      <span>{{ val }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </th>
            <!-- AoA Min Column -->
            <th class="px-4 py-2 text-left font-semibold text-gray-700 relative">
              <div class="flex items-center gap-1">
                <span>AoA Min</span>
                <button
                  @click.stop="toggleFilterDropdown('aoaMin')"
                  class="relative inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 transition-colors"
                  :class="{ 'bg-indigo-100': filters.aoaMin.length > 0 || openFilterColumn === 'aoaMin' }"
                >
                  <svg class="w-4 h-4" :class="{ 'text-indigo-600': filters.aoaMin.length > 0, 'text-gray-500': filters.aoaMin.length === 0 }" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                  <span v-if="filters.aoaMin.length > 0" class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-indigo-600 rounded-full">
                    {{ filters.aoaMin.length }}
                  </span>
                </button>
              </div>
              <!-- Filter Dropdown -->
              <div v-if="openFilterColumn === 'aoaMin'" class="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-300 rounded shadow-lg z-50">
                <div class="p-3">
                  <div class="flex gap-2 mb-3">
                    <button @click.stop="selectAllFilterValues('aoaMin', uniqueAoaMinValues)" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Select All</button>
                    <button @click.stop="clearAllFilterValues('aoaMin')" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Clear</button>
                  </div>
                  <div class="max-h-40 overflow-y-auto space-y-1">
                    <label v-for="val in uniqueAoaMinValues" :key="val" class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded text-sm">
                      <input
                        type="checkbox"
                        :checked="filters.aoaMin.includes(val)"
                        @change="toggleFilterValue('aoaMin', val)"
                        class="w-3 h-3 text-indigo-600 border-gray-300 rounded"
                      />
                      <span>{{ val.toFixed(1) }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </th>
            <!-- AoA Max Column -->
            <th class="px-4 py-2 text-left font-semibold text-gray-700 relative">
              <div class="flex items-center gap-1">
                <span>AoA Max</span>
                <button
                  @click.stop="toggleFilterDropdown('aoaMax')"
                  class="relative inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 transition-colors"
                  :class="{ 'bg-indigo-100': filters.aoaMax.length > 0 || openFilterColumn === 'aoaMax' }"
                >
                  <svg class="w-4 h-4" :class="{ 'text-indigo-600': filters.aoaMax.length > 0, 'text-gray-500': filters.aoaMax.length === 0 }" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                  <span v-if="filters.aoaMax.length > 0" class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-indigo-600 rounded-full">
                    {{ filters.aoaMax.length }}
                  </span>
                </button>
              </div>
              <!-- Filter Dropdown -->
              <div v-if="openFilterColumn === 'aoaMax'" class="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-300 rounded shadow-lg z-50">
                <div class="p-3">
                  <div class="flex gap-2 mb-3">
                    <button @click.stop="selectAllFilterValues('aoaMax', uniqueAoaMaxValues)" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Select All</button>
                    <button @click.stop="clearAllFilterValues('aoaMax')" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Clear</button>
                  </div>
                  <div class="max-h-40 overflow-y-auto space-y-1">
                    <label v-for="val in uniqueAoaMaxValues" :key="val" class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded text-sm">
                      <input
                        type="checkbox"
                        :checked="filters.aoaMax.includes(val)"
                        @change="toggleFilterValue('aoaMax', val)"
                        class="w-3 h-3 text-indigo-600 border-gray-300 rounded"
                      />
                      <span>{{ val.toFixed(1) }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </th>
            <!-- Flap Deflection Column -->
            <th class="px-4 py-2 text-left font-semibold text-gray-700 relative">
              <div class="flex items-center gap-1">
                <span>Flap Deflection</span>
                <button
                  @click.stop="toggleFilterDropdown('flapDeflection')"
                  class="relative inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 transition-colors"
                  :class="{ 'bg-indigo-100': filters.flapDeflection.length > 0 || openFilterColumn === 'flapDeflection' }"
                >
                  <svg class="w-4 h-4" :class="{ 'text-indigo-600': filters.flapDeflection.length > 0, 'text-gray-500': filters.flapDeflection.length === 0 }" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                  <span v-if="filters.flapDeflection.length > 0" class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-indigo-600 rounded-full">
                    {{ filters.flapDeflection.length }}
                  </span>
                </button>
              </div>
              <!-- Filter Dropdown -->
              <div v-if="openFilterColumn === 'flapDeflection'" class="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-300 rounded shadow-lg z-50">
                <div class="p-3">
                  <div class="flex gap-2 mb-3">
                    <button @click.stop="selectAllFilterValues('flapDeflection', uniqueFlapDeflectionValues)" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Select All</button>
                    <button @click.stop="clearAllFilterValues('flapDeflection')" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Clear</button>
                  </div>
                  <div class="max-h-40 overflow-y-auto space-y-1">
                    <label v-for="val in uniqueFlapDeflectionValues" :key="val" class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded text-sm">
                      <input
                        type="checkbox"
                        :checked="filters.flapDeflection.includes(val)"
                        @change="toggleFilterValue('flapDeflection', val)"
                        class="w-3 h-3 text-indigo-600 border-gray-300 rounded"
                      />
                      <span>{{ val.toFixed(1) }}°</span>
                    </label>
                  </div>
                </div>
              </div>
            </th>
            <!-- Flap Fraction Column -->
            <th class="px-4 py-2 text-left font-semibold text-gray-700 relative">
              <div class="flex items-center gap-1">
                <span>Flap Fraction</span>
                <button
                  @click.stop="toggleFilterDropdown('flapFraction')"
                  class="relative inline-flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 transition-colors"
                  :class="{ 'bg-indigo-100': filters.flapFraction.length > 0 || openFilterColumn === 'flapFraction' }"
                >
                  <svg class="w-4 h-4" :class="{ 'text-indigo-600': filters.flapFraction.length > 0, 'text-gray-500': filters.flapFraction.length === 0 }" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                  <span v-if="filters.flapFraction.length > 0" class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-indigo-600 rounded-full">
                    {{ filters.flapFraction.length }}
                  </span>
                </button>
              </div>
              <!-- Filter Dropdown -->
              <div v-if="openFilterColumn === 'flapFraction'" class="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-300 rounded shadow-lg z-50">
                <div class="p-3">
                  <div class="flex gap-2 mb-3">
                    <button @click.stop="selectAllFilterValues('flapFraction', uniqueFlapFractionValues)" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Select All</button>
                    <button @click.stop="clearAllFilterValues('flapFraction')" class="flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors">Clear</button>
                  </div>
                  <div class="max-h-40 overflow-y-auto space-y-1">
                    <label v-for="val in uniqueFlapFractionValues" :key="val" class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded text-sm">
                      <input
                        type="checkbox"
                        :checked="filters.flapFraction.includes(val)"
                        @change="toggleFilterValue('flapFraction', val)"
                        class="w-3 h-3 text-indigo-600 border-gray-300 rounded"
                      />
                      <span>{{ val.toFixed(2) }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </th>
            <th class="px-4 py-2 text-left font-semibold text-gray-700">Cached</th>
          </tr>
        </thead>
        <!-- Data Rows -->
        <tbody>
          <tr
            v-for="entry in filteredEntries"
        :key="entry.id"
            class="border-b border-gray-200 hover:bg-gray-50 transition-colors"
      >
            <td class="px-4 py-2">
        <input
          type="checkbox"
          :checked="selectedEntries.includes(entry.id)"
          class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          @change="toggleSelection(entry.id)"
        />
            </td>
            <td class="px-4 py-2 text-gray-900">
              {{ extractRe(entry.inputs) !== null ? (extractRe(entry.inputs)! >= 1000 ? (extractRe(entry.inputs)! / 1000).toFixed(0) + 'k' : extractRe(entry.inputs)) : 'N/A' }}
            </td>
            <td class="px-4 py-2 text-gray-900">
              {{ extractMach(entry.inputs)?.toFixed(2) ?? 'N/A' }}
            </td>
            <td class="px-4 py-2 text-gray-900">
              {{ extractNcrit(entry.inputs) ?? 'N/A' }}
            </td>
            <td class="px-4 py-2 text-gray-900">
              {{ extractAoaMin(entry.inputs)?.toFixed(1) ?? 'N/A' }}
            </td>
            <td class="px-4 py-2 text-gray-900">
              {{ extractAoaMax(entry.inputs)?.toFixed(1) ?? 'N/A' }}
            </td>
            <td class="px-4 py-2 text-gray-900">
              {{ extractFlapDeflection(entry.inputs)?.toFixed(1) ?? 'N/A' }}°
            </td>
            <td class="px-4 py-2 text-gray-900">
              {{ extractFlapFraction(entry.inputs)?.toFixed(2) ?? 'N/A' }}
            </td>
            <td class="px-4 py-2 text-gray-900 whitespace-nowrap">
              {{ entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'N/A' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

