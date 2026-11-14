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
  <div>
    <PageHeader
      title="Bezier Fit"
      subtitle="Fit Bezier splines to airfoil geometry and export reparametrized coordinates"
      eyebrow="Tools"
    />

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Source selection -->
      <div class="min-w-0 space-y-6">
        <VPanel title="Source">
          <div class="space-y-4">
            <div
              class="grid w-full grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1"
              role="tablist"
              aria-label="Source type"
            >
              <button
                type="button"
                role="tab"
                :aria-selected="sourceMode === 'catalog'"
                class="justify-center"
                :class="tabButtonClasses(sourceMode === 'catalog')"
                @click="sourceMode = 'catalog'"
              >
                Existing airfoil
              </button>
              <button
                type="button"
                role="tab"
                :aria-selected="sourceMode === 'upload'"
                class="justify-center"
                :class="tabButtonClasses(sourceMode === 'upload')"
                @click="sourceMode = 'upload'"
              >
                Upload file
              </button>
            </div>

            <div v-show="sourceMode === 'catalog'" role="tabpanel">
              <SparAirfoilSelector v-model="selectedAirfoil" :show-selection-summary="false" />
            </div>

            <div v-show="sourceMode === 'upload'" role="tabpanel" class="space-y-3">
              <input
                ref="fileInput"
                type="file"
                accept=".csv,.txt,.dat"
                class="hidden"
                @change="handleFileSelect"
              >
              <button
                type="button"
                class="w-full rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-primary-400 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                @click="triggerFileInput"
              >
                <Icon name="heroicons:document-arrow-up" class="mx-auto mb-2 h-8 w-8 text-gray-400" aria-hidden="true" />
                <span class="block text-sm font-medium text-gray-900">
                  Click to upload coordinate file
                </span>
                <span class="mt-1 block text-xs text-gray-500">
                  TXT, CSV, or DAT with X,Y points (comma or space separated)
                </span>
                <span v-if="uploadedFileName" class="mt-3 block break-all text-sm font-medium text-primary-700">
                  {{ uploadedFileName }}
                </span>
              </button>

              <VButton
                v-if="uploadedFileName"
                type="button"
                color="light"
                size="sm"
                @click="clearUpload"
              >
                Clear File
              </VButton>

              <details class="text-sm text-gray-600">
                <summary class="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                  Upload format tips
                </summary>
                <ul class="mt-2 list-inside list-disc space-y-1 text-xs text-gray-500">
                  <li>Points are sorted by X and split into upper/lower surfaces automatically</li>
                  <li>Optional blank line separates upper and lower surfaces explicitly</li>
                  <li>First non-numeric line may be used as the airfoil name</li>
                </ul>
              </details>
            </div>

            <dl v-if="hasGeometry && geometry" class="grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
              <VStat label="Upper points" :value="geometry.upperX.length" />
              <VStat label="Lower points" :value="geometry.lowerX.length" />
            </dl>

            <div
              v-if="importWarnings.length > 0"
              class="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800"
            >
              <p class="mb-1 font-medium">
                Import notes
              </p>
              <ul class="list-inside list-disc space-y-0.5 text-xs">
                <li v-for="(warning, i) in importWarnings" :key="i">
                  {{ warning }}
                </li>
              </ul>
            </div>
          </div>
        </VPanel>
      </div>

      <!-- Fit -->
      <div class="min-w-0 lg:col-span-2">
        <VPanel :title="hasGeometry && geometry ? geometry.name : 'Bezier fit'">
          <VStateBlock v-if="isLoadingGeometry" variant="loading" title="Loading geometry" />
          <VStateBlock v-else-if="loadError" variant="error" title="Could not load geometry" :description="loadError" />
          <BezierFitTab
            v-else-if="hasGeometry && geometry"
            :upper-x="geometry.upperX"
            :upper-y="geometry.upperY"
            :lower-x="geometry.lowerX"
            :lower-y="geometry.lowerY"
            :airfoil-name="geometry.name"
          />
          <VStateBlock
            v-else
            icon="heroicons:chart-bar"
            title="Upload a coordinate file to begin, or select an airfoil"
            description="Choose a source, then run Bezier fitting and export control points or reparametrized coordinates."
          />
        </VPanel>
      </div>
    </div>
  </div>
</template>
