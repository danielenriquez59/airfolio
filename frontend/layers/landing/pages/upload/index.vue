<script setup lang="ts">
import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'
import { formatCategoryName } from '~/utils/categoryUtils'
import { compactNavTabButtonClasses } from '~/layers/ui/utils/buttons'

type Category = Database['public']['Tables']['categories']['Row']

definePageMeta({
  layout: 'default',
})

useHead({
  title: 'Upload Airfoil - Share Your Design | Airfolio',
  meta: [
    {
      name: 'description',
      content: 'Upload custom airfoil coordinates to share with the community. Support for manual entry and CSV upload formats.'
    }
  ]
})

interface CoordinatePair {
  x: number | ''
  y: number | ''
}

const {
  validateCoordinates,
  validateAirfoilName,
  generateDataHash,
  storeTemporaryData,
  retrieveTemporaryData,
  retrieveLatestTemporaryData,
  clearTemporaryData,
  generateNormalizedName,
} = useAirfoilUpload()

const { fetchCategories } = useCategories()

const route = useRoute()
const router = useRouter()

// Initialize with 10 empty rows for each surface
const initializeEmptyRows = (count: number): CoordinatePair[] => {
  return Array(count).fill(null).map(() => ({ x: '', y: '' }))
}

// Form state
// CSV is the common path; manual tables are for small edits (CSV load and draft restore switch to manual)
const activeTab = ref<'manual' | 'csv'>('csv')
const airfoilName = ref('')
const description = ref('')
const sourceUrl = ref('')
const selectedCategory = ref<string | undefined>()
const upperSurface: Ref<CoordinatePair[]> = ref(initializeEmptyRows(10))
const lowerSurface: Ref<CoordinatePair[]> = ref(initializeEmptyRows(10))

// Category options
const allCategories = ref<Category[]>([])

// UI state
const showHelp = ref(false)
const isSubmitting = ref(false)
const errors: Ref<Record<string, string>> = ref({})

const MIN_POINTS_PER_SURFACE = 10

/** Count rows that have both X and Y filled with finite numbers. */
const countFilledPoints = (surface: CoordinatePair[]): number => {
  return surface.filter((c) => {
    if (c.x === '' || c.y === '')
      return false
    const x = typeof c.x === 'string' ? Number.parseFloat(c.x) : c.x
    const y = typeof c.y === 'string' ? Number.parseFloat(c.y) : c.y
    return Number.isFinite(x) && Number.isFinite(y)
  }).length
}

/** Filled points as numeric arrays for the live shape preview. */
function toPreview(surface: CoordinatePair[]) {
  const xs: number[] = []
  const ys: number[] = []
  for (const c of surface) {
    if (c.x === '' || c.y === '')
      continue
    const x = Number.parseFloat(String(c.x))
    const y = Number.parseFloat(String(c.y))
    if (Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x)
      ys.push(y)
    }
  }
  return { xs, ys }
}
const upperPreview = computed(() => toPreview(upperSurface.value))
const lowerPreview = computed(() => toPreview(lowerSurface.value))

// Computed
const canSubmit = computed(() => {
  return (
    airfoilName.value.trim().length > 0
    && countFilledPoints(upperSurface.value) >= MIN_POINTS_PER_SURFACE
    && countFilledPoints(lowerSurface.value) >= MIN_POINTS_PER_SURFACE
    && Object.keys(errors.value).length === 0
  )
})

/** Restore form fields from a stored upload draft. */
const restoreFromDraft = (data: {
  name: string
  displayName?: string
  description?: string
  upperSurface: Array<{ x: number; y: number }>
  lowerSurface: Array<{ x: number; y: number }>
  sourceUrl?: string
  categoryId?: string
}) => {
  airfoilName.value = data.displayName || data.name
  description.value = data.description || ''
  sourceUrl.value = data.sourceUrl || ''
  selectedCategory.value = data.categoryId
  upperSurface.value = data.upperSurface.map(p => ({ x: p.x, y: p.y }))
  lowerSurface.value = data.lowerSurface.map(p => ({ x: p.x, y: p.y }))
  activeTab.value = 'manual'
}

