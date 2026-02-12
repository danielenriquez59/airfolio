<script setup lang="ts">
import type { Database } from '~/types/database.types'
import { formatCategoryName, isValidCategory } from '~/utils/categoryUtils'
import { useBreakpoints } from '@vueuse/core'

type Airfoil = Database['public']['Tables']['airfoils']['Row']
type Category = Database['public']['Tables']['categories']['Row']

interface Props {
  /** Airfoil UUID */
  airfoilId: string
  /** Show full geometry or thumbnail */
  thumbnail?: boolean
  /** Click handler */
  onClick?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  thumbnail: false,
})

const { fetchAirfoil } = useAirfoils()
const { fetchCategories } = useCategories()

const airfoil = ref<Airfoil | null>(null)
const category = ref<Category | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const categoryMap = ref<Map<string, Category>>(new Map())

// Detect mobile breakpoint (below md: 768px)
const breakpoints = useBreakpoints({
  mobile: 0,
  desktop: 768, // md breakpoint
})
const isMobile = breakpoints.smaller('desktop')

// Dynamic aspect ratio: 2.5 for mobile, 4 for desktop
const aspectRatio = computed(() => 5)

// Fetch airfoil data and categories
onMounted(async () => {
  try {
    loading.value = true
    
    // Fetch categories map
    const categories = await fetchCategories()
    categories.forEach(cat => {
      categoryMap.value.set(cat.id, cat)
    })
    
    // Fetch airfoil data
    const data = await fetchAirfoil(props.airfoilId)
    if (data) {
      airfoil.value = data
      
      // Get category if airfoil has one
      if (data.category && categoryMap.value.has(data.category)) {
        category.value = categoryMap.value.get(data.category) || null
      }
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load airfoil'
    console.error('Error loading airfoil:', err)
  } finally {
    loading.value = false
  }
})

// Format percentage values
const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A'
  return `${(value * 100).toFixed(0)}%`
}

// Helper function to get display name (display_name if available, otherwise name)
const getDisplayName = (airfoil: Airfoil | null): string => {
  if (!airfoil) return ''
  return airfoil.display_name || airfoil.name
}

const handleClick = () => {
  if (props.onClick) {
    props.onClick()
  } else if (airfoil.value?.name) {
    const slug = encodeURIComponent(airfoil.value.name)
    navigateTo(`/airfoils/${slug}`)
  }
}
</script>

<template>
  <VCard
    :class="[
      'hover:shadow-lg transition-shadow cursor-pointer pt-3',
      { 'hover:scale-[1.02] transition-transform': onClick || true }
    ]"
    @click="handleClick"
  >
    <template #header>
      <div class="px-2 md:px-4">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <h3 class="font-bold text-lg text-gray-900 uppercase tracking-wide">
              {{ airfoil ? getDisplayName(airfoil).toUpperCase() : 'Loading...' }}
            </h3>
            <p v-if="airfoil?.description" class="text-sm text-gray-600 mt-0 line-clamp-2">
              {{ airfoil.description }}
            </p>
            <div v-else class="mt-0 h-[2.5rem]"></div>
          </div>
          <div v-if="category" class="ml-2">
            <span class="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full whitespace-nowrap">
              {{ formatCategoryName(category.name) }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <VCardBody class="px-2 md:px-4">
      <!-- Error State -->
      <div v-if="error" class="text-center py-12 text-red-600">
        <p>{{ error }}</p>
      </div>

      <!-- Airfoil Data -->
      <div v-else-if="airfoil" class="space-y-4">
        <!-- Metadata Grid -->
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-500 block mb-1">Thickness</span>
            <div class="flex flex-row">
              <span class="font-semibold text-gray-900">
                {{ formatPercent(airfoil.thickness_pct) }}
              </span>
              <span v-if="airfoil.thickness_loc_pct" class="text-gray-500 text-xs block mt-0.5 ml-1">
                @ {{ formatPercent(airfoil.thickness_loc_pct) }} x/c
              </span>
            </div>
          </div>

          <div>
            <span class="text-gray-500 block mb-1">Camber</span>
            <div class="flex flex-row">
              <span class="font-semibold text-gray-900">
                {{ formatPercent(airfoil.camber_pct) }}
              </span>
            <span v-if="airfoil.camber_loc_pct" class="text-gray-500 text-xs block mt-0.5 ml-1">
                @ {{ formatPercent(airfoil.camber_loc_pct) }} x/c
              </span>
            </div>
          </div>

          <div v-if="airfoil.le_radius">
            <span class="text-gray-500 block mb-1">LE Radius</span>
            <span class="font-semibold text-gray-900">
              {{ airfoil.le_radius.toFixed(2) }}
            </span>
          </div>

          <div v-if="airfoil.te_thickness">
            <span class="text-gray-500 block mb-1">TE Thickness</span>
            <span class="font-semibold text-gray-900">
              {{ airfoil.te_thickness.toFixed(3) }}
            </span>
          </div>
        </div>

        <!-- Geometry Visualization -->
        <div class="mt-4 -mx-2 md:mx-0">
          <AirfoilGeometry
            v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
            :upper-x="airfoil.upper_x_coordinates"
            :upper-y="airfoil.upper_y_coordinates"
            :lower-x="airfoil.lower_x_coordinates"
            :lower-y="airfoil.lower_y_coordinates"
            :name="thumbnail ? undefined : getDisplayName(airfoil)"
            :aspect-ratio="aspectRatio"
            :show-grid="!thumbnail"
            :show-legend="false"
          />
          <div v-else class="text-center py-8 text-gray-400 text-sm">
            Geometry data not available
          </div>
        </div>
      </div>
    </VCardBody>

    <!-- Footer with source link if available -->
    <VCardFooter v-if="airfoil?.source_url" class="pt-0 px-2 md:px-4">
      <a
        :href="airfoil.source_url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        @click.stop
      >
        <span>Source</span>
        <Icon name="heroicons:arrow-top-right-on-square" class="h-3 w-3" />
      </a>
    </VCardFooter>
  </VCard>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  display: box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

