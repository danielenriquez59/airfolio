<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

useHead({
  title: 'Confirm Airfoil',
})

const route = useRoute()
const router = useRouter()

const config = useRuntimeConfig()
const { retrieveTemporaryData, clearTemporaryData } = useAirfoilUpload()

// State
const isLoading = ref(true)
const isConfirming = ref(false)
const uploadData = ref<any>(null)
const calculatedProperties = ref<any>(null)
const error = ref<string>('')

// Get hash from URL
const hash = route.query.hash as string

// Lifecycle
onMounted(async () => {
  try {
    if (!hash) {
      error.value = 'Invalid upload session. Please start over.'
      return
    }

    // Retrieve temporary data
    const data = retrieveTemporaryData(hash)
    if (!data) {
      error.value = 'Upload data expired. Please start over.'
      return
    }

    uploadData.value = data

    // Call validation endpoint to get calculated properties
    const response = await $fetch(`${config.public.backendUrl}/api/airfoils/validate`, {
      method: 'POST',
      body: {
        name: data.name,
        upper_surface: data.upperSurface,
        lower_surface: data.lowerSurface,
      },
    })

    if (!response.valid) {
      error.value = response.errors?.[0] || 'Validation failed. Please try again.'
      return
    }

    calculatedProperties.value = response.calculated_properties
  } catch (err) {
    console.error('Confirmation error:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load confirmation page'
  } finally {
    isLoading.value = false
  }
})

const handleConfirm = async () => {
  if (!uploadData.value || !calculatedProperties.value) return

  isConfirming.value = true
  error.value = ''

  try {
    // Call create endpoint
    const response = await $fetch(`${config.public.backendUrl}/api/airfoils/create`, {
      method: 'POST',
      body: {
        name: uploadData.value.name,
        description: uploadData.value.description,
        upper_surface: uploadData.value.upperSurface,
        lower_surface: uploadData.value.lowerSurface,
        source_url: uploadData.value.sourceUrl,
      },
    })

    if (response.success) {
      // Clear temporary data
      clearTemporaryData(hash)

      // Redirect to airfoil detail page
      await router.push(`/airfoils/${encodeURIComponent(response.slug)}`)
    } else {
      error.value = 'Failed to create airfoil. Please try again.'
    }
  } catch (err) {
    console.error('Confirmation error:', err)
    error.value = err instanceof Error ? err.message : 'Failed to create airfoil'
  } finally {
    isConfirming.value = false
  }
}

const handleBack = async () => {
  await router.back()
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-12">
    <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Confirm Airfoil</h1>
        <p class="text-lg text-gray-600">
          Review the calculated properties before submitting
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p class="text-gray-600">Calculating airfoil properties...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <Icon name="heroicons:exclamation-triangle" class="h-12 w-12 text-red-600 mx-auto mb-4" />
        <h2 class="text-lg font-semibold text-red-900 mb-2">Error</h2>
        <p class="text-red-800 mb-6">{{ error }}</p>
        <button
          type="button"
          class="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          @click="handleBack"
        >
          Go Back
        </button>
      </div>

      <!-- Confirmation Content -->
      <div v-else-if="uploadData && calculatedProperties" class="space-y-6">
        <!-- Airfoil Info Card -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-2">{{ uploadData.name }}</h2>
          <p v-if="uploadData.description" class="text-gray-600 mb-4">{{ uploadData.description }}</p>
          <p v-if="uploadData.sourceUrl" class="text-sm text-gray-500">
            Source: <a :href="uploadData.sourceUrl" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-800">
              {{ uploadData.sourceUrl }}
            </a>
          </p>
        </div>

        <!-- Geometry Preview -->
        <UploadGeometryPreview
          :name="uploadData.name"
          :upper-x="calculatedProperties.upper_x_coordinates"
          :upper-y="calculatedProperties.upper_y_coordinates"
          :lower-x="calculatedProperties.lower_x_coordinates"
          :lower-y="calculatedProperties.lower_y_coordinates"
          :properties="calculatedProperties"
        />

        <!-- Actions -->
        <div class="flex gap-3 pt-6">
          <button
            type="button"
            :disabled="isConfirming"
            class="flex-1 px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="handleConfirm"
          >
            <span v-if="!isConfirming">Submit Airfoil</span>
            <span v-else>Submitting...</span>
          </button>
          <button
            type="button"
            :disabled="isConfirming"
            class="flex-1 px-4 py-3 bg-gray-200 text-gray-900 font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="handleBack"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

