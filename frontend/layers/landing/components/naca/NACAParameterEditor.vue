<script setup lang="ts">
import type { NACA16Params, NACA4Params, NACA5Params, NACA6Family, NACA6Params, RiblettParams } from '~/composables/useNACAGenerator'
import type { RiblettSeries } from '~/utils/riblettTables'
import { NACA_RANGES } from '~/composables/useNACAGenerator'
import { tabButtonClasses } from '~/layers/ui/utils/buttons'

type SeriesType = '4-digit' | '5-digit' | '16-series' | '6-series' | 'riblett' | 'cst' // cst: the page shows its own CST editor

interface Props {
  seriesType: SeriesType
  naca4Params: NACA4Params
  naca5Params: NACA5Params
  naca6Params: NACA6Params
  naca16Params?: NACA16Params
  riblettParams?: RiblettParams
  nacaName: string
  embedded?: boolean // hosted by another page: no series tabs, no technical note
}

interface Emits {
  (e: 'update:seriesType', type: SeriesType): void
  (e: 'update:naca4Params', params: NACA4Params): void
  (e: 'update:naca5Params', params: NACA5Params): void
  (e: 'update:naca6Params', params: NACA6Params): void
  (e: 'update:naca16Params', params: NACA16Params): void
  (e: 'update:riblettParams', params: RiblettParams): void
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
  { value: '16-series', label: '16-series' },
  { value: '6-series', label: '6-series' },
  { value: 'riblett', label: 'Riblett GA' },
  { value: 'cst', label: 'CST' },
] as const

const families: NACA6Family[] = ['63', '64', '65', '66', '67', '63A', '64A', '65A']
const riblettSeries: RiblettSeries[] = ['30', '35', '37', '40']

const updateRiblett = (patch: Partial<RiblettParams>) => emit('update:riblettParams', { ...props.riblettParams!, ...patch })

const r6 = NACA_RANGES['6-series']
const r4 = NACA_RANGES['4-digit']
const r5 = NACA_RANGES['5-digit']
const rr = NACA_RANGES.riblett
const r16 = NACA_RANGES['16-series']
// Reflex has no table entry below p = 0.10, so switching it on lifts p to 0.10
const setReflex = (on: boolean) => emit('update:naca5Params', { ...props.naca5Params, isReflex: on, p: on ? Math.max(props.naca5Params.p, r5.pReflex[0]) : props.naca5Params.p })
const rows = computed(() => props.seriesType === 'riblett'
  ? [
      { key: 'cl', label: 'Design Cl', hint: '0 to 0.6', min: rr.cl[0], max: rr.cl[1], step: 0.1, value: props.riblettParams!.cl },
      { key: 't', label: 'Thickness', hint: '6% to 24%', min: rr.t[0], max: rr.t[1], step: 0.01, value: props.riblettParams!.t },
    ]
  : props.seriesType === '16-series'
  ? [
      { key: 't', label: 'Thickness', hint: '6% to 21%', min: r16.t[0], max: r16.t[1], step: 0.01, value: props.naca16Params!.t },
      { key: 'cl', label: 'Design Cl', hint: 'Ideal design lift', min: r16.cl[0], max: r16.cl[1], step: 0.1, value: props.naca16Params!.cl },
    ]
  : props.seriesType === '6-series'
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
      ...(props.naca4Params.modified
        ? [
            { key: 'le', label: 'LE radius index', hint: '0 to 9, 6 = 4-digit', min: r4.le[0], max: r4.le[1], step: 1, value: props.naca4Params.le! },
            { key: 'xt', label: 'Max thickness at', hint: '20% to 60% chord', min: r4.xt[0], max: r4.xt[1], step: 0.1, value: props.naca4Params.xt! },
          ]
        : []),
    ]
  : [
      { key: 'cl', label: 'Design Cl', hint: 'Ideal design lift', min: r5.cl[0], max: r5.cl[1], step: 0.15, value: props.naca5Params.cl },
      { key: 'p', label: 'Camber position', hint: props.naca5Params.isReflex ? '10% to 25%' : '5% to 25%', min: props.naca5Params.isReflex ? r5.pReflex[0] : r5.p[0], max: r5.p[1], step: 0.05, value: props.naca5Params.p },
      { key: 't', label: 'Thickness', hint: '1% to 40%', min: r5.t[0], max: r5.t[1], step: 0.01, value: props.naca5Params.t },
    ])

