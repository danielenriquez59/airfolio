<script setup lang="ts">
import type { Database } from '~/types/database.types'
import { microButtonClasses } from '~/layers/ui/utils/buttons'
import { flapDeflection, formatCondition } from '~/utils/formatCondition'

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
})

type FilterKey = keyof typeof filters.value

const alphaAt = (inputs: any, i: number): number | null =>
  Array.isArray(inputs?.alpha_range) && inputs.alpha_range.length > i ? inputs.alpha_range[i] : null

/** Filterable columns: value read from performance_cache.inputs, and how it is shown in cells and dropdowns */
const columns: { key: FilterKey, label: string, get: (inputs: any) => number | null, format: (v: number) => string }[] = [
  { key: 're', label: 'Re', get: i => i?.Re ?? null, format: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v) },
  { key: 'mach', label: 'Mach', get: i => i?.Mach ?? null, format: v => v.toFixed(2) },
  { key: 'ncrit', label: 'Ncrit', get: i => i?.n_crit ?? null, format: v => String(v) },
  { key: 'aoaMin', label: 'AoA Min', get: i => alphaAt(i, 0), format: v => v.toFixed(1) },
  { key: 'aoaMax', label: 'AoA Max', get: i => alphaAt(i, 1), format: v => v.toFixed(1) },
]

const openColumn = computed(() => columns.find(c => c.key === openFilterColumn.value))

// Filtered entries cache
const filteredEntriesCache = ref<any[]>([])

// Dropdown state for Excel-style filters
const openFilterColumn = ref<string | null>(null)

// Filter buttons, to calculate dropdown position
const filterButtons: Record<string, HTMLElement | null> = {}

// Dropdown position state
const dropdownPosition = ref<{ top: string; left: string } | null>(null)

/**
 * Toggle filter dropdown for a specific column
 */
const toggleFilterDropdown = (column: string) => {
  if (openFilterColumn.value === column) {
    openFilterColumn.value = null
    dropdownPosition.value = null
  } else {
    openFilterColumn.value = column
    updateDropdownPosition(column)
  }
}

/**
 * Calculate and update dropdown position based on button location
 */
