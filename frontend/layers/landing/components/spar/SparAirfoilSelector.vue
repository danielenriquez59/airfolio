<script setup lang="ts">
import type { Database } from '~/types/database.types'
import { useDebounceFn } from '@vueuse/core'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

interface Props {
  modelValue: Airfoil | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Airfoil | null]
}>()

const { searchAirfoilsByPrefix } = useAirfoilAutocomplete()
const searchQuery = ref('')
const searchResults = ref<Airfoil[]>([])
const isSearching = ref(false)
const showDropdown = ref(false)

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
  debouncedSearch(newQuery)
})

const selectAirfoil = (airfoil: Airfoil) => {
  emit('update:modelValue', airfoil)
  searchQuery.value = airfoil.name
  showDropdown.value = false
}

const clearSelection = () => {
  emit('update:modelValue', null)
  searchQuery.value = ''
  searchResults.value = []
  showDropdown.value = false
}

// Capitalize airfoil names (title case)
const capitalizeName = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Initialize with default
onMounted(() => {
  if (!props.modelValue) {
    searchQuery.value = 'NACA 0012'
  } else {
    searchQuery.value = props.modelValue.name
  }
})
</script>

<template>
  <div class="mb-4">
    <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
      Airfoil Selection
    </label>
    <div class="relative">
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search airfoil or use default NACA 0012..."
          class="block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          @focus="showDropdown = searchResults.length > 0"
          @blur="setTimeout(() => { showDropdown = false }, 200)"
        />
        <div class="absolute inset-y-0 right-0 flex items-center pr-2">
          <button
            v-if="modelValue || searchQuery"
            type="button"
            @click="clearSelection"
            class="text-slate-400 hover:text-slate-600"
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
              class="px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 cursor-pointer"
              @mousedown.prevent="selectAirfoil(airfoil)"
            >
              <div class="font-medium">{{ capitalizeName(airfoil.name) }}</div>
              <div v-if="airfoil.description" class="text-xs text-slate-500 truncate">
                {{ airfoil.description }}
              </div>
            </li>
          </ul>
        </div>
      </Transition>

      <!-- Loading indicator -->
      <div v-if="isSearching" class="absolute right-3 top-2.5">
        <Icon name="heroicons:arrow-path" class="h-4 w-4 animate-spin text-slate-400" />
      </div>
    </div>
    <!-- Selected airfoil info -->
    <div v-if="modelValue" class="mt-2 p-2 bg-blue-50 rounded text-xs text-slate-700">
      <div class="font-medium">{{ modelValue.name }}</div>
      <div v-if="modelValue.thickness_pct" class="text-slate-600">
        Thickness: {{ (modelValue.thickness_pct * 100).toFixed(1) }}%
      </div>
      <div v-if="modelValue.camber_pct" class="text-slate-600">
        Camber: {{ (modelValue.camber_pct * 100).toFixed(1) }}%
      </div>
    </div>
  </div>
</template>

