<script setup lang="ts">
import type { Database } from '~/types/database.types'
import { formatCategoryName } from '~/utils/categoryUtils'

type Category = Database['public']['Tables']['categories']['Row']

definePageMeta({
  layout: 'default',
})

useHead({
  title: 'Confirm Airfoil Upload - Airfolio',
  meta: [
    {
      name: 'description',
      content: 'Review calculated airfoil properties before submitting to the database.',
    },
  ],
})

const route = useRoute()
const router = useRouter()

const config = useRuntimeConfig()
const { retrieveTemporaryData, clearTemporaryData } = useAirfoilUpload()
const { fetchCategories } = useCategories()

// State
const isLoading = ref(true)
const isConfirming = ref(false)
const uploadData = ref<any>(null)
const calculatedProperties = ref<any>(null)
const error = ref<string>('')
const categoryMap = ref<Map<string, Category>>(new Map())

// Get hash from URL
const hash = route.query.hash as string

// Lifecycle
onMounted(async () => {
  try {
    if (!hash) {
      error.value = 'Invalid upload session. Please start over.'
      return
    }

    // Fetch categories map
    const categories = await fetchCategories()
    categories.forEach((cat) => {
      categoryMap.value.set(cat.id, cat)
    })

    // Retrieve temporary data
    const data = retrieveTemporaryData(hash)
    if (!data) {
      error.value = 'Upload data expired. Please start over.'
      return
    }

    uploadData.value = data

    // Call validation endpoint to get calculated properties
    // Use normalized name for validation (uniqueness check)
    const response = await $fetch(`${config.public.backendUrl}/api/airfoils/validate`, {
      method: 'POST',
      body: {
        name: data.name, // Normalized name for uniqueness check
        upper_surface: data.upperSurface,
        lower_surface: data.lowerSurface,
      },
    })

    if (!response.valid) {
      error.value = response.errors?.[0] || 'Validation failed. Please try again.'
      return
    }

    calculatedProperties.value = response.calculated_properties
  }
  catch (err) {
    console.error('Confirmation error:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load confirmation page'
  }
  finally {
    isLoading.value = false
  }
})

async function handleConfirm() {
  if (!uploadData.value || !calculatedProperties.value)
    return

  isConfirming.value = true
  error.value = ''

  try {
    // Call create endpoint
    const body: any = {
      name: uploadData.value.name, // Normalized name (alphanumeric only)
      display_name: uploadData.value.displayName || uploadData.value.name, // User-entered display name, fallback to name
      description: uploadData.value.description,
      upper_surface: uploadData.value.upperSurface,
      lower_surface: uploadData.value.lowerSurface,
      source_url: uploadData.value.sourceUrl,
    }

    // Include category if selected
    if (uploadData.value.categoryId)
      body.category = uploadData.value.categoryId

    const response = await $fetch(`${config.public.backendUrl}/api/airfoils/create`, {
      method: 'POST',
      body,
    })

    if (response.success) {
      // Clear temporary data
      clearTemporaryData(hash)

      // Redirect to airfoil detail page
      await router.push(`/airfoils/${encodeURIComponent(response.slug)}`)
    }
    else {
      error.value = 'Failed to create airfoil. Please try again.'
    }
  }
  catch (err) {
    console.error('Confirmation error:', err)
    error.value = err instanceof Error ? err.message : 'Failed to create airfoil'
  }
  finally {
    isConfirming.value = false
  }
}

async function handleBack() {
  if (hash)
    await router.push(`/upload?hash=${encodeURIComponent(hash)}`)
  else
    await router.push('/upload')
}
</script>

<template>
  <div>
    <PageHeader title="Review Airfoil" subtitle="Check the shape and calculated properties before submitting." />

    <UploadSteps :current="2" />

    <VPanel v-if="isLoading">
      <VStateBlock variant="loading" title="Calculating airfoil properties..." />
    </VPanel>

    <VPanel v-else-if="error">
      <VStateBlock variant="error" title="Something went wrong" :description="error">
        <VButton type="button" color="light" @click="handleBack">
          <Icon name="heroicons:arrow-left-20-solid" class="h-4 w-4" aria-hidden="true" />
          Back to edit
        </VButton>
      </VStateBlock>
    </VPanel>

    <UploadGeometryPreview
      v-else-if="uploadData && calculatedProperties"
      :name="uploadData.name"
      :upper-x="calculatedProperties.upper_x_coordinates"
      :upper-y="calculatedProperties.upper_y_coordinates"
      :lower-x="calculatedProperties.lower_x_coordinates"
      :lower-y="calculatedProperties.lower_y_coordinates"
      :properties="calculatedProperties"
    >
      <div class="space-y-3">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <h2 class="text-lg font-semibold text-gray-900">
            {{ uploadData.displayName.toUpperCase() || uploadData.name.toUpperCase() }}
          </h2>
          <VBadge v-if="uploadData.categoryId && categoryMap.has(uploadData.categoryId)" tone="primary">
            {{ formatCategoryName(categoryMap.get(uploadData.categoryId)?.name || '') }}
          </VBadge>
        </div>
        <p v-if="uploadData.description" class="text-sm text-gray-600">
          {{ uploadData.description }}
        </p>
        <p v-if="uploadData.sourceUrl" class="text-sm text-gray-500">
          Source:
          <a :href="uploadData.sourceUrl" target="_blank" rel="noopener noreferrer" class="break-all text-primary-600 hover:text-primary-700 hover:underline">
            {{ uploadData.sourceUrl }}
          </a>
        </p>
      </div>

      <template #actions>
        <p class="w-full text-sm font-medium text-error-600">
          You will not be able to delete this airfoil once uploaded.
        </p>
        <VButton type="button" color="light" :disabled="isConfirming" @click="handleBack">
          <Icon name="heroicons:arrow-left-20-solid" class="h-4 w-4" aria-hidden="true" />
          Back to edit
        </VButton>
        <VButton type="button" color="primary" :disabled="isConfirming" @click="handleConfirm">
          {{ isConfirming ? 'Submitting...' : 'Submit Airfoil' }}
        </VButton>
      </template>
    </UploadGeometryPreview>
  </div>
</template>