// Clamp to the row's range: typed values outside it give NaN or unphysical sections
function handleChange(key: string, value: string | number, input?: HTMLInputElement) {
  const row = rows.value.find(r => r.key === key)!
  const n = typeof value === 'string' ? parseFloat(value) : value
  const c = Number.isNaN(n) ? row.value : Math.min(row.max, Math.max(row.min, n))
  const v = row.step === 1 ? Math.round(c) : c // whole-number rows (LE radius index)
  if (input)
    input.value = String(v) // the prop may not change (typed 2 clamps to the current 1), so set the box directly
  if (props.seriesType === 'riblett')
    updateRiblett({ [key]: v })
  else if (props.seriesType === '16-series')
    emit('update:naca16Params', { ...props.naca16Params!, [key]: v })
  else if (props.seriesType === '6-series')
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
      <div v-if="!embedded" class="inline-flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Airfoil family">
        <button
          v-for="opt in seriesOptions"
          :key="opt.value"
          type="button"
          :class="[tabButtonClasses(seriesType === opt.value), 'whitespace-nowrap']"
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

    <div v-if="seriesType !== 'cst'" class="space-y-4">
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
      <template v-if="seriesType === 'riblett' && riblettParams">
        <div class="space-y-1.5">
          <span class="block text-sm font-medium text-gray-700">Max thickness at % chord</span>
          <div class="inline-flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Riblett series">
            <button
              v-for="s in riblettSeries"
              :key="s"
              type="button"
              :class="tabButtonClasses(riblettParams.series === s)"
              :aria-pressed="riblettParams.series === s"
              @click="updateRiblett({ series: s })"
            >
              {{ s }}
            </button>
          </div>
        </div>
        <div class="space-y-1.5">
          <span class="block text-sm font-medium text-gray-700">Trailing edge cusp</span>
          <div class="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Trailing edge cusp">
            <button
              v-for="c in [{ value: '-', label: 'Standard (-)' }, { value: 'A', label: 'Reduced (A)' }] as const"
              :key="c.value"
              type="button"
              :class="tabButtonClasses(riblettParams.cusp === c.value)"
              :aria-pressed="riblettParams.cusp === c.value"
              @click="updateRiblett({ cusp: c.value })"
            >
              {{ c.label }}
            </button>
          </div>
        </div>
      </template>
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
      <div v-if="seriesType === '4-digit' || seriesType === '5-digit'" class="flex items-center gap-3">
        <VSwitch
          v-if="seriesType === '4-digit'"
          key="naca4-modified"
          name="naca4-modified"
          sr-text="Modified thickness"
          :model-value="!!naca4Params.modified"
          @update:model-value="emit('update:naca4Params', { ...naca4Params, modified: $event })"
        />
        <VSwitch v-else key="naca5-reflex" name="naca5-reflex" sr-text="Reflex" :model-value="naca5Params.isReflex" @update:model-value="setReflex" />
        <span class="text-sm font-medium text-gray-700" aria-hidden="true">{{ seriesType === '4-digit' ? 'Modified thickness' : 'Reflex' }}</span>
      </div>
      <label v-if="seriesType === 'riblett' && riblettParams" class="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          :checked="riblettParams.sharpTE"
          class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          @change="updateRiblett({ sharpTE: ($event.target as HTMLInputElement).checked })"
        >
        Sharp trailing edge
      </label>
    </div>

    <div v-if="!embedded" class="flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 p-3 text-sm text-gray-700">
      <Icon name="heroicons:information-circle-20-solid" class="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
      <p>
        <span class="font-medium text-gray-900">Technical note.</span>
        <template v-if="seriesType === '4-digit' && naca4Params.modified">
          Modified 4-digit sections keep the 4-digit camber line but set the leading-edge radius (index 6 is the plain 4-digit radius) and the position of maximum thickness, written after the dash: 0012-64.
        </template>
        <template v-else-if="seriesType === '4-digit'">
          The NACA 4-digit airfoil sections are generated using a thickness distribution equation and a mean camber line composed of two parabolic arcs merging smoothly at the position of maximum camber.
        </template>
        <template v-else-if="seriesType === '16-series'">
          The 16-series uses the modified 4-digit thickness with leading-edge index 4 and maximum thickness at half chord, on the a = 1 mean line: 16-212 has design Cl 0.2 and 12% thickness.
        </template>
        <template v-else-if="seriesType === '5-digit' && naca5Params.isReflex">
          The reflex mean line curves back up near the trailing edge so the pitching moment is close to zero; the third digit 1 marks it, as in 23112.
        </template>
        <template v-else-if="seriesType === 'riblett'">
          Harry Riblett's GA sections combine tabulated thickness forms (max thickness at 30, 35, 37 or 40% chord) with tabulated mean lines, from "GA Airfoils" (1996). Design Cl between the tabulated 0.2, 0.3, 0.4 and 0.6 mean lines is interpolated; geometry uses the 27 tabulated stations.
        </template>
        <template v-else-if="seriesType === 'cst'">
          CST (Class Shape Transformation) writes each surface as a class function, which gives the round nose and sharp trailing edge, times a Bernstein-polynomial shape function whose weights you set below. A few weights describe most airfoils smoothly, and Fit finds the weights of a catalog airfoil.
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
