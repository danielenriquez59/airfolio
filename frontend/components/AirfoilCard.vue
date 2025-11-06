<script setup lang="ts">
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

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

const airfoil = ref<Airfoil | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// Fetch airfoil data
onMounted(async () => {
  try {
    loading.value = true
    const data = await fetchAirfoil(props.airfoilId)
    airfoil.value = data
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
      'hover:shadow-lg transition-shadow cursor-pointer',
      { 'hover:scale-[1.02] transition-transform': onClick || true }
    ]"
    @click="handleClick"
  >
    <template #header>
      <div class="px-4 py-1">
        <h3 class="font-bold text-lg text-gray-900 uppercase tracking-wide">
          {{ airfoil?.name.toUpperCase() || 'Loading...' }}
        </h3>
        <p v-if="airfoil?.description" class="text-sm text-gray-600 mt-0 line-clamp-2">
          {{ airfoil.description }}
        </p>
      </div>
    </template>

    <VCardBody>
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12 text-red-600">
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
        <div class="mt-4">
          <AirfoilGeometry
            v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
            :upper-x="airfoil.upper_x_coordinates"
            :upper-y="airfoil.upper_y_coordinates"
            :lower-x="airfoil.lower_x_coordinates"
            :lower-y="airfoil.lower_y_coordinates"
            :name="thumbnail ? undefined : airfoil.name"
            :height="thumbnail ? 200 : 300"
            :aspect-ratio="thumbnail ? 2 : 2.5"
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
    <VCardFooter v-if="airfoil?.source_url" class="pt-0">
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
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

