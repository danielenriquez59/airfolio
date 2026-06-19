<script setup lang="ts">
import type { Database } from '~/types/database.types'
import SparAirfoilSelector from '~/layers/landing/components/spar/SparAirfoilSelector.vue'
import { parseAirfoilPointFile } from '~/composables/useAirfoilPointImport'
import { tabButtonClasses } from '~/layers/ui/utils/buttons'

definePageMeta({
  layout: 'detail',
})

useSeoMeta({
  title: 'Bezier Fit - Parameterize Airfoils with Bezier Curves',
  description: 'Fit Bezier splines to existing airfoils or uploaded coordinate files. Reparametrize geometry and export control points or coordinate data.',
  ogTitle: 'Bezier Fit - Parameterize Airfoils with Bezier Curves',
  ogDescription: 'Fit Bezier splines to airfoil geometry, reparametrize points, and export results.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

type Airfoil = Database['public']['Tables']['airfoils']['Row']
type SourceMode = 'catalog' | 'upload'

const DEFAULT_AIRFOIL_NAME = 'naca0012'

const { fetchAirfoil, fetchAirfoilByName } = useAirfoils()

const sourceMode = ref<SourceMode>('catalog')
const selectedAirfoil = ref<Airfoil | null>(null)
const isLoadingGeometry = ref(false)
const loadError = ref<string | null>(null)
const importWarnings = ref<string[]>([])
const uploadedFileName = ref('')

const geometry = ref<{
  upperX: number[]
  upperY: number[]
  lowerX: number[]
  lowerY: number[]
  name: string
} | null>(null)

const fileInput = ref<HTMLInputElement | null>(null)

const hasGeometry = computed(() =>
  geometry.value !== null
  && geometry.value.upperX.length >= 2
  && geometry.value.lowerX.length >= 2,
)

const clearGeometry = () => {
  geometry.value = null
  loadError.value = null
  importWarnings.value = []
}

const loadDefaultAirfoil = async () => {
  loadError.value = null
  try {
    const airfoil = await fetchAirfoilByName(DEFAULT_AIRFOIL_NAME)
    if (airfoil)
      selectedAirfoil.value = airfoil
    else
      loadError.value = 'Default airfoil NACA 0012 was not found in the database'
  }
  catch (err: unknown) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load default airfoil'
  }
}

watch(sourceMode, (mode) => {
  loadError.value = null
  uploadedFileName.value = ''
  if (fileInput.value)
    fileInput.value.value = ''

  if (mode === 'catalog') {
    importWarnings.value = []
    if (!selectedAirfoil.value)
      loadDefaultAirfoil()
  }
})

onMounted(() => {
  if (sourceMode.value === 'catalog')
    loadDefaultAirfoil()
})

watch(selectedAirfoil, async (airfoil) => {
  if (sourceMode.value !== 'catalog')
    return

  clearGeometry()

  if (!airfoil)
    return

  isLoadingGeometry.value = true
  try {
    const full = await fetchAirfoil(airfoil.id)
    if (!full?.upper_x_coordinates?.length || !full?.lower_x_coordinates?.length) {
      loadError.value = 'Selected airfoil has no geometry data'
      return
    }

    geometry.value = {
      upperX: full.upper_x_coordinates,
      upperY: full.upper_y_coordinates ?? [],
      lowerX: full.lower_x_coordinates,
      lowerY: full.lower_y_coordinates ?? [],
      name: full.display_name || full.name,
    }
  }
  catch (err: unknown) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load airfoil geometry'
  }
  finally {
    isLoadingGeometry.value = false
  }
})

