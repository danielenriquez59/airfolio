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

/**
 * Format condition inputs into readable string
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
  
  // Control surface fraction - only show if not 0
  const csFrac = inputs.control_surface_fraction ?? 0
  if (csFrac !== 0) {
    parts.push(`Control Fraction ${csFrac.toFixed(1)}`)
  }
  
  // Control surface deflection - only show if not 0
  const csDef = inputs.control_surface_deflection ?? 0
  if (csDef !== 0) {
    parts.push(`Control Deflection ${csDef.toFixed(1)}`)
  }
  
  return parts.join(', ')
}

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
  } catch (err: any) {
    console.error('Error fetching performance cache:', err)
    error.value = err.message || 'Failed to load performance data'
  } finally {
    loading.value = false
  }
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
 * Select all entries
 */
const selectAll = () => {
  selectedEntries.value = cacheEntries.value.map(entry => entry.id)
  emitSelectionChange()
}

/**
 * Deselect all entries
 */
const deselectAll = () => {
  selectedEntries.value = []
  emitSelectionChange()
}

/**
 * Emit selection change event with selected entries data
 */
const emitSelectionChange = () => {
  const selected = cacheEntries.value.filter(entry => selectedEntries.value.includes(entry.id))
  emit('selection-change', selected)
}

/**
 * Refresh cache entries
 */
const refresh = async () => {
  await fetchCacheEntries()
}

defineExpose({ refresh })

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
})
</script>

<template>
  <div class="bg-white rounded-lg shadow p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold text-gray-900">Performance Data <span class="text-sm text-gray-300">(Cached)</span></h2>
      <div v-if="cacheEntries.length > 0" class="flex gap-2">
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

    <!-- Cache Entries List -->
    <div v-else class="space-y-2 max-h-96 overflow-y-auto">
      <label
        v-for="entry in cacheEntries"
        :key="entry.id"
        class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200 transition-colors"
      >
        <input
          type="checkbox"
          :checked="selectedEntries.includes(entry.id)"
          class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          @change="toggleSelection(entry.id)"
        />
        <div class="flex-1">
          <span class="text-sm font-medium text-gray-900 block">
            {{ formatCondition((entry.inputs as any)) }}
          </span>
          <span v-if="entry.created_at" class="text-xs text-gray-500 mt-0.5 block">
            Cached {{ new Date(entry.created_at).toLocaleDateString() }}
          </span>
        </div>
      </label>
    </div>
  </div>
</template>

