<script setup lang="ts">
import type { Database } from '~/types/database.types'
import { useDebounceFn } from '@vueuse/core'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

interface Props {
  modelValue: Airfoil | null
  showSelectionSummary?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showSelectionSummary: true,
})
const emit = defineEmits<{
  'update:modelValue': [value: Airfoil | null]
}>()

const { searchAirfoilsByPrefix } = useAirfoilAutocomplete()
const searchQuery = ref('')
const searchResults = ref<Airfoil[]>([])
const isSearching = ref(false)
const showDropdown = ref(false)
const skipNextSearch = ref(false)

// Debounced search
const debouncedSearch = useDebounceFn(async (query: string) => {
  if (!query || query.length < 2) {
    searchResults.value = []
    showDropdown.value = false
    return
  }

  isSearching.value = true
  try {
    const results = await searchAirfoilsByPrefix(query, 15)
    searchResults.value = results
    showDropdown.value = results.length > 0
  } catch (error) {
    console.error('Error searching airfoils:', error)
    searchResults.value = []
    showDropdown.value = false
  } finally {
    isSearching.value = false
  }
}, 300)

watch(searchQuery, (newQuery) => {
  if (skipNextSearch.value) {
    skipNextSearch.value = false
    return
  }

  debouncedSearch(newQuery)
})

const syncSearchQuery = (value: string) => {
  searchResults.value = []
  showDropdown.value = false

  if (searchQuery.value === value)
    return

  skipNextSearch.value = true
  searchQuery.value = value
}

const selectAirfoil = (airfoil: Airfoil) => {
  emit('update:modelValue', airfoil)
  syncSearchQuery(formatDisplayName(airfoil.display_name || airfoil.name))
}

const clearSelection = () => {
  emit('update:modelValue', null)
  searchQuery.value = ''
  searchResults.value = []
  showDropdown.value = false
}

const hideDropdownSoon = () => {
  window.setTimeout(() => {
    showDropdown.value = false
  }, 200)
}

const formatDisplayName = (name: string): string => name.toUpperCase()

watch(() => props.modelValue, (airfoil) => {
  if (airfoil)
    syncSearchQuery(formatDisplayName(airfoil.display_name || airfoil.name))
  else
    syncSearchQuery('')
})

// Initialize display from an existing selection without opening autocomplete.
onMounted(() => {
  if (props.modelValue)
    syncSearchQuery(formatDisplayName(props.modelValue.display_name || props.modelValue.name))
})
</script>

<template>
  <div>
    <label for="spar-airfoil-search" class="mb-1 block text-sm font-medium text-gray-700">
      Airfoil
    </label>
    <div class="relative">
      <div class="relative">
        <input
          id="spar-airfoil-search"
          v-model="searchQuery"
          type="text"
          placeholder="Search airfoil"
          autocomplete="off"
          class="block h-9 w-full rounded-lg border border-gray-300 pl-3 pr-10 text-sm uppercase text-gray-900 placeholder:normal-case placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          @focus="showDropdown = searchResults.length > 0"
          @blur="hideDropdownSoon"
        >
        <div class="absolute inset-y-0 right-0 flex items-center pr-2">
          <Icon v-if="isSearching" name="heroicons:arrow-path" class="h-4 w-4 animate-spin text-gray-400" aria-hidden="true" />
          <button
            v-else-if="modelValue || searchQuery"
            type="button"
            class="rounded text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Clear airfoil selection"
            @click="clearSelection"
          >
            <Icon name="heroicons:x-mark-20-solid" class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <!-- Dropdown Results -->
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showDropdown && searchResults.length > 0"
          class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          <ul class="py-1">
            <li
              v-for="airfoil in searchResults"
              :key="airfoil.id"
              class="cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-primary-50"
              @mousedown.prevent="selectAirfoil(airfoil)"
            >
              <div class="font-medium uppercase text-gray-900">
                {{ formatDisplayName(airfoil.display_name || airfoil.name) }}
              </div>
              <div v-if="airfoil.description" class="truncate text-xs text-gray-500">
                {{ airfoil.description }}
              </div>
            </li>
          </ul>
        </div>
      </Transition>
    </div>
    <!-- Selected airfoil info -->
    <div v-if="showSelectionSummary && modelValue" class="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
      <div class="font-medium uppercase text-gray-900">
        {{ formatDisplayName(modelValue.display_name || modelValue.name) }}
      </div>
      <div class="mt-0.5 flex gap-4">
        <span v-if="modelValue.thickness_pct">Thickness <span class="num text-gray-900">{{ (modelValue.thickness_pct * 100).toFixed(1) }}%</span></span>
        <span v-if="modelValue.camber_pct">Camber <span class="num text-gray-900">{{ (modelValue.camber_pct * 100).toFixed(1) }}%</span></span>
      </div>
    </div>
  </div>
</template>
