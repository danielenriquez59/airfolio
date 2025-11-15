<script setup lang="ts">
import type { Ref } from 'vue'

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
} = useAirfoilUpload()

const route = useRoute()
const router = useRouter()

// Initialize with 10 empty rows for each surface
const initializeEmptyRows = (count: number): CoordinatePair[] => {
  return Array(count).fill(null).map(() => ({ x: '', y: '' }))
}

// Form state
const activeTab = ref<'manual' | 'csv'>('manual')
const airfoilName = ref('')
const description = ref('')
const sourceUrl = ref('')
const upperSurface: Ref<CoordinatePair[]> = ref(initializeEmptyRows(10))
const lowerSurface: Ref<CoordinatePair[]> = ref(initializeEmptyRows(10))

// UI state
const showHelp = ref(false)
const isSubmitting = ref(false)
const errors: Ref<Record<string, string>> = ref({})

// Computed
const canSubmit = computed(() => {
  return (
    airfoilName.value.trim().length > 0 &&
    upperSurface.value.length > 0 &&
    lowerSurface.value.length > 0 &&
    Object.keys(errors.value).length === 0
  )
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

    const uploadData = {
      name: airfoilName.value.trim(),
      description: description.value.trim() || undefined,
      upperSurface: upper,
      lowerSurface: lower,
      sourceUrl: sourceUrl.value.trim() || undefined,
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
  airfoilName.value = ''
  description.value = ''
  sourceUrl.value = ''
  upperSurface.value = []
  lowerSurface.value = []
  errors.value = {}
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-12">
    <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <!-- Header with Help Button -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-2">
          <h1 class="text-3xl font-bold text-gray-900">Upload Airfoil</h1>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
            @click="showHelp = true"
          >
            <Icon name="heroicons:question-mark-circle" class="h-5 w-5" />
            How to Upload
          </button>
        </div>
        <p class="text-lg text-gray-600">
          Share your airfoil design with the community
        </p>
      </div>

      <!-- Form -->
      <form class="bg-white rounded-lg shadow p-6 space-y-6">
        <!-- Name -->
        <div>
          <label for="name" class="block text-sm font-medium text-gray-900 mb-1">
            Airfoil Name <span class="text-red-600">*</span>
          </label>
          <VInput
            v-model="airfoilName"
            id="name"
            type="text"
            placeholder="e.g., NACA-2412"
            wrapper-class="w-full"
            size="lg"
          />
          <p class="mt-1 text-xs text-gray-500">
            Alphanumeric characters, hyphens, and spaces allowed. Maximum 12 characters.
          </p>
          <p v-if="errors.name" class="mt-1 text-sm text-red-600">
            {{ errors.name }}
          </p>
        </div>

        <!-- Description -->
        <div>
          <label for="description" class="block text-sm font-medium text-gray-900 mb-1">
            Description (optional)
          </label>
          <textarea
            v-model="description"
            id="description"
            placeholder="Brief description of your airfoil..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows="3"
          />
        </div>

        <!-- Source URL -->
        <div>
          <label for="sourceUrl" class="block text-sm font-medium text-gray-900 mb-1">
            Source URL (optional)
          </label>
          <VInput
            v-model="sourceUrl"
            id="sourceUrl"
            type="url"
            placeholder="https://example.com/airfoil"
            wrapper-class="w-full"
            size="lg"
          />
        </div>

        <!-- Coordinates Section -->
        <div class="border-t pt-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">Airfoil Coordinates</h2>
            <p class="text-xs text-gray-500">
              Minimum 10 points per surface required
            </p>
          </div>

          <!-- Tabs -->
          <div class="flex gap-4 mb-6 border-b border-gray-200">
            <button
              type="button"
              :class="[
                'px-4 py-2 font-medium text-sm border-b-2 transition-colors',
                activeTab === 'manual'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ]"
              @click="activeTab = 'manual'"
            >
              Manual Entry
            </button>
            <button
              type="button"
              :class="[
                'px-4 py-2 font-medium text-sm border-b-2 transition-colors',
                activeTab === 'csv'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ]"
              @click="activeTab = 'csv'"
            >
              CSV Upload
            </button>
          </div>

          <!-- Manual Tab -->
          <div v-if="activeTab === 'manual'" class="space-y-6">
            <!-- Upper Surface -->
            <div>
              <h3 class="text-base font-medium text-gray-900 mb-3">Upper Surface</h3>
              <UploadCoordinateTable
                v-model="upperSurface"
                surface="upper"
              />
              <p v-if="errors.upperSurface" class="mt-2 text-sm text-red-600">
                {{ errors.upperSurface }}
              </p>
            </div>

            <!-- Lower Surface -->
            <div>
              <h3 class="text-base font-medium text-gray-900 mb-3">Lower Surface</h3>
              <UploadCoordinateTable
                v-model="lowerSurface"
                surface="lower"
              />
              <p v-if="errors.lowerSurface" class="mt-2 text-sm text-red-600">
                {{ errors.lowerSurface }}
              </p>
            </div>
          </div>

          <!-- CSV Tab -->
          <div v-if="activeTab === 'csv'" class="space-y-4">
            <UploadCsvUpload
              @load="handleCsvLoad"
              @error="handleCsvError"
            />
            <p v-if="errors.csv" class="text-sm text-red-600">
              {{ errors.csv }}
            </p>
          </div>
        </div>

        <!-- Error Summary -->
        <div v-if="errors.submit" class="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {{ errors.submit }}
        </div>

        <!-- Actions -->
        <div class="flex gap-3 pt-6 border-t">
          <button
            type="button"
            :disabled="isSubmitting"
            class="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="handleSubmit"
          >
            <span v-if="!isSubmitting">Continue to Confirmation</span>
            <span v-else>Processing...</span>
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-gray-200 text-gray-900 font-medium rounded-lg hover:bg-gray-300 transition-colors"
            @click="resetForm"
          >
            Reset
          </button>
        </div>
      </form>
    </div>

    <!-- Help Modal -->
    <UploadHelpModal
      :is-open="showHelp"
      @close="showHelp = false"
    />
  </div>
</template>