const updateDropdownPosition = async (column: string) => {
  await nextTick()

  const buttonRef = filterButtons[column]
  if (buttonRef) {
    const rect = buttonRef.getBoundingClientRect()
    dropdownPosition.value = {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`
    }
  }
}

/**
 * Close the filter dropdown
 */
const closeFilterDropdown = () => {
  openFilterColumn.value = null
  dropdownPosition.value = null
}

/**
 * Unique values of a column across all entries (sorted)
 */
const uniqueValues = (col: typeof columns[number]): number[] => {
  const values = new Set<number>()
  ;(cacheEntries.value as any[]).forEach(entry => {
    const v = col.get(entry.inputs)
    if (v !== null) values.add(v)
  })
  return Array.from(values).sort((a, b) => a - b)
}

/**
 * Filter a single entry against current filter state
 */
const matchesFilters = (entry: PerformanceCache): boolean => {
  const flapDef = flapDeflection(entry.inputs)

  // Always exclude entries with non-zero flap deflection
  if (flapDef !== null && flapDef !== 0) return false

  // For multi-select filters: if array is empty, include all; if array has values, must match one
  return columns.every(col => {
    const selected = filters.value[col.key]
    return selected.length === 0 || selected.includes(col.get(entry.inputs) ?? -Infinity)
  })
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
    emitSelectionChange()
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
const toggleFilterValue = (filterKey: FilterKey, value: number) => {
  const filterArray = filters.value[filterKey]
  const index = filterArray.indexOf(value)
  if (index >= 0) {
    filterArray.splice(index, 1)
  } else {
    filterArray.push(value)
  }
}

/**
 * Set default selection: only entries with 0° flap deflection
 */
const setDefaultSelection = () => {
  const defaultSelected = (cacheEntries.value as any[])
    .filter(entry => flapDeflection(entry.inputs) === 0)
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
  // Add visible entries; keep ticks on rows hidden by the filters
  selectedEntries.value = [...new Set([...selectedEntries.value, ...filteredEntries.value.map(entry => entry.id)])]
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
  // Only rows that are both visible under the filters and ticked
  const selected = (cacheEntries.value as any[]).filter(entry => matchesFilters(entry) && selectedEntries.value.includes(entry.id))
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
  const tableContainer = document.querySelector('[data-filter-table]')
  const filterDropdown = target.closest('[data-filter-dropdown]')

  if (tableContainer?.contains(target) || filterDropdown) {
    return
  }

  closeFilterDropdown()
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

// Handle scroll and resize to update dropdown position
const handleScrollOrResize = () => {
  if (openFilterColumn.value) {
    updateDropdownPosition(openFilterColumn.value)
  }
}

onMounted(() => {
  if (props.airfoilId) {
    fetchCacheEntries()
  }

  // Add click-outside and escape key handlers
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscapeKey)
  window.addEventListener('scroll', handleScrollOrResize, true)
  window.addEventListener('resize', handleScrollOrResize)
})

onUnmounted(() => {
  // Remove event listeners
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscapeKey)
  window.removeEventListener('scroll', handleScrollOrResize, true)
  window.removeEventListener('resize', handleScrollOrResize)
})
</script>

<template>
  <VPanel
    title="Performance data"
    description="All data generated via NeuralFoil AI-powered aerodynamic analysis"
    flush
  >
    <template #actions>
      <slot name="actions" />
      <template v-if="filteredEntries.length > 0">
        <VButton type="button" variant="ghost" color="light" size="sm" @click="selectAll">
          Select all
        </VButton>
        <VButton type="button" variant="ghost" color="light" size="sm" @click="deselectAll">
          Deselect all
        </VButton>
      </template>
    </template>

    <VStateBlock v-if="loading" variant="loading" />
    <VStateBlock v-else-if="error" variant="error" title="Could not load performance data" :description="error" />
    <VStateBlock
      v-else-if="cacheEntries.length === 0"
      title="No existing performance data"
      description="Run a performance analysis to add results here."
    />
    <VStateBlock v-else-if="filteredEntries.length === 0" title="No entries match the selected filters" icon="heroicons:funnel" />

    <!-- Table -->
    <div v-else class="relative max-h-72 overflow-auto" data-filter-table>
      <table class="w-full text-sm">
        <!-- Header Row with Filter Icons -->
        <thead class="sticky top-0 z-10 bg-gray-50 shadow-[inset_0_-1px_0] shadow-gray-200">
          <tr>
            <th scope="col" class="w-12 px-4 py-2 text-left">
              <input
                type="checkbox"
                :checked="filteredEntries.length > 0 && filteredEntries.every(e => selectedEntries.includes(e.id))"
                :indeterminate="filteredEntries.some(e => selectedEntries.includes(e.id)) && !filteredEntries.every(e => selectedEntries.includes(e.id))"
                class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                aria-label="Select all visible runs"
                @change="(e: any) => e.target.checked ? selectAll() : deselectAll()"
              />
            </th>
            <th v-for="col in columns" :key="col.key" scope="col" class="data-label relative px-4 py-2">
              <div class="flex items-center justify-end gap-1">
                <span>{{ col.label }}</span>
                <button
                  :ref="el => { filterButtons[col.key] = el as HTMLElement | null }"
                  type="button"
                  :aria-label="`Filter ${col.label}`"
                  :aria-expanded="openFilterColumn === col.key"
                  class="relative inline-flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  :class="{ 'bg-primary-100': filters[col.key].length > 0 || openFilterColumn === col.key }"
                  @click.stop="toggleFilterDropdown(col.key)"
                >
                  <svg class="h-4 w-4" :class="{ 'text-primary-600': filters[col.key].length > 0, 'text-gray-500': filters[col.key].length === 0 }" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                  <span v-if="filters[col.key].length > 0" class="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-primary-600 rounded-full">
                    {{ filters[col.key].length }}
                  </span>
                </button>
              </div>
            </th>
            <th scope="col" class="data-label px-4 py-2 text-right">
              Cached
            </th>
          </tr>
        </thead>
        <!-- Data Rows -->
        <tbody>
          <tr
            v-for="entry in filteredEntries"
            :key="entry.id"
            class="border-b border-gray-200 transition-colors last:border-b-0 hover:bg-gray-50"
          >
            <td class="px-4 py-2">
              <input
                type="checkbox"
                :checked="selectedEntries.includes(entry.id)"
                class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                :aria-label="`Select run ${formatCondition(entry.inputs)}`"
                @change="toggleSelection(entry.id)"
              />
            </td>
            <td v-for="col in columns" :key="col.key" class="num px-4 py-2 text-right text-gray-900">
              {{ col.get(entry.inputs) !== null ? col.format(col.get(entry.inputs)!) : 'N/A' }}
            </td>
            <td class="num whitespace-nowrap px-4 py-2 text-right text-gray-600">
              {{ entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'N/A' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Filter Dropdown using Teleport to avoid clipping -->
    <Teleport to="body">
      <div
        v-if="openColumn && dropdownPosition"
        data-filter-dropdown
        class="fixed z-50 w-48 rounded-lg border border-gray-200 bg-white shadow-lg"
        :style="dropdownPosition"
        @click.stop
      >
        <div class="p-3">
          <div class="flex gap-2 mb-3">
            <button @click.stop="filters[openColumn.key] = uniqueValues(openColumn)" :class="microButtonClasses()">Select All</button>
            <button @click.stop="filters[openColumn.key] = []" :class="microButtonClasses()">Clear</button>
          </div>
          <div class="max-h-40 overflow-y-auto space-y-1">
            <label v-for="val in uniqueValues(openColumn)" :key="val" class="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 text-sm hover:bg-gray-100">
              <input
                type="checkbox"
                :checked="filters[openColumn.key].includes(val)"
                @change="toggleFilterValue(openColumn.key, val)"
                class="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="num">{{ openColumn.format(val) }}</span>
            </label>
          </div>
        </div>
      </div>
    </Teleport>
  </VPanel>
</template>

