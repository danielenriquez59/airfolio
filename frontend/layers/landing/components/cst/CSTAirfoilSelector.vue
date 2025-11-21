<script setup lang="ts">
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

interface Props {
  modelValue?: Airfoil | null
}

interface Emits {
  (e: 'update:modelValue', value: Airfoil | null): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const supabase = useSupabaseClient<Database>()
const { searchAirfoils } = useAirfoilSearch()

const selectedAirfoil = ref<Airfoil | null>(props.modelValue || null)
const searchQuery = ref('')
const airfoilOptions = ref<Array<{ value: string; text: string; airfoil: Airfoil }>>([])
const isLoading = ref(false)

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  selectedAirfoil.value = newVal || null
})

// Watch for internal changes
watch(selectedAirfoil, (newVal) => {
  emit('update:modelValue', newVal)
})

// Search airfoils when query changes
const performSearch = useDebounceFn(async () => {
  if (!searchQuery.value.trim()) {
    airfoilOptions.value = []
    return
  }

  isLoading.value = true
  try {
    const result = await searchAirfoils({
      query: searchQuery.value,
      limit: 20,
      page: 1,
    })
    
    airfoilOptions.value = result.data.map(airfoil => ({
      value: airfoil.id,
      text: airfoil.name,
      airfoil,
    }))
  } catch (error) {
    console.error('Error searching airfoils:', error)
    airfoilOptions.value = []
  } finally {
    isLoading.value = false
  }
}, 300)

watch(searchQuery, () => {
  performSearch()
})

const handleSelect = (item: { value: string; text: string; airfoil: Airfoil } | null | undefined) => {
  if (item && 'airfoil' in item) {
    selectedAirfoil.value = item.airfoil
  } else {
    selectedAirfoil.value = null
  }
  searchQuery.value = ''
}

const clearSelection = () => {
  selectedAirfoil.value = null
  searchQuery.value = ''
  airfoilOptions.value = []
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Select Airfoil
      </label>
      <Autocomplete
        :model-value="selectedAirfoil ? { value: selectedAirfoil.id, text: selectedAirfoil.name, airfoil: selectedAirfoil } : null"
        :items="airfoilOptions"
        :placeholder="selectedAirfoil ? selectedAirfoil.name : 'Search for an airfoil...'"
        @update:model-value="handleSelect($event as any)"
      />
    </div>

    <div v-if="selectedAirfoil" class="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <h3 class="font-semibold text-gray-900">{{ selectedAirfoil.name }}</h3>
          <div v-if="selectedAirfoil.description" class="mt-1 text-sm text-gray-600">
            {{ selectedAirfoil.description }}
          </div>
          <div class="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
            <span v-if="selectedAirfoil.thickness_pct">
              Thickness: {{ (selectedAirfoil.thickness_pct * 100).toFixed(1) }}%
            </span>
            <span v-if="selectedAirfoil.camber_pct">
              Camber: {{ (selectedAirfoil.camber_pct * 100).toFixed(1) }}%
            </span>
          </div>
        </div>
        <button
          type="button"
          class="ml-4 text-gray-400 hover:text-gray-600"
          @click="clearSelection"
        >
          <Icon name="heroicons:x-mark-20-solid" class="h-5 w-5" />
        </button>
      </div>
    </div>

    <div v-else class="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500 text-center">
      No airfoil selected. Search and select an airfoil to begin CST parameterization.
    </div>
  </div>
</template>

