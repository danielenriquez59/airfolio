<script setup lang="ts">
import type { NACA4Params, NACA5Params, NACA6Family, NACA6Params } from '~/composables/useNACAGenerator'
import { NACA_RANGES } from '~/composables/useNACAGenerator'
import { tabButtonClasses } from '~/layers/ui/utils/buttons'

type SeriesType = '4-digit' | '5-digit' | '6-series'

interface Props {
  seriesType: SeriesType
  naca4Params: NACA4Params
  naca5Params: NACA5Params
  naca6Params: NACA6Params
  nacaName: string
  embedded?: boolean // hosted by another page: no series tabs, no technical note
}

interface Emits {
  (e: 'update:seriesType', type: SeriesType): void
  (e: 'update:naca4Params', params: NACA4Params): void
  (e: 'update:naca5Params', params: NACA5Params): void
  (e: 'update:naca6Params', params: NACA6Params): void
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

const handleNACA6Change = (key: keyof NACA6Params, value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return
  emit('update:naca6Params', { ...props.naca6Params, [key]: numValue })
}

const seriesOptions = [
  { value: '4-digit', label: '4-digit' },
  { value: '5-digit', label: '5-digit' },
  { value: '6-series', label: '6-series' },
] as const

const families: NACA6Family[] = ['63', '64', '65', '66', '67', '63A', '64A', '65A']

const r6 = NACA_RANGES['6-series']
const r4 = NACA_RANGES['4-digit']
const r5 = NACA_RANGES['5-digit']
const rows = computed(() => props.seriesType === '6-series'
  ? [
      { key: 't', label: 'Thickness', hint: '6% to 21%', min: r6.t[0], max: r6.t[1], step: 0.01, value: props.naca6Params.t },
      { key: 'cl', label: 'Design Cl', hint: 'Ideal design lift', min: r6.cl[0], max: r6.cl[1], step: 0.1, value: props.naca6Params.cl },
      ...(props.naca6Params.family.endsWith('A')
        ? []
        : [{ key: 'a', label: 'Loading extent a', hint: 'Uniform load to a·chord', min: r6.a[0], max: r6.a[1], step: 0.1, value: props.naca6Params.a }]),
    ]
  : props.seriesType === '4-digit'
  ? [
      { key: 'm', label: 'Max camber', hint: '0% to 9.5%', min: r4.m[0], max: r4.m[1], step: 0.001, value: props.naca4Params.m },
      { key: 'p', label: 'Camber position', hint: '10% chord steps', min: r4.p[0], max: r4.p[1], step: 0.1, value: props.naca4Params.p },
      { key: 't', label: 'Thickness', hint: '1% to 40%', min: r4.t[0], max: r4.t[1], step: 0.01, value: props.naca4Params.t },
    ]
  : [
      { key: 'cl', label: 'Design Cl', hint: 'Ideal design lift', min: r5.cl[0], max: r5.cl[1], step: 0.15, value: props.naca5Params.cl },
      { key: 'p', label: 'Camber position', hint: '5% to 25%', min: r5.p[0], max: r5.p[1], step: 0.05, value: props.naca5Params.p },
      { key: 't', label: 'Thickness', hint: '1% to 40%', min: r5.t[0], max: r5.t[1], step: 0.01, value: props.naca5Params.t },
    ])

// Clamp to the row's range: typed values outside it give NaN or unphysical sections
function handleChange(key: string, value: string | number, input?: HTMLInputElement) {
  const row = rows.value.find(r => r.key === key)!
  const n = typeof value === 'string' ? parseFloat(value) : value
  const v = Number.isNaN(n) ? row.value : Math.min(row.max, Math.max(row.min, n))
  if (input)
    input.value = String(v) // the prop may not change (typed 2 clamps to the current 1), so set the box directly
  if (props.seriesType === '6-series')
    handleNACA6Change(key as keyof NACA6Params, v)
  else if (props.seriesType === '4-digit')
    handleNACA4Change(key as keyof NACA4Params, v)
  else
    handleNACA5Change(key as keyof NACA5Params, v)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div v-if="!embedded" class="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="NACA series">
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
      <div v-if="seriesType === '6-series'" class="space-y-1.5">
        <span class="block text-sm font-medium text-gray-700">Family</span>
        <div class="inline-flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="6-series family">
          <button
            v-for="f in families"
            :key="f"
            type="button"
            :class="tabButtonClasses(naca6Params.family === f)"
            :aria-pressed="naca6Params.family === f"
            @click="emit('update:naca6Params', { ...naca6Params, family: f })"
          >
            {{ f }}
          </button>
        </div>
      </div>
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
          @change="handleChange(row.key, ($event.target as HTMLInputElement).value, $event.target as HTMLInputElement)"
        >
      </div>
    </div>

    <div v-if="!embedded" class="flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 p-3 text-sm text-gray-700">
      <Icon name="heroicons:information-circle-20-solid" class="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
      <p>
        <span class="font-medium text-gray-900">Technical note.</span>
        <template v-if="seriesType === '4-digit'">
          The NACA 4-digit airfoil sections are generated using a thickness distribution equation and a mean camber line composed of two parabolic arcs merging smoothly at the position of maximum camber.
        </template>
        <template v-else-if="seriesType === '6-series'">
          Thickness comes from the NACA conformal-mapping tables, and the mean line carries uniform loading up to x = a. 6A sections use the modified a = 0.8 mean line.
        </template>
        <template v-else>
          The NACA 5-digit series uses the same thickness form as the 4-digit series but employs a specific camber line designed to move the maximum camber forward for higher maximum lift coefficients. The calculations here approximate the standard camber lines.
        </template>
      </p>
    </div>
  </div>
</template>