// Fetch categories on mount; restore draft when returning from confirmation
onMounted(async () => {
  try {
    allCategories.value = await fetchCategories()
  } catch (err) {
    console.error('Error fetching categories:', err)
  }

  const queryHash = typeof route.query.hash === 'string' ? route.query.hash : null
  const draft = queryHash
    ? (() => {
        const data = retrieveTemporaryData(queryHash)
        return data ? { hash: queryHash, data } : null
      })()
    : retrieveLatestTemporaryData()

  if (draft)
    restoreFromDraft(draft.data)
})

// Watchers
watch([upperSurface, lowerSurface], () => {
  validateForm()
}, { deep: true })

watch(airfoilName, async () => {
  await validateForm()
})

const validateForm = async () => {
  const newErrors: Record<string, string> = {}

  // Validate name
  if (airfoilName.value.trim().length === 0) {
    newErrors.name = 'Airfoil name is required'
  } else {
    const nameCheck = await validateAirfoilName(airfoilName.value.trim())
    if (!nameCheck.valid) {
      newErrors.name = nameCheck.message || 'Invalid name'
    }
  }

  // Convert to numbers for validation
  const upperFormatted = upperSurface.value.map(c => ({
    x: typeof c.x === 'number' ? c.x : 0,
    y: typeof c.y === 'number' ? c.y : 0,
  })).filter(c => typeof upperSurface.value[0]?.x === 'number' || typeof upperSurface.value[0]?.y === 'number')

  const lowerFormatted = lowerSurface.value.map(c => ({
    x: typeof c.x === 'number' ? c.x : 0,
    y: typeof c.y === 'number' ? c.y : 0,
  })).filter(c => typeof lowerSurface.value[0]?.x === 'number' || typeof lowerSurface.value[0]?.y === 'number')

  if (upperFormatted.length > 0 || lowerFormatted.length > 0) {
    const coordCheck = validateCoordinates(upperFormatted, lowerFormatted)
    if (!coordCheck.valid) {
      coordCheck.errors.forEach(err => {
        newErrors[err.field] = err.message
      })
    }
  }

  errors.value = newErrors
}

const handleCsvLoad = (data: { upper: CoordinatePair[]; lower: CoordinatePair[]; airfoilName?: string }) => {
  upperSurface.value = data.upper
  lowerSurface.value = data.lower
  
  // If airfoil name is provided from CSV, populate the form
  if (data.airfoilName) {
    airfoilName.value = data.airfoilName
  }
  
  activeTab.value = 'manual'
}

const handleCsvError = (message: string) => {
  errors.value.csv = message
}

const handleSubmit = async () => {
  await validateForm()

  if (!canSubmit.value) {
    return
  }

  isSubmitting.value = true

  try {
    // Filter out empty coordinate pairs and convert strings to numbers
    const upper = upperSurface.value
      .filter(c => c.x !== '' && c.y !== '')
      .map(c => ({
        x: typeof c.x === 'string' ? parseFloat(c.x) : c.x,
        y: typeof c.y === 'string' ? parseFloat(c.y) : c.y,
      }))
      .filter(c => !isNaN(c.x) && !isNaN(c.y)) as Array<{ x: number; y: number }>

    const lower = lowerSurface.value
      .filter(c => c.x !== '' && c.y !== '')
      .map(c => ({
        x: typeof c.x === 'string' ? parseFloat(c.x) : c.x,
        y: typeof c.y === 'string' ? parseFloat(c.y) : c.y,
      }))
      .filter(c => !isNaN(c.x) && !isNaN(c.y)) as Array<{ x: number; y: number }>

    const displayName = airfoilName.value.trim()
    const normalizedName = generateNormalizedName(displayName)

    const uploadData = {
      name: normalizedName,
      displayName: displayName,
      description: description.value.trim() || undefined,
      upperSurface: upper,
      lowerSurface: lower,
      sourceUrl: sourceUrl.value.trim() || undefined,
      categoryId: selectedCategory.value || undefined,
    }

    // Generate hash and store data
    const hash = generateDataHash(uploadData)
    storeTemporaryData(hash, uploadData)

    // Navigate to confirmation page
    await router.push(`/upload/confirmation?hash=${hash}`)
  } catch (error) {
    errors.value.submit = error instanceof Error ? error.message : 'Failed to submit'
  } finally {
    isSubmitting.value = false
  }
}

