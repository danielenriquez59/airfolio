<script setup lang="ts">
import type { Database } from '~/types/database.types'
import { formatCategoryName } from '~/utils/categoryUtils'

type Airfoil = Database['public']['Tables']['airfoils']['Row']
type Category = Database['public']['Tables']['categories']['Row']

interface Props {
  /** Airfoil UUID — used when `airfoil` is not provided */
  airfoilId?: string
  /** Preloaded airfoil row; skips refetch when provided */
  airfoil?: Airfoil
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

const airfoil = ref<Airfoil | null>(props.airfoil ?? null)
const category = ref<Category | null>(null)
const loading = ref(!props.airfoil)
const error = ref<string | null>(null)
const categoryMap = ref<Map<string, Category>>(new Map())

// Width / height of the shape plot; AirfoilCardSkeleton uses the same value
const aspectRatio = 5

/**
 * Resolve category badge from the category map for the given airfoil.
 */
const resolveCategory = (data: Airfoil) => {
  if (data.category && categoryMap.value.has(data.category)) {
    category.value = categoryMap.value.get(data.category) || null
  }
}

// Fetch categories (and airfoil only if not preloaded)
onMounted(async () => {
  try {
    loading.value = !airfoil.value

    const categories = await fetchCategories()
    categories.forEach(cat => {
      categoryMap.value.set(cat.id, cat)
    })

    if (airfoil.value) {
      resolveCategory(airfoil.value)
      return
    }

    const id = props.airfoilId
    if (!id) {
      error.value = 'No airfoil provided'
      return
    }

    const data = await fetchAirfoil(id)
    if (data) {
      airfoil.value = data
      resolveCategory(data)
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

const href = computed(() => airfoil.value?.name ? `/airfoils/${encodeURIComponent(airfoil.value.name)}` : undefined)
</script>

<template>
  <article class="relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-primary-300 hover:shadow-sm focus-within:border-primary-300">
    <!-- Shape (hero) -->
    <div class="border-b border-gray-100 px-3 py-2">
      <AirfoilGeometry
        v-if="airfoil?.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
        :upper-x="airfoil.upper_x_coordinates"
        :upper-y="airfoil.upper_y_coordinates"
        :lower-x="airfoil.lower_x_coordinates"
        :lower-y="airfoil.lower_y_coordinates"
        :name="thumbnail ? undefined : getDisplayName(airfoil)"
        :aspect-ratio="aspectRatio"
        :show-grid="!thumbnail"
        :show-legend="false"
      />
      <div
        v-else
        class="flex items-center justify-center text-xs"
        :class="error ? 'text-error-600' : 'text-gray-400'"
        :style="{ aspectRatio: `${aspectRatio} / 1` }"
      >
        {{ error || (loading ? '' : 'Geometry data not available') }}
      </div>
    </div>

    <div class="flex flex-1 flex-col gap-2 p-3">
      <div class="flex items-start justify-between gap-2">
        <h3 class="line-clamp-2 min-w-0 text-sm font-semibold leading-snug text-gray-900" :title="airfoil ? getDisplayName(airfoil) : undefined">
          <!-- The title link/button stretches over the whole card (after:inset-0) so the card is one target without nesting links -->
          <button
            v-if="onClick"
            type="button"
            class="text-left after:absolute after:inset-0 after:rounded-xl focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary-500"
            @click="onClick()"
          >
            {{ airfoil ? getDisplayName(airfoil) : 'Loading...' }}
          </button>
          <NuxtLink
            v-else-if="href"
            :to="href"
            class="after:absolute after:inset-0 after:rounded-xl focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary-500"
          >
            {{ getDisplayName(airfoil) }}
          </NuxtLink>
          <template v-else>
            {{ airfoil ? getDisplayName(airfoil) : 'Loading...' }}
          </template>
        </h3>
        <VBadge v-if="category" class="shrink-0">
          {{ formatCategoryName(category.name) }}
        </VBadge>
      </div>

      <p v-if="airfoil?.description" class="truncate text-xs text-gray-500" :title="airfoil.description">
        {{ airfoil.description }}
      </p>

      <dl v-if="airfoil" class="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-gray-100 pt-2">
        <div class="min-w-0">
          <dt class="data-label">
            Thickness
          </dt>
          <dd class="num truncate text-sm text-gray-900">
            {{ formatPercent(airfoil.thickness_pct) }}<span v-if="airfoil.thickness_loc_pct" class="text-xs text-gray-500"> @ {{ formatPercent(airfoil.thickness_loc_pct) }}</span>
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="data-label">
            Camber
          </dt>
          <dd class="num truncate text-sm text-gray-900">
            {{ formatPercent(airfoil.camber_pct) }}<span v-if="airfoil.camber_loc_pct" class="text-xs text-gray-500"> @ {{ formatPercent(airfoil.camber_loc_pct) }}</span>
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="data-label">
            LE radius
          </dt>
          <dd class="num text-sm text-gray-900">
            {{ airfoil.le_radius ? airfoil.le_radius.toFixed(2) : '—' }}
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="data-label">
            Area
          </dt>
          <dd class="num text-sm text-gray-900">
            {{ airfoil.area_coefficient !== null && airfoil.area_coefficient !== undefined ? `${(airfoil.area_coefficient * 100).toFixed(1)}%` : '—' }}
          </dd>
        </div>
      </dl>

      <a
        v-if="airfoil?.source_url"
        :href="airfoil.source_url"
        target="_blank"
        rel="noopener noreferrer"
        class="relative z-10 inline-flex items-center gap-1 self-start rounded text-xs text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        @click.stop
      >
        Source
        <Icon name="heroicons:arrow-top-right-on-square" class="h-3 w-3" />
      </a>
    </div>
  </article>
</template>
