<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: boolean
  title: string
  confirmLabel: string
  confirmColor?: 'primary' | 'secondary' | 'warning' | 'error' | 'success' | 'light' | 'dark' | 'neutral'
  busy?: boolean
  error?: string | null
}>(), {
  confirmColor: 'error',
  busy: false,
  error: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: false]
  'confirm': []
}>()
</script>

<template>
  <!-- VModal also emits when it opens, so only a close is passed on -->
  <VModal :model-value="modelValue" @update:model-value="open => { if (!open) emit('update:modelValue', false) }">
    <VModalHeader dismissable>
      {{ title }}
    </VModalHeader>
    <VModalBody>
      <slot />
      <div v-if="error" class="mt-4 rounded-lg border border-error-200 bg-error-50 p-3" role="alert">
        <p class="text-sm text-error-700">
          {{ error }}
        </p>
      </div>
    </VModalBody>
    <VModalFooter>
      <VButton type="button" color="light" :disabled="busy" @click="emit('update:modelValue', false)">
        Cancel
      </VButton>
      <VButton type="button" :color="confirmColor" :disabled="busy" @click="emit('confirm')">
        {{ confirmLabel }}
      </VButton>
    </VModalFooter>
  </VModal>
</template>
