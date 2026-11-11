<script setup lang="ts">
import type { Database } from '~/types/database.types'
import { formatCategoryName } from '~/utils/categoryUtils'
import { useDebounceFn } from '@vueuse/core'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'

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

const { fetchAllAirfoils, updateAirfoil, deleteAirfoil } = useAirfoils()
const { fetchCategories } = useCategories()

// State
const airfoils = ref<Airfoil[]>([])
const categories = ref<Category[]>([])
const categoryMap = ref<Map<string, Category>>(new Map())
const isLoading = ref(false)
const error = ref<string | null>(null)

// Search and sort state
const searchQuery = ref('')
type SortColumn = 'name' | 'display_name' | 'thickness_pct' | 'camber_pct' | 'category' | 'created_at'
const sortColumn = ref<SortColumn>('name')
const sortDirection = ref<'asc' | 'desc'>('asc')

const sortOptions: { value: SortColumn; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'display_name', label: 'Display Name' },
  { value: 'thickness_pct', label: 'Thickness' },
  { value: 'camber_pct', label: 'Camber' },
  { value: 'category', label: 'Category' },
  { value: 'created_at', label: 'Upload Date' },
]

const currentSortLabel = computed(() => {
  return sortOptions.find(o => o.value === sortColumn.value)?.label || 'Name'
})

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
      case 'created_at':
        aVal = a.created_at || ''
        bVal = b.created_at || ''
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

// Delete state
const deleteTarget = ref<Airfoil | null>(null)
const showDeleteModal = ref(false)
const isDeleting = ref(false)
const deleteError = ref<string | null>(null)

/** Open the delete confirmation modal for an airfoil. */
const openDeleteModal = (airfoil: Airfoil) => {
  if (isDeleting.value) return
  deleteTarget.value = airfoil
  deleteError.value = null
  showDeleteModal.value = true
}

/** Hard-delete the target airfoil and its performance cache, then drop it from the table. */
const confirmDeleteAirfoil = async () => {
  if (!deleteTarget.value || isDeleting.value) return
  const id = deleteTarget.value.id
  isDeleting.value = true
  deleteError.value = null
  try {
    await deleteAirfoil(id)
    airfoils.value = airfoils.value.filter((a) => a.id !== id)
    showDeleteModal.value = false
    deleteTarget.value = null
  } catch (e: unknown) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete airfoil'
  } finally {
    isDeleting.value = false
  }
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
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-600">
            Showing {{ filteredAndSortedAirfoils.length }} of {{ airfoils.length }} airfoils
          </div>

          <!-- Sort Controls -->
          <div class="flex">
            <Menu as="div" class="relative">
              <MenuButton
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
              >
                <span class="text-gray-500">Sort:</span>
                {{ currentSortLabel }}
                <Icon name="heroicons:chevron-down" class="w-4 h-4 text-gray-400" />
              </MenuButton>

              <transition
                enter-active-class="transition duration-100 ease-out"
                enter-from-class="transform scale-95 opacity-0"
                enter-to-class="transform scale-100 opacity-100"
                leave-active-class="transition duration-75 ease-in"
                leave-from-class="transform scale-100 opacity-100"
                leave-to-class="transform scale-95 opacity-0"
              >
                <MenuItems
                  class="absolute right-0 z-20 mt-1 w-40 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                >
                  <div class="py-1">
                    <MenuItem
                      v-for="option in sortOptions"
                      :key="option.value"
                      v-slot="{ active }"
                    >
                      <button
                        class="w-full text-left px-4 py-2 text-sm"
                        :class="[
                          active ? 'bg-gray-100' : '',
                          sortColumn === option.value ? 'text-indigo-600 font-medium' : 'text-gray-700'
                        ]"
                        @click="sortColumn = option.value"
                      >
                        {{ option.label }}
                      </button>
                    </MenuItem>
                  </div>
                </MenuItems>
              </transition>
            </Menu>

            <button
              class="inline-flex items-center px-2.5 py-1.5 text-gray-700 bg-white border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
              :title="sortDirection === 'asc' ? 'Ascending' : 'Descending'"
              @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
            >
              <Icon
                :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                class="w-4 h-4"
              />
            </button>
          </div>
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
                  class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                  class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                  class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  Description
                </th>
                <th
                  class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                  class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                  class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
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
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 max-w-[10rem] truncate" :title="airfoil.name">
                  {{ airfoil.name }}
                </td>

                <!-- Display Name (editable) -->
                <td class="px-3 py-2 text-sm max-w-[12rem]">
                  <div v-if="!isEditing(airfoil.id, 'display_name')" class="flex items-center gap-2">
                    <span
                      class="text-gray-900 cursor-pointer hover:bg-indigo-50 px-2 py-1 rounded transition-colors truncate"
                      :title="getDisplayName(airfoil)"
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
                <td class="px-3 py-2 text-sm max-w-[16rem]">
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
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  {{ formatPercent(airfoil.thickness_pct) }}
                </td>

                <!-- Camber (read-only) -->
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  {{ formatPercent(airfoil.camber_pct) }}
                </td>

                <!-- Category (read-only) -->
                <td class="px-3 py-2 whitespace-nowrap text-sm">
                  <span
                    v-if="getCategoryName(airfoil)"
                    class="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full"
                  >
                    {{ formatCategoryName(getCategoryName(airfoil)!) }}
                  </span>
                  <span v-else class="text-gray-400">—</span>
                </td>

                <!-- Actions -->
                <td class="px-3 py-2 whitespace-nowrap text-sm text-right">
                  <button
                    type="button"
                    class="text-red-600 hover:text-red-800 disabled:opacity-50"
                    :disabled="isDeleting || isSaving(airfoil.id)"
                    :title="`Delete ${getDisplayName(airfoil)}`"
                    @click="openDeleteModal(airfoil)"
                  >
                    <Icon name="heroicons:trash" class="h-5 w-5" />
                  </button>
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

    <!-- Delete confirmation modal -->
    <VModal v-model="showDeleteModal">
      <VModalHeader dismissable>
        Delete Airfoil
      </VModalHeader>
      <VModalBody>
        <p class="text-sm text-gray-700">
          Permanently delete
          <span class="font-semibold">{{ deleteTarget ? getDisplayName(deleteTarget) : '' }}</span>
          and all related performance cache? This cannot be undone.
        </p>
        <div v-if="deleteError" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-800">{{ deleteError }}</p>
        </div>
      </VModalBody>
      <VModalFooter>
        <VButton
          type="button"
          color="light"
          :disabled="isDeleting"
          @click="showDeleteModal = false"
        >
          Cancel
        </VButton>
        <VButton
          type="button"
          color="error"
          :disabled="isDeleting"
          @click="confirmDeleteAirfoil"
        >
          {{ isDeleting ? 'Deleting...' : 'Delete Airfoil' }}
        </VButton>
      </VModalFooter>
    </VModal>
  </div>
</template>