const handleFileSelect = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return

  uploadedFileName.value = file.name
  loadError.value = null
  importWarnings.value = []
  geometry.value = null

  try {
    const content = await file.text()
    const result = parseAirfoilPointFile(content, file.name)

    importWarnings.value = result.warnings

    if (result.error) {
      loadError.value = result.error
      return
    }

    geometry.value = {
      upperX: result.upperX,
      upperY: result.upperY,
      lowerX: result.lowerX,
      lowerY: result.lowerY,
      name: result.name || file.name.replace(/\.[^.]+$/, ''),
    }
  }
  catch (err: unknown) {
    loadError.value = err instanceof Error ? err.message : 'Failed to read file'
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const clearUpload = () => {
  uploadedFileName.value = ''
  if (fileInput.value)
    fileInput.value.value = ''
  clearGeometry()
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-0">
    <PageHeader
      title="Bezier Fit"
      subtitle="Fit Bezier splines to airfoil geometry and export reparametrized coordinates"
    />

    <div class="space-y-1 w-full">
      <!-- Source selection -->
      <section class="w-full" aria-label="Airfoil source">
        <div
          class="grid grid-cols-2 w-full max-w-md rounded-lg border border-gray-200 p-1 bg-gray-50 mb-6"
          role="tablist"
          aria-label="Source type"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="sourceMode === 'catalog'"
            :class="tabButtonClasses(sourceMode === 'catalog')"
            @click="sourceMode = 'catalog'"
          >
            Existing Airfoil
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="sourceMode === 'upload'"
            :class="tabButtonClasses(sourceMode === 'upload')"
            @click="sourceMode = 'upload'"
          >
            Upload File
          </button>
        </div>

        <div class="w-full py-1">
          <div v-show="sourceMode === 'catalog'" role="tabpanel" class="w-full">
            <SparAirfoilSelector v-model="selectedAirfoil" :show-selection-summary="false" />
          </div>

          <div v-show="sourceMode === 'upload'" role="tabpanel" class="w-full space-y-4">
            <div
              class="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
              @click="triggerFileInput"
            >
              <input
                ref="fileInput"
                type="file"
                accept=".csv,.txt,.dat"
                class="hidden"
                @change="handleFileSelect"
              />
              <Icon name="heroicons:document-arrow-up" class="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p class="text-sm font-medium text-gray-900">
                Click to upload coordinate file
              </p>
              <p class="text-xs text-gray-500 mt-1">
                TXT, CSV, or DAT with X,Y points (comma or space separated)
              </p>
              <p v-if="uploadedFileName" class="text-sm text-indigo-600 font-medium mt-3">
                {{ uploadedFileName }}
              </p>
            </div>

            <div class="flex gap-2">
              <VButton
                v-if="uploadedFileName"
                type="button"
                color="neutral"
                size="sm"
                @click="clearUpload"
              >
                Clear File
              </VButton>
            </div>

            <details class="text-sm text-gray-600">
              <summary class="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                Upload format tips
              </summary>
              <ul class="mt-2 list-disc list-inside space-y-1 text-xs text-gray-500">
                <li>Points are sorted by X and split into upper/lower surfaces automatically</li>
                <li>Optional blank line separates upper and lower surfaces explicitly</li>
                <li>First non-numeric line may be used as the airfoil name</li>
              </ul>
            </details>
          </div>
        </div>
      </section>

      <!-- Loading -->
      <div v-if="isLoadingGeometry" class="flex items-center justify-center py-8 w-full">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>

      <!-- Error -->
      <div v-else-if="loadError" class="w-full p-4 bg-red-50 border border-red-200 rounded-md">
        <div class="flex">
          <Icon name="heroicons:exclamation-triangle" class="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
          <p class="text-sm text-red-800">{{ loadError }}</p>
        </div>
      </div>

      <!-- Geometry / fit -->
      <section v-else-if="hasGeometry && geometry" class="w-full" aria-label="Bezier fit">
        <div class="mb-4">
          <p class="text-sm text-gray-500 mt-1">
            Upper: {{ geometry.upperX.length }} points · Lower: {{ geometry.lowerX.length }} points
          </p>
        </div>

        <div
          v-if="importWarnings.length > 0"
          class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800"
        >
          <p class="font-medium mb-1">Import notes</p>
          <ul class="list-disc list-inside space-y-0.5 text-xs">
            <li v-for="(warning, i) in importWarnings" :key="i">
              {{ warning }}
            </li>
          </ul>
        </div>

        <BezierFitTab
          :upper-x="geometry.upperX"
          :upper-y="geometry.upperY"
          :lower-x="geometry.lowerX"
          :lower-y="geometry.lowerY"
          :airfoil-name="geometry.name"
        />
      </section>

      <!-- Empty state -->
      <section
        v-else-if="!isLoadingGeometry"
        class="w-full py-12 text-center text-gray-500"
        aria-label="No geometry loaded"
      >
        <Icon name="heroicons:chart-bar" class="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p class="font-medium text-gray-700">
          Upload a coordinate file to begin, or select an airfoil above
        </p>
        <p class="text-sm mt-2">
          Choose a source above, then run Bezier fitting and export control points or reparametrized coordinates.
        </p>
      </section>
    </div>
  </div>
</template>
