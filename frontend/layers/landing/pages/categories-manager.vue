<script setup lang="ts">
import { useCategories } from '~/composables/useCategories'
import type { Database } from '~/types/database.types'

definePageMeta({
  layout: 'detail',
})

useHead({
  title: 'Category Manager - Airfolio',
})

type Category = Database['public']['Tables']['categories']['Row']
type Airfoil = Database['public']['Tables']['airfoils']['Row']

const {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  assignCategoryToAirfoils,
  removeCategory,
  getCategoryCounts,
  fetchAllAirfoils,
} = useCategories()

// State
const categories = ref<Category[]>([])
const airfoils = ref<Airfoil[]>([])
const categoryCounts = ref<Record<string, number>>({})
const isLoading = ref(false)
const error = ref<string | null>(null)

// Category form state
const newCategoryName = ref('')
const newCategoryDescription = ref('')
const editingCategoryId = ref<string | null>(null)
const editingCategoryName = ref('')
const editingCategoryDescription = ref('')

// Bulk assignment state
const selectedCategory = ref<{ value: string; text: string } | null>(null)
const selectedAirfoilIds = ref<Set<string>>(new Set())
const airfoilSearchQuery = ref('')

// Computed
const filteredAirfoils = computed(() => {
  if (!airfoilSearchQuery.value) {
    return airfoils.value
  }
  const query = airfoilSearchQuery.value.toLowerCase()
  return airfoils.value.filter((a) => a.name.toLowerCase().includes(query))
})

const categorySelectItems = computed(() => {
  return categories.value.map((cat) => ({
    value: cat.id,
    text: cat.name,
  }))
})

// Methods
const loadData = async () => {
  isLoading.value = true
  error.value = null
  try {
    const [cats, airfoilsData, counts] = await Promise.all([
      fetchCategories(),
      fetchAllAirfoils(),
      getCategoryCounts(),
    ])
    categories.value = cats
    airfoils.value = airfoilsData
    categoryCounts.value = counts
  } catch (e: any) {
    error.value = e.message || 'Failed to load data'
    console.error('Error loading data:', e)
  } finally {
    isLoading.value = false
  }
}

const handleCreateCategory = async () => {
  error.value = null // Clear any previous errors
  
  const trimmedName = newCategoryName.value.trim()
  if (!trimmedName) {
    error.value = 'Category name is required'
    return
  }

  try {
    await createCategory(trimmedName, newCategoryDescription.value.trim() || null)
    newCategoryName.value = ''
    newCategoryDescription.value = ''
    await loadData()
  } catch (e: any) {
    error.value = e.message || 'Failed to create category'
  }
}

const startEditCategory = (category: Category) => {
  editingCategoryId.value = category.id
  editingCategoryName.value = category.name
  editingCategoryDescription.value = category.description || ''
}

const cancelEditCategory = () => {
  editingCategoryId.value = null
  editingCategoryName.value = ''
  editingCategoryDescription.value = ''
}

const handleUpdateCategory = async () => {
  if (!editingCategoryId.value || !editingCategoryName.value.trim()) {
    error.value = 'Category name is required'
    return
  }

  try {
    await updateCategory(
      editingCategoryId.value,
      editingCategoryName.value,
      editingCategoryDescription.value
    )
    cancelEditCategory()
    await loadData()
    error.value = null
  } catch (e: any) {
    error.value = e.message || 'Failed to update category'
  }
}

const handleDeleteCategory = async (id: string) => {
  if (!confirm('Are you sure you want to delete this category?')) {
    return
  }

  try {
    await deleteCategory(id)
    await loadData()
    error.value = null
  } catch (e: any) {
    error.value = e.message || 'Failed to delete category'
  }
}

const toggleAirfoilSelection = (airfoilId: string) => {
  if (selectedAirfoilIds.value.has(airfoilId)) {
    selectedAirfoilIds.value.delete(airfoilId)
  } else {
    selectedAirfoilIds.value.add(airfoilId)
  }
}

const selectAllFiltered = () => {
  filteredAirfoils.value.forEach((a) => {
    selectedAirfoilIds.value.add(a.id)
  })
}

const deselectAll = () => {
  selectedAirfoilIds.value.clear()
}

const handleAssignCategory = async () => {
  if (!selectedCategory.value) {
    error.value = 'Please select a category'
    return
  }

  if (selectedAirfoilIds.value.size === 0) {
    error.value = 'Please select at least one airfoil'
    return
  }

  try {
    await assignCategoryToAirfoils(
      selectedCategory.value.value,
      Array.from(selectedAirfoilIds.value)
    )
    selectedAirfoilIds.value.clear()
    await loadData()
    error.value = null
  } catch (e: any) {
    error.value = e.message || 'Failed to assign category'
  }
}

const handleRemoveCategory = async () => {
  if (selectedAirfoilIds.value.size === 0) {
    error.value = 'Please select at least one airfoil'
    return
  }

  try {
    await removeCategory(Array.from(selectedAirfoilIds.value))
    selectedAirfoilIds.value.clear()
    await loadData()
    error.value = null
  } catch (e: any) {
    error.value = e.message || 'Failed to remove category'
  }
}

const getCategoryName = (categoryId: string | null) => {
  if (!categoryId) return null
  return categories.value.find((c) => c.id === categoryId)?.name || null
}

