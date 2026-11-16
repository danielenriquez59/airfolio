<script setup lang="ts">
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

const props = defineProps<{
  filteredAirfoils: string[]
  selectedAirfoils: string[]
}>()

const emit = defineEmits<{
  'set-selected': [names: string[]]
  'toggle-selection': [name: string]
  'select-all': []
  'deselect-all': []
  'reset-analysis': []
}>()

// Search functionality for Analyzed Airfoils
const searchQuery = ref('')
const showSelectedOnly = ref(false)

// Filter the airfoils based on search query and selected-only mode
const visibleAirfoils = computed(() => {
  let result = props.filteredAirfoils

  // Filter to show only selected airfoils if in that mode
  if (showSelectedOnly.value) {
    result = result.filter(name => props.selectedAirfoils.includes(name))
  }

  // Further filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(name =>
      name.toLowerCase().includes(query)
    )
  }

  return result
})

const handleSelectAll = () => {
  if (searchQuery.value.trim()) {
    // Select all visible airfoils
    const newSelection = new Set([...props.selectedAirfoils, ...visibleAirfoils.value])
    emit('set-selected', Array.from(newSelection))
  } else {
    emit('select-all')
  }
}

const handleDeselectAll = () => {
  if (searchQuery.value.trim()) {
    // Deselect all visible airfoils
    const visibleSet = new Set(visibleAirfoils.value)
    const newSelection = props.selectedAirfoils.filter(name => !visibleSet.has(name))
    emit('set-selected', newSelection)
  } else {
    emit('deselect-all')
  }
}

const handleShowSelected = () => {
  showSelectedOnly.value = !showSelectedOnly.value
  // Clear search when toggling selected view
  if (showSelectedOnly.value) {
    searchQuery.value = ''
  }
}

// Geometry preview modal, coordinates fetched on demand
const { fetchAirfoilByName } = useAirfoils()
const previewOpen = ref(false)
const previewName = ref('')
const preview = ref<Airfoil | null>(null)
const previewError = ref<string | null>(null)

async function openPreview(name: string) {
  previewName.value = name
  preview.value = null
  previewError.value = null
  previewOpen.value = true
  try {
    const data = await fetchAirfoilByName(name)
    if (name !== previewName.value)
      return // a newer preview superseded this load
    if (!data?.upper_x_coordinates?.length || !data.lower_x_coordinates?.length)
      previewError.value = data ? 'This airfoil has no geometry data.' : 'Airfoil not found.'
    else
      preview.value = data
  }
  catch {
    if (name === previewName.value)
      previewError.value = 'Could not load the geometry. Please try again.'
  }
}
</script>

<template>
  <VPanel title="Analyzed Airfoils">
    <!-- Search Bar -->
    <div class="mb-3">
      <VInput
        v-model="searchQuery"
        type="text"
        size="sm"
        prepend-icon="heroicons:magnifying-glass"
        icon-size="16"
        placeholder="Search airfoils..."
        aria-label="Search analyzed airfoils"
      />
    </div>

    <!-- No "|" separators: in the narrow right column the row wraps and a trailing one dangles -->
    <div class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <VButton
        type="button"
        variant="ghost"
        color="primary"
        size="xs"
        @click="handleSelectAll"
      >
        Show All
      </VButton>
      <VButton
        type="button"
        variant="ghost"
        color="primary"
        size="xs"
        @click="handleDeselectAll"
      >
        Hide All
      </VButton>
      <VButton
        type="button"
        variant="ghost"
        :color="showSelectedOnly ? 'error' : 'primary'"
        size="xs"
        @click="handleShowSelected"
      >
        {{ showSelectedOnly ? 'Show All' : 'Show Selected' }}
      </VButton>
    </div>

    <p v-if="filteredAirfoils.length === 0" class="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500">
      No airfoils match the current filters. Try relaxing your filter criteria.
    </p>

    <!-- xl: the list sits in its own sticky column, so let it use the viewport height -->
    <div v-else class="-mx-1 max-h-96 space-y-0.5 overflow-y-auto xl:max-h-[max(12rem,calc(100vh-24rem))]">
      <div
        v-for="name in visibleAirfoils"
        :key="name"
        class="flex items-center gap-1 rounded-md pr-1 hover:bg-gray-50"
      >
        <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5 pl-2">
          <input
            type="checkbox"
            :checked="selectedAirfoils.includes(name)"
            class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            @change="emit('toggle-selection', name)"
          />
          <span class="flex-1 truncate text-sm text-gray-700">{{ name.toUpperCase() }}</span>
        </label>
        <button
          type="button"
          :aria-label="`Preview geometry of ${name.toUpperCase()}`"
          :title="`Preview geometry of ${name.toUpperCase()}`"
          class="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          @click="openPreview(name)"
        >
          <Icon name="heroicons:eye" class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Reset Analysis Button -->
    <div class="mt-4 border-t border-gray-200 pt-4">
      <VButton
        type="button"
        color="error"
        block
        @click="emit('reset-analysis')"
      >
        Reset Analysis
      </VButton>
    </div>

    <VModal v-model="previewOpen">
      <VModalHeader dismissable>
        {{ previewName.toUpperCase() }}
      </VModalHeader>
      <VModalBody>
        <VStateBlock v-if="previewError" variant="error" title="Could not load geometry" :description="previewError" class="!py-6" />
        <div v-else-if="preview" class="space-y-4">
          <AirfoilGeometry
            :upper-x="preview.upper_x_coordinates ?? []"
            :upper-y="preview.upper_y_coordinates ?? []"
            :lower-x="preview.lower_x_coordinates ?? []"
            :lower-y="preview.lower_y_coordinates ?? []"
            :aspect-ratio="3"
          />
          <dl class="grid grid-cols-2 gap-x-4 gap-y-3">
            <VStat
              label="Thickness (t/c)"
              :value="preview.thickness_pct != null ? (preview.thickness_pct * 100).toFixed(2) : null"
              unit="%"
              :hint="preview.thickness_loc_pct ? `at ${(preview.thickness_loc_pct * 100).toFixed(1)}% x/c` : undefined"
            />
            <VStat
              label="Camber (y/c)"
              :value="preview.camber_pct != null ? (preview.camber_pct * 100).toFixed(2) : null"
              unit="%"
              :hint="preview.camber_loc_pct ? `at ${(preview.camber_loc_pct * 100).toFixed(1)}% x/c` : undefined"
            />
          </dl>
        </div>
        <VStateBlock v-else variant="loading" title="Loading geometry…" class="!py-6" />
      </VModalBody>
      <VModalFooter>
        <VButton :to="`/airfoils/${encodeURIComponent(previewName)}`" color="light" size="sm">
          Open detail page
          <Icon name="heroicons:arrow-right" class="h-4 w-4" aria-hidden="true" />
        </VButton>
      </VModalFooter>
    </VModal>
  </VPanel>
</template>
