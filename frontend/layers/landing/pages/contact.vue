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
  <div class="min-h-screen bg-gray-50 py-12">
    <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="flex items-center justify-center gap-3 mb-4">
          <BugIcon 
            v-if="formType?.value === 'bug'" 
            size="32" 
            class="text-gray-600" 
          />
          <h1 class="text-4xl font-bold text-gray-900">Contact Us</h1>
        </div>
        <p class="text-xl text-gray-600">
          Report bugs or request features. We'd love to hear from you!
        </p>
      </div>

      <!-- Form Card -->
      <VCard class="shadow-lg">
        <VCardBody>
          <form
            name="contact"
            method="POST"
            data-netlify="true"
            @submit="handleSubmit"
          >
            <!-- Hidden input for Netlify form detection -->
            <input type="hidden" name="form-name" value="contact" />

            <!-- Success Message -->
            <div
              v-if="submitStatus === 'success'"
              class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg"
            >
              <p class="text-green-800 font-medium">
                Thank you! Your message has been submitted successfully. We'll get back to you soon.
              </p>
            </div>

            <!-- Error Message -->
            <div
              v-if="submitStatus === 'error' && errorMessage"
              class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
            >
              <p class="text-red-800 font-medium">
                {{ errorMessage }}
              </p>
            </div>

            <!-- Email Input -->
            <VInput
              v-model="email"
              type="email"
              name="email"
              label="Email"
              placeholder="your.email@example.com"
              wrapper-class="mb-6"
              required
            />

            <!-- Type Selector -->
            <div class="mb-6">
              <label class="flex items-center gap-2 text-gray-800 font-medioum tracking-wide text-sm mb-1">
                Type
                <BugIcon 
                  v-if="formType?.value === 'bug'" 
                  size="16" 
                  class="text-gray-600" 
                />
              </label>
              <VSelect
                v-model="formType"
                :items="typeOptions"
                placeholder="Select type..."
              />
              <!-- Hidden input for Netlify form detection -->
              <input
                type="hidden"
                name="type"
                :value="formType?.value || ''"
              />
            </div>

            <!-- Description Textarea -->
            <VTextarea
              v-model="description"
              name="description"
              label="Description"
              :placeholder="placeholderText"
              wrapper-class="mb-6"
              :rows="8"
              required
            />

            <!-- Submit Button -->
            <VButton
              type="submit"
              color="primary"
              block
              :disabled="isSubmitting"
            >
              <span v-if="isSubmitting">Submitting...</span>
              <span v-else>Submit</span>
            </VButton>
          </form>
        </VCardBody>
      </VCard>
    </div>
  </div>
</template>

