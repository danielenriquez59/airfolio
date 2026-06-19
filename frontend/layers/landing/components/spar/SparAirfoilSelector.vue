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
  <div class="mb-4">
    <label class="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
      Airfoil Selection
    </label>
    <div class="relative">
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search airfoil"
          class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-gray-900 uppercase ring-1 ring-inset ring-gray-300 placeholder:normal-case placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
          @focus="showDropdown = searchResults.length > 0"
          @blur="hideDropdownSoon"
        />
        <div class="absolute inset-y-0 right-0 flex items-center pr-2">
          <button
            v-if="modelValue || searchQuery"
            type="button"
            @click="clearSelection"
            class="text-gray-400 hover:text-gray-600"
            aria-label="Clear"
          >
            <Icon name="heroicons:x-mark-20-solid" class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Dropdown Results -->
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showDropdown && searchResults.length > 0"
          class="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 max-h-60 overflow-auto"
        >
          <ul class="py-1">
            <li
              v-for="airfoil in searchResults"
              :key="airfoil.id"
              class="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
              @mousedown.prevent="selectAirfoil(airfoil)"
            >
              <div class="font-medium uppercase">{{ formatDisplayName(airfoil.display_name || airfoil.name) }}</div>
              <div v-if="airfoil.description" class="text-xs text-gray-500 truncate">
                {{ airfoil.description }}
              </div>
            </li>
          </ul>
        </div>
      </Transition>

      <!-- Loading indicator -->
      <div v-if="isSearching" class="absolute right-3 top-2.5">
        <Icon name="heroicons:arrow-path" class="h-4 w-4 animate-spin text-gray-400" />
      </div>
    </div>
    <!-- Selected airfoil info -->
    <div v-if="showSelectionSummary && modelValue" class="mt-2 p-2 bg-blue-50 rounded text-xs text-gray-700">
      <div class="font-medium uppercase">{{ formatDisplayName(modelValue.display_name || modelValue.name) }}</div>
      <div v-if="modelValue.thickness_pct" class="text-gray-600">
        Thickness: {{ (modelValue.thickness_pct * 100).toFixed(1) }}%
      </div>
      <div v-if="modelValue.camber_pct" class="text-gray-600">
        Camber: {{ (modelValue.camber_pct * 100).toFixed(1) }}%
      </div>
    </div>
  </div>
</template>