// Lifecycle
onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <h1 class="text-3xl font-bold text-gray-900 mb-6">Category Manager</h1>

    <div v-if="error" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
      <p class="text-red-800">{{ error }}</p>
    </div>

    <div v-if="isLoading" class="text-center py-8">
      <p class="text-gray-600">Loading...</p>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left Section: Category Management -->
      <div class="space-y-6">
        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            Create Category
          </h2>
          <div class="space-y-4">
             <div>
               <label class="block text-sm font-medium text-gray-700 mb-1">
                 Name *
               </label>
               <VInput
                 v-model="newCategoryName"
                 placeholder="Enter category name"
                 class="w-full"
                 @input="error = null"
               />
             </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <VInput
                v-model="newCategoryDescription"
                placeholder="Enter description (optional)"
                class="w-full"
              />
            </div>
            <VButton color="primary" @click="handleCreateCategory">
              Create Category
            </VButton>
          </div>
        </div>

        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            Categories ({{ categories.length }})
          </h2>
          <div v-if="categories.length === 0" class="text-gray-500 text-sm">
            No categories yet. Create one above.
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="category in categories"
              :key="category.id"
              class="border border-gray-200 rounded-md p-4"
            >
              <div v-if="editingCategoryId !== category.id">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h3 class="font-medium text-gray-900">
                      {{ category.name }}
                    </h3>
                    <p
                      v-if="category.description"
                      class="text-sm text-gray-600 mt-1"
                    >
                      {{ category.description }}
                    </p>
                    <p class="text-xs text-gray-500 mt-2">
                      Airfoils: {{ categoryCounts[category.id] || 0 }}
                    </p>
                  </div>
                   <div class="flex gap-2 ml-4">
                     <VButton
                       size="sm"
                       variant="ghost"
                       color="primary"
                       @click="startEditCategory(category)"
                     >
                       Edit
                     </VButton>
                     <VButton
                       size="sm"
                       variant="ghost"
                       color="error"
                       @click="handleDeleteCategory(category.id)"
                     >
                       Delete
                     </VButton>
                   </div>
                </div>
              </div>
              <div v-else class="space-y-3">
                 <div>
                   <label class="block text-sm font-medium text-gray-700 mb-1">
                     Name *
                   </label>
                   <VInput
                     v-model="editingCategoryName"
                     placeholder="Enter category name"
                     class="w-full"
                   />
                 </div>
                 <div>
                   <label class="block text-sm font-medium text-gray-700 mb-1">
                     Description
                   </label>
                   <VInput
                     v-model="editingCategoryDescription"
                     placeholder="Enter description (optional)"
                     class="w-full"
                   />
                 </div>
                <div class="flex gap-2">
                  <VButton
                    size="sm"
                    color="primary"
                    @click="handleUpdateCategory"
                  >
                    Save
                  </VButton>
                  <VButton
                    size="sm"
                    variant="ghost"
                    color="secondary"
                    @click="cancelEditCategory"
                  >
                    Cancel
                  </VButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Section: Bulk Assignment -->
      <div class="space-y-6">
        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            Bulk Assignment
          </h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Select Category
              </label>
              <VSelect
                v-model="selectedCategory"
                :items="categorySelectItems"
                placeholder="Choose a category"
                class="w-full"
              />
            </div>

             <div>
               <label class="block text-sm font-medium text-gray-700 mb-2">
                 Search Airfoils
               </label>
               <VInput
                 v-model="airfoilSearchQuery"
                 placeholder="Search by name..."
                 class="w-full"
               />
             </div>

            <div class="flex gap-2">
              <VButton size="sm" variant="ghost" @click="selectAllFiltered">
                Select All
              </VButton>
              <VButton size="sm" variant="ghost" @click="deselectAll">
                Deselect All
              </VButton>
              <span class="text-sm text-gray-600 self-center ml-auto">
                Selected: {{ selectedAirfoilIds.size }}
              </span>
            </div>

            <div
              class="border border-gray-200 rounded-md max-h-96 overflow-y-auto"
            >
              <div
                v-if="filteredAirfoils.length === 0"
                class="p-4 text-gray-500 text-sm text-center"
              >
                No airfoils found
              </div>
              <div v-else class="divide-y divide-gray-200">
                <label
                  v-for="airfoil in filteredAirfoils"
                  :key="airfoil.id"
                  class="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :checked="selectedAirfoilIds.has(airfoil.id)"
                    @change="toggleAirfoilSelection(airfoil.id)"
                    class="mr-3 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <div class="flex-1">
                    <div class="text-sm font-medium text-gray-900">
                      {{ airfoil.name }}
                    </div>
                    <div
                      v-if="getCategoryName(airfoil.category)"
                      class="text-xs text-gray-500 mt-1"
                    >
                      Current: {{ getCategoryName(airfoil.category) }}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div class="flex gap-2">
              <VButton
                color="primary"
                :disabled="!selectedCategory || selectedAirfoilIds.size === 0"
                @click="handleAssignCategory"
              >
                Assign Category
              </VButton>
              <VButton
                color="error"
                variant="tertiary"
                :disabled="selectedAirfoilIds.size === 0"
                @click="handleRemoveCategory"
              >
                Remove Category
              </VButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

