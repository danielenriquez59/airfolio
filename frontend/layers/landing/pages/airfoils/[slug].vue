<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { AnalysisConditions } from '~/composables/useAnalysis'
import { formatCategoryName, isValidCategory } from '~/utils/categoryUtils'
import { groupAircraftUsage } from '~/utils/aircraftUsage'
import AirfoilPolarPlots from '~/components/analysis/AirfoilPolarPlots.vue'
import AirfoilPerformanceCache from '~/layers/landing/components/airfoils/AirfoilPerformanceCache.vue'
import AirfoilAircraftList from '~/layers/landing/components/airfoils/AirfoilAircraftList.vue'
import { buttonVariants, navTabButtonClasses, toggleButtonClasses } from '~/layers/ui/utils/buttons'
type Airfoil = Database['public']['Tables']['airfoils']['Row']
type Category = Database['public']['Tables']['categories']['Row']
type PerformanceCache = Database['public']['Tables']['performance_cache']['Row']

definePageMeta({
  layout: 'detail',
})

const route = useRoute()
const config = useRuntimeConfig()
const supportEmail = config.public.supportEmail
const { fetchAirfoilByName, fetchAircraftUsage, deleteAirfoil, updateAirfoil } = useAirfoils()
const { downloadLednicer, downloadSelig, downloadOpenVSP } = useAirfoilDownload()
const { submitAnalysis } = useAnalysis()
const { fetchCategories } = useCategories()
const router = useRouter()

const airfoilSlug = computed(() => route.params.slug as string)

// Fetched during prerender so the generated HTML carries the data; lazy keeps client-side navigation instant
const pageData = useAsyncData(`airfoil:${airfoilSlug.value}`, async () => {
  const [airfoil, categories] = await Promise.all([fetchAirfoilByName(airfoilSlug.value), fetchCategories()])
  // Optional section: a failed fetch is logged (in the composable) and leaves the list empty instead of failing the page
  const aircraft = airfoil
    ? await fetchAircraftUsage(airfoil.id).then(groupAircraftUsage, () => [])
    : []
  return { airfoil, category: categories.find(cat => cat.id === airfoil?.category) ?? null, aircraft }
}, { lazy: true })
const { data: page, error: loadError, pending: loading } = pageData
// A failed fetch during prerender must fail the route (not be saved as an error page); the browser then loads it via the SPA fallback
if (import.meta.server) {
  await pageData
  if (loadError.value)
    throw createError({ statusCode: 500, statusMessage: 'Could not load airfoil', fatal: true })
}
const airfoil = computed<Airfoil | null>(() => page.value?.airfoil ?? null)
const category = computed<Category | null>(() => page.value?.category ?? null)
const error = computed<string | null>(() => loadError.value
  ? (loadError.value.message || 'Failed to load airfoil')
  : (page.value && !page.value.airfoil ? 'Airfoil not found' : null))

// Admin actions (delete, rerun geometry)
const isAdmin = useIsAdmin()
const isDeleting = ref(false)
const deleteError = ref<string | null>(null)
const showDeleteModal = ref(false)
const isRerunningGeometry = ref(false)
const geometryActionError = ref<string | null>(null)
const geometryActionSuccess = ref<string | null>(null)

// Geometry tab state
const activeGeometryTab = ref<'plot' | 'bezier'>('plot')
const showPoints = ref(false)
const copiedPoints = ref(false)

const copyPointsToClipboard = async () => {
  const header = 'Index\tUpper X\tUpper Y\tLower X\tLower Y'
  const rows = coordinateTableData.value.map(row =>
    `${row.index}\t${row.upperX}\t${row.upperY}\t${row.lowerX}\t${row.lowerY}`
  )
  await navigator.clipboard.writeText([header, ...rows].join('\n'))
  copiedPoints.value = true
  setTimeout(() => { copiedPoints.value = false }, 2000)
}

