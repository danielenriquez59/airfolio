<script setup lang="ts">
import type { Database } from '~/types/database.types'
import { formatCategoryName } from '~/utils/categoryUtils'
import { useDebounceFn } from '@vueuse/core'

definePageMeta({
  layout: 'detail',
})

useHead({
  title: 'Airfoil Manager - Airfolio',
  meta: [
    {
      name: 'description',
      content: 'Manage airfoil display names and descriptions. Search, sort, and edit airfoils in a table format.',
    },
  ],
})

type Airfoil = Database['public']['Tables']['airfoils']['Row']
type Category = Database['public']['Tables']['categories']['Row']

const { fetchAllAirfoils, updateAirfoil } = useAirfoils()
const { fetchCategories } = useCategories()

// State
const airfoils = ref<Airfoil[]>([])
const categories = ref<Category[]>([])
const categoryMap = ref<Map<string, Category>>(new Map())
const isLoading = ref(false)
const error = ref<string | null>(null)

// Search and sort state
const searchQuery = ref('')
const sortColumn = ref<'name' | 'display_name' | 'thickness_pct' | 'camber_pct' | 'category'>('name')
const sortDirection = ref<'asc' | 'desc'>('asc')

// Inline editing state
const editingCell = ref<{ airfoilId: string; field: 'display_name' | 'description' } | null>(null)
const editingValue = ref('')
const savingIds = ref<Set<string>>(new Set())
const successIds = ref<Set<string>>(new Set())
const errorCells = ref<Map<string, string>>(new Map()) // Map of "airfoilId-field" -> error message

// Debounced search
const debouncedSearch = useDebounceFn(() => {
  // Search is reactive, no need to do anything here
}, 300)

// Computed: Filtered and sorted airfoils
const filteredAndSortedAirfoils = computed(() => {
  let result = [...airfoils.value]

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter((airfoil) => {
      const nameMatch = airfoil.name.toLowerCase().includes(query)
      const displayNameMatch = airfoil.display_name?.toLowerCase().includes(query) || false
      const descriptionMatch = airfoil.description?.toLowerCase().includes(query) || false
      return nameMatch || displayNameMatch || descriptionMatch
    })
  }

  // Apply sorting
  result.sort((a, b) => {
    let aVal: any
    let bVal: any

    switch (sortColumn.value) {
      case 'name':
        aVal = a.name.toLowerCase()
        bVal = b.name.toLowerCase()
        break
      case 'display_name':
        aVal = (a.display_name || a.name).toLowerCase()
        bVal = (b.display_name || b.name).toLowerCase()
        break
      case 'thickness_pct':
        aVal = a.thickness_pct ?? 0
        bVal = b.thickness_pct ?? 0
        break
      case 'camber_pct':
        aVal = a.camber_pct ?? 0
        bVal = b.camber_pct ?? 0
        break
      case 'category':
        aVal = a.category ? categoryMap.value.get(a.category)?.name || '' : ''
        bVal = b.category ? categoryMap.value.get(b.category)?.name || '' : ''
        break
      default:
        return 0
    }

    if (aVal < bVal) return sortDirection.value === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDirection.value === 'asc' ? 1 : -1
    return 0
  })

  return result
})

// Methods
const loadData = async () => {
  isLoading.value = true
  error.value = null
  try {
    const [airfoilsData, cats] = await Promise.all([
      fetchAllAirfoils(),
      fetchCategories(),
    ])
    airfoils.value = airfoilsData
    categories.value = cats
    categoryMap.value.clear()
    cats.forEach((cat) => {
      categoryMap.value.set(cat.id, cat)
    })
  } catch (e: any) {
    error.value = e.message || 'Failed to load airfoils'
    console.error('Error loading data:', e)
  } finally {
    isLoading.value = false
  }
}

const handleSort = (column: typeof sortColumn.value) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

const startEdit = (airfoil: Airfoil, field: 'display_name' | 'description') => {
  editingCell.value = { airfoilId: airfoil.id, field }
  editingValue.value = airfoil[field] || ''
  errorCells.value.delete(`${airfoil.id}-${field}`)
  
  // Focus input after next tick
  nextTick(() => {
    const input = document.querySelector(`[data-edit-id="${airfoil.id}-${field}"]`) as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  })
}