const resetForm = () => {
  const latest = retrieveLatestTemporaryData()
  if (latest)
    clearTemporaryData(latest.hash)

  airfoilName.value = ''
  description.value = ''
  sourceUrl.value = ''
  selectedCategory.value = undefined
  upperSurface.value = initializeEmptyRows(10)
  lowerSurface.value = initializeEmptyRows(10)
  errors.value = {}
}
</script>

<template>
  <div>
    <PageHeader title="Upload Airfoil" subtitle="Share your airfoil design with the community.">
      <template #actions>
        <VButton type="button" color="light" @click="showHelp = true">
          <Icon name="heroicons:question-mark-circle" class="h-5 w-5" aria-hidden="true" />
          How to Upload
        </VButton>
      </template>
    </PageHeader>

    <UploadSteps :current="1" />

    <form novalidate>
      <div class="grid gap-6 lg:grid-cols-3">
        <!-- Details -->
        <VPanel title="Details" class="lg:col-span-2">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="name" class="mb-1.5 block text-sm font-medium text-gray-700">
                Airfoil name <span class="text-error-600" aria-hidden="true">*</span>
              </label>
              <VInput
                id="name"
                v-model="airfoilName"
                type="text"
                placeholder="e.g., NACA-2412"
                wrapper-class="w-full"
                required
                :error="!!errors.name"
                :aria-invalid="errors.name ? 'true' : undefined"
                :aria-describedby="errors.name ? 'name-error' : undefined"
              />
              <p v-if="errors.name" id="name-error" class="mt-1 text-sm text-error-600">
                {{ errors.name }}
              </p>
            </div>

            <div>
              <label for="category" class="mb-1.5 block text-sm font-medium text-gray-700">
                Category <span class="font-normal text-gray-500">(optional)</span>
              </label>
              <select
                id="category"
                v-model="selectedCategory"
                class="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">
                  No category
                </option>
                <option v-for="category in allCategories" :key="category.id" :value="category.id">
                  {{ formatCategoryName(category.name) }}
                </option>
              </select>
            </div>

            <div class="sm:col-span-2">
              <label for="sourceUrl" class="mb-1.5 block text-sm font-medium text-gray-700">
                Source URL <span class="font-normal text-gray-500">(optional)</span>
              </label>
              <VInput
                id="sourceUrl"
                v-model="sourceUrl"
                type="url"
                placeholder="https://example.com/airfoil"
                wrapper-class="w-full"
              />
            </div>

            <div class="sm:col-span-2">
              <label for="description" class="mb-1.5 block text-sm font-medium text-gray-700">
                Description <span class="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                id="description"
                v-model="description"
                placeholder="Brief description of your airfoil..."
                class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                rows="3"
              />
            </div>
          </div>
        </VPanel>

        <!-- Live preview: right column on lg+, between details and coordinates below lg -->
        <aside class="lg:col-start-3 lg:row-span-2 lg:row-start-1">
          <VPanel title="Shape preview" description="Updates as you enter coordinates" class="lg:sticky lg:top-20">
            <AirfoilGeometry
              v-if="upperPreview.xs.length >= 2 || lowerPreview.xs.length >= 2"
              :upper-x="upperPreview.xs"
              :upper-y="upperPreview.ys"
              :lower-x="lowerPreview.xs"
              :lower-y="lowerPreview.ys"
              :name="airfoilName || 'Preview'"
              :aspect-ratio="3"
              :show-grid="true"
            />
            <VStateBlock
              v-else
              icon="heroicons:pencil-square"
              title="No shape yet"
              description="Upload a file or enter coordinates to see the airfoil."
            />

            <dl class="mt-4 grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
              <VStat
                v-for="s in [{ label: 'Upper points', n: upperPreview.xs.length }, { label: 'Lower points', n: lowerPreview.xs.length }]"
                :key="s.label"
                :label="s.label"
              >
                <span class="inline-flex items-center gap-1.5">
                  {{ s.n }}
                  <Icon
                    :name="s.n >= MIN_POINTS_PER_SURFACE ? 'heroicons:check-circle-20-solid' : 'heroicons:x-circle-20-solid'"
                    class="h-4 w-4"
                    :class="s.n >= MIN_POINTS_PER_SURFACE ? 'text-success-600' : 'text-gray-400'"
                    aria-hidden="true"
                  />
                  <span class="sr-only">{{ s.n >= MIN_POINTS_PER_SURFACE ? '(meets minimum)' : '(below minimum)' }}</span>
                </span>
              </VStat>
            </dl>
            <p class="mt-2 text-xs text-gray-500">
              Minimum <span class="num">{{ MIN_POINTS_PER_SURFACE }}</span> points per surface.
            </p>
          </VPanel>
        </aside>

        <!-- Coordinates -->
        <VPanel title="Coordinates" class="lg:col-span-2">
          <div class="mb-4 flex gap-2 border-b border-gray-200" role="tablist" aria-label="Coordinate input method">
            <button
              type="button"
              role="tab"
              :aria-selected="activeTab === 'csv'"
              :class="compactNavTabButtonClasses(activeTab === 'csv')"
              @click="activeTab = 'csv'"
            >
              File upload
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="activeTab === 'manual'"
              :class="compactNavTabButtonClasses(activeTab === 'manual')"
              @click="activeTab = 'manual'"
            >
              Manual entry
            </button>
          </div>

          <div v-if="activeTab === 'manual'" class="grid gap-6 md:grid-cols-2">
            <div>
              <h3 class="mb-2 text-sm font-semibold text-gray-900">
                Upper surface
              </h3>
              <UploadCoordinateTable v-model="upperSurface" surface="upper" />
              <p v-if="errors.upperSurface" class="mt-2 text-sm text-error-600" role="alert">
                {{ errors.upperSurface }}
              </p>
            </div>
            <div>
              <h3 class="mb-2 text-sm font-semibold text-gray-900">
                Lower surface
              </h3>
              <UploadCoordinateTable v-model="lowerSurface" surface="lower" />
              <p v-if="errors.lowerSurface" class="mt-2 text-sm text-error-600" role="alert">
                {{ errors.lowerSurface }}
              </p>
            </div>
          </div>

          <div v-if="activeTab === 'csv'" class="space-y-3">
            <UploadCsvUpload @load="handleCsvLoad" @error="handleCsvError" />
            <p v-if="errors.csv" class="text-sm text-error-600" role="alert">
              {{ errors.csv }}
            </p>
          </div>
        </VPanel>
      </div>

      <!-- Sticky action bar -->
      <div class="sticky bottom-0 z-20 mt-6 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
        <div v-if="errors.submit" class="mb-3 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-800" role="alert">
          {{ errors.submit }}
        </div>
        <div class="flex items-center justify-between gap-3">
          <VButton type="button" color="light" @click="resetForm">
            Reset
          </VButton>
          <VButton
            type="button"
            color="primary"
            :disabled="!canSubmit || isSubmitting"
            @click="handleSubmit"
          >
            {{ isSubmitting ? 'Processing...' : 'Continue to review' }}
            <Icon v-if="!isSubmitting" name="heroicons:arrow-right-20-solid" class="h-4 w-4" aria-hidden="true" />
          </VButton>
        </div>
      </div>
    </form>

    <UploadHelpModal :is-open="showHelp" @close="showHelp = false" />
  </div>
</template>