// Compute coordinate table data
const coordinateTableData = computed(() => {
  if (!airfoil.value) return []

  const upperX = airfoil.value.upper_x_coordinates || []
  const upperY = airfoil.value.upper_y_coordinates || []
  const lowerX = airfoil.value.lower_x_coordinates || []
  const lowerY = airfoil.value.lower_y_coordinates || []

  const maxLength = Math.max(upperX.length, lowerX.length)
  const rows = []

  for (let i = 0; i < maxLength; i++) {
    rows.push({
      index: i + 1,
      upperX: upperX[i] !== undefined ? upperX[i].toFixed(6) : '-',
      upperY: upperY[i] !== undefined ? upperY[i].toFixed(6) : '-',
      lowerX: lowerX[i] !== undefined ? lowerX[i].toFixed(6) : '-',
      lowerY: lowerY[i] !== undefined ? lowerY[i].toFixed(6) : '-',
    })
  }

  return rows
})

// Download formats (menu items)
const downloadFormats = [
  { value: 'lednicer', text: 'Lednicer', description: 'Upper and lower surfaces listed separately with point counts in the header.' },
  { value: 'selig', text: 'Selig', description: 'Continuous loop from upper TE around LE to lower TE. Most common format for XFOIL.' },
  { value: 'openvsp', text: 'OpenVSP AF', description: 'Includes header with symmetry flag and point counts. Used by OpenVSP.' },
]

// Handle download based on selected format
const handleDownload = (format: string) => {
  if (!airfoil.value) return
  
  try {
    switch (format) {
      case 'lednicer':
        downloadLednicer(airfoil.value)
        break
      case 'selig':
        downloadSelig(airfoil.value)
        break
      case 'openvsp':
        downloadOpenVSP(airfoil.value)
        break
    }
  } catch (err: any) {
    console.error('Download error:', err)
    alert(err.message || 'Failed to download airfoil')
  }
}

// Modal state
const showAnalysisModal = ref(false)
const isRunningAnalysis = ref(false)
const analysisError = ref<string | null>(null)
const analysisParamsFormRef = ref<{ submit: () => void; isValid: boolean } | null>(null)

// Cache and plotting state
const cacheRefreshKey = ref(0)
const cacheRef = ref<{ refresh: () => Promise<void> } | null>(null)
const selectedCacheEntries = ref<PerformanceCache[]>([])
const performanceDataForPlots = ref<Array<{
  name: string
  alpha: number[]
  CL: number[]
  CD: number[]
  CM: number[]
}>>([])
const plotsRef = ref<{ resetZoom: () => void; toggleTooltips: () => void; tooltipsEnabled: boolean } | null>(null)
const tooltipsEnabled = ref(true)

const handleTooltipsToggled = (enabled: boolean) => {
  tooltipsEnabled.value = enabled
}

// CSV export helpers
const copiedToClipboard = ref(false)

const generateCSV = (): string => {
  const lines: string[] = ['Mach,Re,aoa,CL,CD,CM']

  for (const entry of selectedCacheEntries.value) {
    const inputs = entry.inputs as any
    const outputs = entry.outputs as any
    const mach = inputs?.Mach ?? ''
    const re = inputs?.Re ?? ''
    const alphas = outputs?.alpha || []
    const CLs = outputs?.CL || []
    const CDs = outputs?.CD || []
    const CMs = outputs?.CM || []

    for (let i = 0; i < alphas.length; i++) {
      lines.push(`${mach},${re},${alphas[i]},${CLs[i]},${CDs[i]},${CMs[i]}`)
    }
  }

  return lines.join('\n')
}

const copyCSVToClipboard = async () => {
  const csv = generateCSV()
  await navigator.clipboard.writeText(csv)
  copiedToClipboard.value = true
  setTimeout(() => { copiedToClipboard.value = false }, 2000)
}