const cancelEdit = () => {
  editingCell.value = null
  editingValue.value = ''
}

const saveEdit = async (airfoil: Airfoil, field: 'display_name' | 'description') => {
  if (!editingCell.value || editingCell.value.airfoilId !== airfoil.id || editingCell.value.field !== field) {
    return
  }

  const newValue = editingValue.value.trim()
  const oldValue = airfoil[field] || ''
  
  // If value hasn't changed, just cancel edit
  if (newValue === oldValue) {
    cancelEdit()
    return
  }

  const cellKey = `${airfoil.id}-${field}`
  savingIds.value.add(airfoil.id)
  errorCells.value.delete(cellKey)
  successIds.value.delete(airfoil.id)

  try {
    const updates: Partial<Pick<Airfoil, 'display_name' | 'description'>> = {
      [field]: newValue || null,
    }
    
    const updated = await updateAirfoil(airfoil.id, updates)
    
    // Update local state
    const index = airfoils.value.findIndex((a) => a.id === airfoil.id)
    if (index !== -1) {
      airfoils.value[index] = updated
    }

    // Show success indicator
    successIds.value.add(airfoil.id)
    setTimeout(() => {
      successIds.value.delete(airfoil.id)
    }, 500)

    cancelEdit()
  } catch (e: any) {
    errorCells.value.set(cellKey, e.message || 'Failed to save')
    console.error('Error saving airfoil:', e)
  } finally {
    savingIds.value.delete(airfoil.id)
  }
}

const handleKeydown = (event: KeyboardEvent, airfoil: Airfoil, field: 'display_name' | 'description') => {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveEdit(airfoil, field)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
  }
}

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A'
  return `${(value * 100).toFixed(2)}%`
}

const getDisplayName = (airfoil: Airfoil): string => {
  return airfoil.display_name || airfoil.name
}

const getCategoryName = (airfoil: Airfoil): string | null => {
  if (!airfoil.category) return null
  return categoryMap.value.get(airfoil.category)?.name || null
}

const isEditing = (airfoilId: string, field: 'display_name' | 'description'): boolean => {
  return editingCell.value?.airfoilId === airfoilId && editingCell.value?.field === field
}

const isSaving = (airfoilId: string): boolean => {
  return savingIds.value.has(airfoilId)
}

const hasSuccess = (airfoilId: string): boolean => {
  return successIds.value.has(airfoilId)
}

const getError = (airfoilId: string, field: 'display_name' | 'description'): string | null => {
  return errorCells.value.get(`${airfoilId}-${field}`) || null
}

// Load data on mount
onMounted(() => {
  loadData()
})

// Watch search query for debouncing
watch(searchQuery, () => {
  debouncedSearch()
})
</script>

