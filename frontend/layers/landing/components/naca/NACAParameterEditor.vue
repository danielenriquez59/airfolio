<script setup lang="ts">
import type { NACA4Params, NACA5Params } from '~/composables/useNACAGenerator'
import { tabButtonClasses } from '~/layers/ui/utils/buttons'

interface Props {
  seriesType: '4-digit' | '5-digit'
  naca4Params: NACA4Params
  naca5Params: NACA5Params
  nacaName: string
}

interface Emits {
  (e: 'update:seriesType', type: '4-digit' | '5-digit'): void
  (e: 'update:naca4Params', params: NACA4Params): void
  (e: 'update:naca5Params', params: NACA5Params): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleNACA4Change = (key: keyof NACA4Params, value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return
  const newParams = { ...props.naca4Params, [key]: numValue }
  emit('update:naca4Params', newParams)
}

const handleNACA5Change = (key: keyof NACA5Params, value: string | number | boolean) => {
  if (typeof value === 'boolean') {
    const newParams = { ...props.naca5Params, [key]: value }
    emit('update:naca5Params', newParams)
    return
  }
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return
  const newParams = { ...props.naca5Params, [key]: numValue }
  emit('update:naca5Params', newParams)
}

const seriesOptions = [
  { value: '4-digit', label: '4-digit' },
  { value: '5-digit', label: '5-digit' },
] as const

const rows = computed(() => props.seriesType === '4-digit'
  ? [
      { key: 'm', label: 'Max camber', hint: '0% to 9.5%', min: 0, max: 0.095, step: 0.001, value: props.naca4Params.m },
      { key: 'p', label: 'Camber position', hint: '10% chord steps', min: 0.1, max: 0.9, step: 0.1, value: props.naca4Params.p },
      { key: 't', label: 'Thickness', hint: '1% to 40%', min: 0.01, max: 0.4, step: 0.01, value: props.naca4Params.t },
    ]
  : [
      { key: 'cl', label: 'Design Cl', hint: 'Ideal design lift', min: 0, max: 1.5, step: 0.15, value: props.naca5Params.cl },
      { key: 'p', label: 'Camber position', hint: '5% to 25%', min: 0.05, max: 0.25, step: 0.05, value: props.naca5Params.p },
      { key: 't', label: 'Thickness', hint: '1% to 40%', min: 0.01, max: 0.4, step: 0.01, value: props.naca5Params.t },
    ])

function handleChange(key: string, value: string | number) {
  if (props.seriesType === '4-digit')
    handleNACA4Change(key as keyof NACA4Params, value)
  else
    handleNACA5Change(key as keyof NACA5Params, value)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="NACA series">
        <button
          v-for="opt in seriesOptions"
          :key="opt.value"
          type="button"
          :class="tabButtonClasses(seriesType === opt.value)"
          :aria-pressed="seriesType === opt.value"
          @click="emit('update:seriesType', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
      <p class="num text-2xl font-semibold tracking-tight text-gray-900" aria-live="polite">
        {{ nacaName }}
      </p>
    </div>

    <div class="space-y-4">
      <div
        v-for="row in rows"
        :key="`${seriesType}-${row.key}`"
        class="grid grid-cols-[7rem_minmax(0,1fr)_5rem] items-center gap-3"
      >
        <label :for="`naca-${row.key}`" class="min-w-0">
          <span class="block text-sm font-medium text-gray-700">{{ row.label }}</span>
          <span class="block text-xs text-gray-500">{{ row.hint }}</span>
        </label>
        <input
          type="range"
          :min="row.min"
          :max="row.max"
          :step="row.step"
          :value="row.value"
          :aria-label="row.label"
          class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          @input="handleChange(row.key, parseFloat(($event.target as HTMLInputElement).value))"
        >
        <input
          :id="`naca-${row.key}`"
          type="number"
          :value="row.value"
          :min="row.min"
          :max="row.max"
          :step="row.step"
          class="num h-9 w-full rounded-lg border border-gray-300 px-2 text-right text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          @change="handleChange(row.key, ($event.target as HTMLInputElement).value)"
        >
      </div>
    </div>

    <div class="flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 p-3 text-sm text-gray-700">
      <Icon name="heroicons:information-circle-20-solid" class="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
      <p>
        <span class="font-medium text-gray-900">Technical note.</span>
        <template v-if="seriesType === '4-digit'">
          The NACA 4-digit airfoil sections are generated using a thickness distribution equation and a mean camber line composed of two parabolic arcs merging smoothly at the position of maximum camber.
        </template>
        <template v-else>
          The NACA 5-digit series uses the same thickness form as the 4-digit series but employs a specific camber line designed to move the maximum camber forward for higher maximum lift coefficients. The calculations here approximate the standard camber lines.
        </template>
      </p>
    </div>
  </div>
</template>