const downloadCSV = () => {
  const csv = generateCSV()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const name = airfoil.value ? (airfoil.value.display_name || airfoil.value.name) : 'airfoil'
  link.download = `${name}_performance.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// Sync initial tooltip state when component is ready
watchEffect(() => {
  if (plotsRef.value) {
    tooltipsEnabled.value = plotsRef.value.tooltipsEnabled
  }
})

// Helper function to get display name (display_name if available, otherwise name)
const getDisplayName = (airfoil: Airfoil | null): string => {
  if (!airfoil) return ''
  return airfoil.display_name || airfoil.name
}

/** Open the delete confirmation modal. */
const openDeleteModal = () => {
  if (!airfoil.value || isDeleting.value)
    return
  deleteError.value = null
  showDeleteModal.value = true
}

/** Hard-delete this airfoil and related performance cache, then go to search. */
const confirmDeleteAirfoil = async () => {
  if (!airfoil.value || isDeleting.value)
    return

  isDeleting.value = true
  deleteError.value = null
  try {
    await deleteAirfoil(airfoil.value.id)
    showDeleteModal.value = false
    await router.push('/search')
  }
  catch (err: unknown) {
    deleteError.value = err instanceof Error ? err.message : 'Failed to delete airfoil'
  }
  finally {
    isDeleting.value = false
  }
}

/** Recalculate thickness/camber/etc via AeroSandbox and persist to the DB. */
const handleRerunGeometryParams = async () => {
  if (!airfoil.value || isRerunningGeometry.value)
    return

  const upperX = airfoil.value.upper_x_coordinates || []
  const upperY = airfoil.value.upper_y_coordinates || []
  const lowerX = airfoil.value.lower_x_coordinates || []
  const lowerY = airfoil.value.lower_y_coordinates || []

  if (upperX.length < 2 || lowerX.length < 2) {
    geometryActionError.value = 'Airfoil is missing coordinate data'
    return
  }

  isRerunningGeometry.value = true
  geometryActionError.value = null
  geometryActionSuccess.value = null

  try {
    const upper_surface = upperX.map((x, i) => ({ x, y: upperY[i] ?? 0 }))
    const lower_surface = lowerX.map((x, i) => ({ x, y: lowerY[i] ?? 0 }))

    const response = await $fetch<{
      success: boolean
      calculated_properties?: Record<string, unknown>
      error?: string
    }>(`${config.public.backendUrl}/api/airfoils/recalculate-geometry`, {
      method: 'POST',
      body: { upper_surface, lower_surface },
    })

    if (!response.success || !response.calculated_properties) {
      geometryActionError.value = response.error || 'Geometry recalculation failed'
      return
    }

    const props = response.calculated_properties
    const updated = await updateAirfoil(airfoil.value.id, {
      thickness_pct: props.thickness_pct as number | null,
      thickness_loc_pct: props.thickness_loc_pct as number | null,
      camber_pct: props.camber_pct as number | null,
      camber_loc_pct: props.camber_loc_pct as number | null,
      area_coefficient: props.area_coefficient as number | null,
      le_radius: props.le_radius as number | null,
      te_thickness: props.te_thickness as number | null,
      te_angle: props.te_angle as number | null,
      upper_surface_nodes: props.upper_surface_nodes as number | null,
      lower_surface_nodes: props.lower_surface_nodes as number | null,
      upper_x_coordinates: props.upper_x_coordinates as number[] | null,
      upper_y_coordinates: props.upper_y_coordinates as number[] | null,
      lower_x_coordinates: props.lower_x_coordinates as number[] | null,
      lower_y_coordinates: props.lower_y_coordinates as number[] | null,
    })

    // airfoil is computed over the page data, so patch that in place
    if (page.value)
      page.value = { ...page.value, airfoil: updated }
    geometryActionSuccess.value = 'Geometry parameters updated'
  }
  catch (err: unknown) {
    geometryActionError.value = err instanceof Error ? err.message : 'Failed to rerun geometry params'
  }
  finally {
    isRerunningGeometry.value = false
  }
}

// Helper function to create URL-friendly slug from airfoil name
const createSlug = (name: string): string => {
  return encodeURIComponent(name)
}

/**
 * Format condition inputs into readable string (same as in AirfoilPerformanceCache)
 */
const formatCondition = (inputs: any): string => {
  if (!inputs || typeof inputs !== 'object') return 'Unknown conditions'
  
  const parts: string[] = []
  
  if (inputs.Re !== undefined && inputs.Re !== null) {
    const re = inputs.Re
    if (re >= 1000) {
      parts.push(`Re ${(re / 1000).toFixed(0)}k`)
    } else {
      parts.push(`Re ${re.toFixed(0)}`)
    }
  }
  
  if (inputs.Mach !== undefined && inputs.Mach !== null) {
    parts.push(`Mach ${inputs.Mach.toFixed(1)}`)
  }
  
  if (inputs.n_crit !== undefined && inputs.n_crit !== null) {
    parts.push(`Ncrit ${inputs.n_crit.toFixed(0)}`)
  }
  
  // Alpha range - format as "AoA Range [start, end]"
  if (inputs.alpha_range && Array.isArray(inputs.alpha_range) && inputs.alpha_range.length === 3) {
    const [start, end] = inputs.alpha_range
    parts.push(`AoA Range [${start.toFixed(0)}, ${end.toFixed(0)}]`)
  }
  
  // Control surface fraction - only show if not 0
  const csFrac = inputs.control_surface_fraction ?? 0
  if (csFrac !== 0) {
    parts.push(`Control Fraction ${csFrac.toFixed(1)}`)
  }
  
  // Control surface deflection - only show if not 0
  const csDef = inputs.control_surface_deflection ?? 0
  if (csDef !== 0) {
    parts.push(`Control Deflection ${csDef.toFixed(1)}`)
  }
  
  return parts.join(', ')
}

/**
 * Handle analysis params submit from form
 */
const handleModalSubmit = async (params: {
  reynoldsNumber: number
  machNumber: number
  alphaMin: number
  alphaMax: number
  nCrit: number
}) => {
  if (!airfoil.value?.id) return
  
  isRunningAnalysis.value = true
  analysisError.value = null
  
  try {
    const conditions: AnalysisConditions = {
      Re: params.reynoldsNumber * 1000,
      Mach: params.machNumber,
      alpha_range: [params.alphaMin, params.alphaMax, 0.5],
      n_crit: params.nCrit,
      control_surface_fraction: 0,
      control_surface_deflection: 0,
    }
    
    const response = await submitAnalysis([airfoil.value.id], conditions)
    
    // Refresh cache list by incrementing key to force component re-render
    cacheRefreshKey.value++
    
    // Also try calling refresh method if available
    await nextTick()
    if (cacheRef.value && typeof cacheRef.value.refresh === 'function') {
      await cacheRef.value.refresh()
    }
    
    // Close modal
    showAnalysisModal.value = false
  } catch (err: any) {
    console.error('Error running analysis:', err)
    analysisError.value = err.message || 'Analysis failed'
  } finally {
    isRunningAnalysis.value = false
  }
}

/**
 * Handle selection change from cache component
 */
const handleSelectionChange = async (entries: PerformanceCache[]) => {
  selectedCacheEntries.value = entries
  
  // Transform cache entries to plot format
  performanceDataForPlots.value = entries.map(entry => {
    const outputs = entry.outputs as any
    return {
      name: formatCondition(entry.inputs),
      alpha: outputs?.alpha || [],
      CL: outputs?.CL || [],
      CD: outputs?.CD || [],
      CM: outputs?.CM || [],
    }
  })
}

// Same address as the sitemap entry, whatever spelling of the slug was requested
const pageUrl = withSiteUrl(computed(() => `/airfoils/${createSlug(airfoil.value?.name ?? airfoilSlug.value)}`))
const pageTitle = computed(() => {
  if (airfoil.value) return `${getDisplayName(airfoil.value).toUpperCase()} Airfoil - Coordinates, Geometry and Polars`
  return error.value === 'Airfoil not found' ? 'Airfoil not found' : 'Airfoil Details'
})
const pageDescription = computed(() => airfoil.value
  ? airfoilMetaDescription(airfoil.value, getDisplayName(airfoil.value).toUpperCase(), category.value ? formatCategoryName(category.value.name) : undefined)
  : 'View detailed airfoil geometry, performance data, and analysis results.')

useHead({
  title: pageTitle,
  link: [{ rel: 'canonical', href: pageUrl }],
  meta: [
    { name: 'description', content: pageDescription },
    { property: 'og:title', content: pageTitle },
    { property: 'og:description', content: pageDescription },
    { property: 'og:url', content: pageUrl },
    { name: 'twitter:title', content: pageTitle },
    { name: 'twitter:description', content: pageDescription },
  ],
})
</script>

<template>
  <div>
    <VStateBlock v-if="loading" variant="loading" />

    <VStateBlock
      v-else-if="error === 'Airfoil not found'"
      title="Airfoil not found"
      :description="`No airfoil named “${airfoilSlug}” is in the catalog.`"
      icon="heroicons:magnifying-glass"
    >
      <VButton to="/search" color="light">
        Back to search
      </VButton>
    </VStateBlock>

    <VStateBlock
      v-else-if="error"
      variant="error"
      title="Could not load this airfoil"
      :description="error"
    >
      <VButton to="/search" color="light">
        Back to search
      </VButton>
    </VStateBlock>

    <!-- Airfoil Details -->
    <div v-else-if="airfoil" class="space-y-6">
      <PageHeader :title="getDisplayName(airfoil).toUpperCase()" :subtitle="airfoil.description || undefined" class="!mb-0">
        <template #eyebrow>
          <div class="flex flex-wrap items-center gap-2">
            <nav aria-label="Breadcrumb">
              <ol class="flex items-center gap-1.5">
                <li>
                  <NuxtLink to="/search" class="rounded hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                    Airfoils
                  </NuxtLink>
                </li>
                <li aria-hidden="true" class="flex">
                  <Icon name="heroicons:chevron-right" class="h-3 w-3" />
                </li>
                <li aria-current="page" class="text-gray-700">
                  {{ getDisplayName(airfoil) }}
                </li>
              </ol>
            </nav>
            <VBadge v-if="category" tone="primary" class="normal-case tracking-normal">
              {{ formatCategoryName(category.name) }}
            </VBadge>
          </div>
        </template>
      </PageHeader>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Geometry plot / Bezier fit, with the parameters below (visible on both tabs) -->
        <div class="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <VPanel>
            <div class="-mx-4 -mt-4 mb-4 flex gap-2 border-b border-gray-200 px-4 sm:-mx-5 sm:-mt-5 sm:mb-5 sm:px-5">
              <button
                type="button"
                :class="navTabButtonClasses(activeGeometryTab === 'plot')"
                :aria-pressed="activeGeometryTab === 'plot'"
                @click="activeGeometryTab = 'plot'"
              >
                Geometry
              </button>
              <button
                type="button"
                :class="navTabButtonClasses(activeGeometryTab === 'bezier')"
                :aria-pressed="activeGeometryTab === 'bezier'"
                @click="activeGeometryTab = 'bezier'"
              >
                Bezier Fit
              </button>
            </div>

            <!-- Geometry Tab -->
            <div v-if="activeGeometryTab === 'plot'">
              <AirfoilGeometry
                v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
                :upper-x="airfoil.upper_x_coordinates"
                :upper-y="airfoil.upper_y_coordinates"
                :lower-x="airfoil.lower_x_coordinates"
                :lower-y="airfoil.lower_y_coordinates"
                :name="getDisplayName(airfoil)"
                :aspect-ratio="7"
                :show-grid="true"
                :zoomable="true"
                :show-points-on-hover="false"
                :show-marker-toggle="true"
              />
              <VStateBlock v-else title="Geometry data not available" />
            </div>

            <!-- Bezier Fit Tab -->
            <div v-else-if="activeGeometryTab === 'bezier'">
              <BezierFitTab
                v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates"
                :upper-x="airfoil.upper_x_coordinates"
                :upper-y="airfoil.upper_y_coordinates"
                :lower-x="airfoil.lower_x_coordinates"
                :lower-y="airfoil.lower_y_coordinates"
                :airfoil-name="getDisplayName(airfoil)"
              />
              <VStateBlock v-else title="Geometry data not available for Bezier fitting" />
            </div>

            <!-- Geometric parameters -->
            <div class="mt-5 border-t border-gray-200 pt-4">
              <h3 class="sr-only">
                Geometric parameters
              </h3>
              <dl class="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
                <VStat
                  v-if="airfoil.thickness_pct"
                  label="Thickness (t/c)"
                  :value="(airfoil.thickness_pct * 100).toFixed(2)"
                  unit="%"
                  :hint="airfoil.thickness_loc_pct ? `at ${(airfoil.thickness_loc_pct * 100).toFixed(1)}% x/c` : undefined"
                />
                <VStat
                  v-if="airfoil.camber_pct"
                  label="Camber (y/c)"
                  :value="(airfoil.camber_pct * 100).toFixed(2)"
                  unit="%"
                  :hint="airfoil.camber_loc_pct ? `at ${(airfoil.camber_loc_pct * 100).toFixed(1)}% x/c` : undefined"
                />
                <VStat
                  v-if="airfoil.area_coefficient !== null && airfoil.area_coefficient !== undefined"
                  label="Area (A/c²)"
                  :value="(airfoil.area_coefficient * 100).toFixed(2)"
                  unit="% c²"
                />
                <VStat v-if="airfoil.le_radius" label="LE radius" :value="airfoil.le_radius.toFixed(4)" />
                <VStat v-if="airfoil.te_thickness" label="TE thickness" :value="airfoil.te_thickness.toFixed(4)" />
                <VStat
                  v-if="airfoil.upper_surface_nodes !== null && airfoil.upper_surface_nodes !== undefined"
                  label="Upper nodes"
                  :value="airfoil.upper_surface_nodes"
                />
                <VStat
                  v-if="airfoil.lower_surface_nodes !== null && airfoil.lower_surface_nodes !== undefined"
                  label="Lower nodes"
                  :value="airfoil.lower_surface_nodes"
                />
              </dl>
            </div>
          </VPanel>
          <!-- Download sits at the row end, so its right-anchored menu always opens inside the row -->
          <div class="flex flex-wrap items-center gap-2 empty:hidden">
            <VButton v-if="airfoil.id" color="primary" @click="showAnalysisModal = true">
              <Icon name="tabler:brain" class="h-4 w-4" aria-hidden="true" />
              Run NN Analysis
            </VButton>
            <VButton
              v-if="airfoil.id"
              :to="`/control-surface?airfoil=${encodeURIComponent(airfoilSlug)}`"
              color="light"
            >
              <Icon name="tabler:angle" class="h-4 w-4" aria-hidden="true" />
              Control Surface Analysis
            </VButton>
            <VButton
              v-if="airfoil.id"
              :to="`/tools/numerical-analysis-2d?airfoil=${encodeURIComponent(airfoilSlug)}`"
              color="light"
            >
              <Icon name="tabler:wind" class="h-4 w-4" aria-hidden="true" />
              Numerical Analysis 2D
            </VButton>
            <VDropdown
              v-if="airfoil.upper_x_coordinates && airfoil.upper_y_coordinates && airfoil.lower_x_coordinates && airfoil.lower_y_coordinates && airfoil.upper_surface_nodes && airfoil.lower_surface_nodes"
              right
              class="ml-auto"
            >
              <template #activator>
                <VDropdownButton as="button" type="button" :class="buttonVariants({ color: 'light', size: 'md' })">
                  <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" aria-hidden="true" />
                  Download
                  <Icon name="heroicons:chevron-down" class="h-4 w-4 text-gray-500" aria-hidden="true" />
                </VDropdownButton>
              </template>
              <VDropdownItem
                v-for="format in downloadFormats"
                :key="format.value"
                @click="handleDownload(format.value)"
              >
                <span class="block text-left">
                  <span class="block font-medium text-gray-900">{{ format.text }}</span>
                  <span class="mt-0.5 block text-xs text-gray-500">{{ format.description }}</span>
                </span>
              </VDropdownItem>
            </VDropdown>
          </div>
        </div>

        <!-- Points and details: on lg+ the column takes the row height set by the left cell (geometry + buttons) -->
        <div class="flex min-w-0 flex-col gap-6">
          <!-- lg+: flush body is a relative flex-1 box; the scroller is absolute so the table never makes the row taller -->
          <VPanel
            v-if="coordinateTableData.length > 0"
            flush
            class="flex flex-col lg:max-h-[32rem] lg:flex-1 lg:[&>div:last-child]:relative lg:[&>div:last-child]:min-h-[7rem] lg:[&>div:last-child]:flex-1"
            :class="{ 'max-lg:[&>div:last-child]:hidden': !showPoints }"
          >
            <template #title>
              Points <span class="num text-xs font-normal text-gray-500">({{ coordinateTableData.length }} rows)</span>
            </template>
            <template #actions>
              <button
                type="button"
                class="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden"
                :aria-expanded="showPoints"
                aria-controls="coordinate-points"
                @click="showPoints = !showPoints"
              >
                <Icon
                  name="heroicons:chevron-right"
                  class="h-4 w-4 transition-transform"
                  :class="{ 'rotate-90': showPoints }"
                  aria-hidden="true"
                />
                {{ showPoints ? 'Hide points' : 'Show points' }}
              </button>
              <VButton
                :class="{ 'hidden lg:inline-flex': !showPoints }"
                type="button"
                color="light"
                size="sm"
                @click="copyPointsToClipboard"
              >
                <Icon :name="copiedPoints ? 'heroicons:check' : 'heroicons:clipboard-document'" class="h-4 w-4" aria-hidden="true" />
                {{ copiedPoints ? 'Copied' : 'Copy' }}
              </VButton>
            </template>
            <div id="coordinate-points" class="max-h-[300px] overflow-auto lg:absolute lg:inset-0 lg:max-h-none">
              <table class="min-w-full text-xs">
                <thead class="sticky top-0 bg-gray-50 shadow-[inset_0_-1px_0] shadow-gray-200">
                  <tr>
                    <th scope="col" class="data-label px-1.5 py-2 text-right first:pl-3 last:pr-3">
                      Upper X
                    </th>
                    <th scope="col" class="data-label px-1.5 py-2 text-right first:pl-3 last:pr-3">
                      Upper Y
                    </th>
                    <th scope="col" class="data-label px-1.5 py-2 text-right first:pl-3 last:pr-3">
                      Lower X
                    </th>
                    <th scope="col" class="data-label px-1.5 py-2 text-right first:pl-3 last:pr-3">
                      Lower Y
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="row in coordinateTableData" :key="row.index" class="num text-right text-gray-900 hover:bg-gray-50">
                    <td class="px-1.5 py-1 first:pl-3 last:pr-3">
                      {{ row.upperX }}
                    </td>
                    <td class="px-1.5 py-1 first:pl-3 last:pr-3">
                      {{ row.upperY }}
                    </td>
                    <td class="px-1.5 py-1 first:pl-3 last:pr-3">
                      {{ row.lowerX }}
                    </td>
                    <td class="px-1.5 py-1 first:pl-3 last:pr-3">
                      {{ row.lowerY }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </VPanel>
          <VPanel v-if="category || airfoil.source_url || airfoil.created_at" title="Details">
            <dl class="space-y-4 text-sm">
              <div v-if="category">
                <dt class="data-label">
                  Category
                </dt>
                <dd class="mt-1">
                  <VBadge tone="primary">
                    {{ formatCategoryName(category.name) }}
                  </VBadge>
                </dd>
              </div>
              <div v-if="airfoil.source_url" class="min-w-0">
                <dt class="data-label">
                  Source
                </dt>
                <dd class="mt-1 min-w-0">
                  <a
                    :href="airfoil.source_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex min-w-0 items-center gap-1 rounded text-primary-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <span class="truncate">{{ airfoil.source_url }}</span>
                    <Icon name="heroicons:arrow-top-right-on-square" class="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span class="sr-only">(opens in a new tab)</span>
                  </a>
                </dd>
              </div>
              <div v-if="airfoil.created_at">
                <dt class="data-label">
                  Added
                </dt>
                <dd class="mt-1 text-gray-900">
                  <!-- the visitor's locale and time zone are only known in the browser -->
                  <ClientOnly>{{ new Date(airfoil.created_at).toLocaleDateString() }}</ClientOnly>
                </dd>
              </div>
            </dl>
          </VPanel>
        </div>
      </div>

      <!-- Admin tools -->
      <VPanel v-if="isAdmin && airfoil.id" title="Admin">
        <template #actions>
          <VButton
            type="button"
            color="light"
            size="sm"
            :disabled="isRerunningGeometry || isDeleting"
            @click="handleRerunGeometryParams"
          >
            <Icon name="heroicons:arrow-path" class="h-4 w-4" aria-hidden="true" />
            {{ isRerunningGeometry ? 'Rerunning…' : 'Rerun Geometry Params' }}
          </VButton>
          <VButton
            type="button"
            color="error"
            size="sm"
            :disabled="isDeleting || isRerunningGeometry"
            @click="openDeleteModal"
          >
            <Icon name="heroicons:trash" class="h-4 w-4" aria-hidden="true" />
            {{ isDeleting ? 'Deleting…' : 'Delete Airfoil' }}
          </VButton>
        </template>
        <p v-if="geometryActionError" class="text-sm text-error-700" role="alert">
          {{ geometryActionError }}
        </p>
        <p v-else-if="geometryActionSuccess" class="text-sm text-success-700" role="status">
          {{ geometryActionSuccess }}
        </p>
        <p v-else class="text-sm text-gray-500">
          Rerun recalculates the geometric parameters with AeroSandbox and saves them. Delete removes the airfoil and its cached polars.
        </p>
      </VPanel>

      <AirfoilAircraftList :aircraft="page?.aircraft ?? []" />

      <!-- Performance Data -->
      <template v-if="airfoil.id">
        <AirfoilPerformanceCache
          :key="`cache-${airfoil.id}-${cacheRefreshKey}`"
          ref="cacheRef"
          :airfoil-id="airfoil.id"
          @selection-change="handleSelectionChange"
        >
          <template v-if="selectedCacheEntries.length > 0" #actions>
            <VButton type="button" color="light" size="sm" @click="copyCSVToClipboard">
              <Icon :name="copiedToClipboard ? 'heroicons:check' : 'heroicons:clipboard-document'" class="h-4 w-4" aria-hidden="true" />
              {{ copiedToClipboard ? 'Copied!' : 'Copy to Clipboard' }}
            </VButton>
            <VButton type="button" color="light" size="sm" @click="downloadCSV">
              <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" aria-hidden="true" />
              Download CSV
            </VButton>
          </template>
        </AirfoilPerformanceCache>

        <VPanel title="Polar plots">
          <template v-if="performanceDataForPlots.length > 0" #actions>
            <button
              type="button"
              :class="toggleButtonClasses(tooltipsEnabled)"
              class="!h-8 !px-3"
              :aria-pressed="tooltipsEnabled"
              @click="plotsRef?.toggleTooltips()"
            >
              <Icon name="heroicons:cursor-arrow-rays" class="h-4 w-4" aria-hidden="true" />
              Data hover
            </button>
            <VButton type="button" color="light" size="sm" @click="plotsRef?.resetZoom()">
              <Icon name="heroicons:arrow-path" class="h-4 w-4" aria-hidden="true" />
              Reset zoom
            </VButton>
          </template>
          <AirfoilPolarPlots
            ref="plotsRef"
            :performance-data="performanceDataForPlots"
            :show-controls="false"
            @tooltips-toggled="handleTooltipsToggled"
          />
        </VPanel>
      </template>

      <!-- Data Accuracy Notice -->
      <p class="text-xs text-gray-500">
        Spotted an issue with this airfoil's geometry, stats, categorization, or description? Help keep the database accurate: email
        <a :href="`mailto:${supportEmail}`" class="underline underline-offset-2 hover:text-gray-700">{{ supportEmail }}</a>.
      </p>
    </div>

    <!-- Analysis Modal -->
    <VModal v-model="showAnalysisModal">
      <VModalHeader dismissable>
        Run NN Analysis
      </VModalHeader>
      <VModalBody>
        <div class="space-y-4">
          <p class="text-sm text-gray-600">
            Configure the flow conditions for the performance analysis.
          </p>

          <AnalysisParametersForm
            ref="analysisParamsFormRef"
            @submit="handleModalSubmit"
          />

          <div v-if="analysisError" class="rounded-lg border border-error-200 bg-error-50 p-3" role="alert">
            <p class="text-sm text-error-700">
              {{ analysisError }}
            </p>
          </div>

          <VStateBlock v-if="isRunningAnalysis" variant="loading" title="Running analysis…" class="!py-4" />
        </div>
      </VModalBody>
      <VModalFooter>
        <VButton
          type="button"
          color="light"
          :disabled="isRunningAnalysis"
          @click="showAnalysisModal = false"
        >
          Cancel
        </VButton>
        <VButton
          type="button"
          color="primary"
          :disabled="!analysisParamsFormRef?.isValid || isRunningAnalysis"
          @click="analysisParamsFormRef?.submit()"
        >
          Run Analysis
        </VButton>
      </VModalFooter>
    </VModal>

    <!-- Admin: delete confirmation modal -->
    <VModal v-if="isAdmin" v-model="showDeleteModal">
      <VModalHeader dismissable>
        Delete Airfoil
      </VModalHeader>
      <VModalBody>
        <p class="text-sm text-gray-700">
          Permanently delete
          <span class="font-semibold">{{ getDisplayName(airfoil) }}</span>
          and all related performance cache? This cannot be undone.
        </p>
        <div v-if="deleteError" class="mt-4 rounded-lg border border-error-200 bg-error-50 p-3" role="alert">
          <p class="text-sm text-error-700">
            {{ deleteError }}
          </p>
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
          {{ isDeleting ? 'Deleting…' : 'Delete Airfoil' }}
        </VButton>
      </VModalFooter>
    </VModal>
  </div>
</template>