<template>
  <div class="bg-white py-8 min-h-screen">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">Airfoil Manager</h1>
        <p class="mt-2 text-sm text-gray-600">
          Search, sort, and edit airfoil display names and descriptions
        </p>
      </div>

      <!-- Error Banner -->
      <div v-if="error" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
        <div class="flex items-center justify-between">
          <p class="text-red-800">{{ error }}</p>
          <button
            type="button"
            @click="error = null"
            class="text-red-600 hover:text-red-800"
          >
            <Icon name="heroicons:x-mark" class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Search and Stats -->
      <div class="mb-6 space-y-4">
        <div class="flex items-center gap-4">
          <div class="flex-1">
            <VInput
              v-model="searchQuery"
              placeholder="Search by name, display name, or description..."
              prependIcon="heroicons:magnifying-glass"
              class="w-full"
            />
          </div>
          <button
            v-if="searchQuery"
            type="button"
            @click="searchQuery = ''"
            class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        </div>
        <div class="text-sm text-gray-600">
          Showing {{ filteredAndSortedAirfoils.length }} of {{ airfoils.length }} airfoils
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>

      <!-- Table -->
      <div v-else class="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  @click="handleSort('name')"
                >
                  <div class="flex items-center gap-2">
                    <span>Name</span>
                    <Icon
                      v-if="sortColumn === 'name'"
                      :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
                      class="h-4 w-4"
                    />
                  </div>
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  @click="handleSort('display_name')"
                >
                  <div class="flex items-center gap-2">
                    <span>Display Name</span>
                    <Icon
                      v-if="sortColumn === 'display_name'"
                      :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
                      class="h-4 w-4"
                    />
                  </div>
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  Description
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  @click="handleSort('thickness_pct')"
                >
                  <div class="flex items-center gap-2">
                    <span>Thickness</span>
                    <Icon
                      v-if="sortColumn === 'thickness_pct'"
                      :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
                      class="h-4 w-4"
                    />
                  </div>
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  @click="handleSort('camber_pct')"
                >
                  <div class="flex items-center gap-2">
                    <span>Camber</span>
                    <Icon
                      v-if="sortColumn === 'camber_pct'"
                      :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
                      class="h-4 w-4"
                    />
                  </div>
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  @click="handleSort('category')"
                >
                  <div class="flex items-center gap-2">
                    <span>Category</span>
                    <Icon
                      v-if="sortColumn === 'category'"
                      :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
                      class="h-4 w-4"
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr
                v-for="airfoil in filteredAndSortedAirfoils"
                :key="airfoil.id"
                class="hover:bg-gray-50 transition-colors"
                :class="{ 'opacity-50': isSaving(airfoil.id) }"
              >
                <!-- Name (read-only) -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ airfoil.name }}
                </td>

                <!-- Display Name (editable) -->
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <div v-if="!isEditing(airfoil.id, 'display_name')" class="flex items-center gap-2">
                    <span
                      class="text-gray-900 cursor-pointer hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                      @click="startEdit(airfoil, 'display_name')"
                    >
                      {{ getDisplayName(airfoil) }}
                    </span>
                    <Icon
                      v-if="hasSuccess(airfoil.id)"
                      name="heroicons:check-circle"
                      class="h-5 w-5 text-green-600"
                    />
                    <Icon
                      v-if="isSaving(airfoil.id)"
                      name="heroicons:arrow-path"
                      class="h-5 w-5 text-indigo-600 animate-spin"
                    />
                  </div>
                  <div v-else class="relative">
                    <VInput
                      v-model="editingValue"
                      @blur="saveEdit(airfoil, 'display_name')"
                      @keydown="handleKeydown($event, airfoil, 'display_name')"
                      :data-edit-id="`${airfoil.id}-display_name`"
                      size="sm"
                      :error="!!getError(airfoil.id, 'display_name')"
                      :errorMessage="getError(airfoil.id, 'display_name') || undefined"
                      class="w-full"
                    />
                  </div>
                </td>

                <!-- Description (editable) -->
                <td class="px-6 py-4 text-sm max-w-md">
                  <div v-if="!isEditing(airfoil.id, 'description')" class="flex items-center gap-2">
                    <span
                      class="text-gray-600 cursor-pointer hover:bg-indigo-50 px-2 py-1 rounded transition-colors truncate"
                      @click="startEdit(airfoil, 'description')"
                      :title="airfoil.description || 'Click to add description'"
                    >
                      {{ airfoil.description || '—' }}
                    </span>
                  </div>
                  <div v-else class="relative">
                    <VInput
                      v-model="editingValue"
                      @blur="saveEdit(airfoil, 'description')"
                      @keydown="handleKeydown($event, airfoil, 'description')"
                      :data-edit-id="`${airfoil.id}-description`"
                      size="sm"
                      :error="!!getError(airfoil.id, 'description')"
                      :errorMessage="getError(airfoil.id, 'description') || undefined"
                      class="w-full"
                    />
                  </div>
                </td>

                <!-- Thickness (read-only) -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatPercent(airfoil.thickness_pct) }}
                </td>

                <!-- Camber (read-only) -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatPercent(airfoil.camber_pct) }}
                </td>

                <!-- Category (read-only) -->
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    v-if="getCategoryName(airfoil)"
                    class="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full"
                  >
                    {{ formatCategoryName(getCategoryName(airfoil)!) }}
                  </span>
                  <span v-else class="text-gray-400">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div
          v-if="filteredAndSortedAirfoils.length === 0"
          class="text-center py-12 text-gray-500"
        >
          <p v-if="searchQuery">No airfoils found matching "{{ searchQuery }}"</p>
          <p v-else>No airfoils available</p>
        </div>
      </div>
    </div>
  </div>
</template>
