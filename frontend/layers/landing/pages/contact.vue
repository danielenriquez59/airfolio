<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SelectItem } from '~/layers/ui/components/Select/types'

definePageMeta({
  layout: 'simple',
})

useHead({
  title: 'Contact Us - Airfolio',
  meta: [
    {
      name: 'description',
      content: 'Report bugs or request features for Airfolio. We\'d love to hear your feedback!'
    }
  ]
})

const email = ref('')
const formType = ref<SelectItem | null>(null)
const description = ref('')
const isSubmitting = ref(false)
const submitStatus = ref<'idle' | 'success' | 'error'>('idle')
const errorMessage = ref('')

const typeOptions: SelectItem[] = [
  { text: 'Bug Report', value: 'bug' },
  { text: 'Feature Request', value: 'feature' },
]

const placeholderText = computed(() => {
  if (!formType.value) {
    return 'Please select a type above'
  }
  return formType.value.value === 'bug'
    ? 'Please list the severity of the bug and the steps to reproduce'
    : 'Please describe the feature request in as much detail as possible. What would the user flow look like?'
})

const handleSubmit = async (e: Event) => {
  e.preventDefault()
  
  if (!email.value || !formType.value || !description.value) {
    errorMessage.value = 'Please fill in all fields'
    submitStatus.value = 'error'
    return
  }

  isSubmitting.value = true
  submitStatus.value = 'idle'
  errorMessage.value = ''

  try {
    const params = new URLSearchParams()
    params.append('form-name', 'contact')
    params.append('email', email.value)
    params.append('type', formType.value.value as string)
    params.append('description', description.value)

    const response = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (response.ok) {
      submitStatus.value = 'success'
      email.value = ''
      formType.value = null
      description.value = ''
    } else {
      throw new Error('Form submission failed')
    }
  } catch (error) {
    submitStatus.value = 'error'
    errorMessage.value = 'There was an error submitting your form. Please try again or contact support directly.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="page-container py-8">
    <div class="max-w-2xl">
      <PageHeader
        title="Contact Us"
        subtitle="Report bugs or request features. We'd love to hear from you!"
      />

      <VPanel title="Send a message" description="All fields are required.">
        <form
          name="contact"
          method="POST"
          data-netlify="true"
          class="space-y-5"
          @submit="handleSubmit"
        >
          <!-- Hidden input for Netlify form detection -->
          <input type="hidden" name="form-name" value="contact" />

          <div
            v-if="submitStatus === 'success'"
            class="flex items-start gap-2 rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-800"
            role="status"
          >
            <Icon name="heroicons:check-circle" class="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <p>Thank you! Your message has been submitted successfully. We'll get back to you soon.</p>
          </div>

          <div
            v-if="submitStatus === 'error' && errorMessage"
            class="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-800"
            role="alert"
          >
            <Icon name="heroicons:exclamation-triangle" class="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <p>{{ errorMessage }}</p>
          </div>

          <VInput
            v-model="email"
            type="email"
            name="email"
            label="Email"
            aria-label="Email"
            autocomplete="email"
            placeholder="your.email@example.com"
            required
          />

          <div>
            <span id="contact-type-label" class="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
              Type
              <BugIcon
                v-if="formType?.value === 'bug'"
                size="16"
                class="text-gray-500"
              />
            </span>
            <VSelect
              v-model="formType"
              :items="typeOptions"
              placeholder="Select type..."
              aria-labelledby="contact-type-label"
            />
            <!-- Hidden input for Netlify form detection -->
            <input
              type="hidden"
              name="type"
              :value="formType?.value || ''"
            />
          </div>

          <VTextarea
            v-model="description"
            name="description"
            label="Description"
            aria-label="Description"
            :placeholder="placeholderText"
            :rows="8"
            required
          />

          <div class="flex justify-end border-t border-gray-200 pt-4">
            <VButton
              type="submit"
              color="primary"
              class="w-full sm:w-auto"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'Submitting...' : 'Submit' }}
            </VButton>
          </div>
        </form>
      </VPanel>
    </div>
  </div>
</template>
