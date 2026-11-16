<script setup lang="ts">
import type { NACA6Family } from '~/composables/useNACAGenerator'
import type { RiblettSeries } from '~/utils/riblettTables'
import { NACA_RANGES } from '~/composables/useNACAGenerator'
import { AIRFOIL_FAMILIES, type Family, FAMILY_KEYS, snapToStep } from '~/utils/airfoilFamilies'
import { tabButtonClasses } from '~/layers/ui/utils/buttons'

interface Props {
  seriesType: Family // cst: the page shows its own CST editor
  params: Record<string, any> // the parameters of seriesType's family
  nacaName: string
  embedded?: boolean // hosted by another page: no series tabs, no technical note
}

interface Emits {
  (e: 'update:seriesType', type: Family): void
  (e: 'update:params', params: Record<string, any>): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const update = (patch: Record<string, unknown>) => emit('update:params', { ...props.params, ...patch })

const seriesOptions = FAMILY_KEYS.map(value => ({ value, label: AIRFOIL_FAMILIES[value].label }))

const families: NACA6Family[] = ['63', '64', '65', '66', '67', '63A', '64A', '65A']
const riblettSeries: RiblettSeries[] = ['30', '35', '37', '40']

const r6 = NACA_RANGES['6-series']
const r4 = NACA_RANGES['4-digit']
const r5 = NACA_RANGES['5-digit']
const rr = NACA_RANGES.riblett
const r16 = NACA_RANGES['16-series']
const rp = NACA_RANGES.parsec
// [key, label, hint, step, group]; ranges come from NACA_RANGES.parsec.
// Grouped (PARSEC) rows get a 6rem number box for signed 3-decimal values such as -0.042
const PARSEC_ROWS = [
  ['rLE', 'LE radius', 'Fraction of chord', 0.001, 'Leading edge'],
  ['xUp', 'Crest x', 'Upper crest position', 0.01, 'Upper crest'],
  ['zUp', 'Crest z', 'Upper crest height', 0.001, 'Upper crest'],
  ['zxxUp', 'Curvature', 'z\'\' at the crest', 0.01, 'Upper crest'],
  ['xLo', 'Crest x', 'Lower crest position', 0.01, 'Lower crest'],
  ['zLo', 'Crest z', 'Lower crest height', 0.001, 'Lower crest'],
  ['zxxLo', 'Curvature', 'z\'\' at the crest', 0.01, 'Lower crest'],
  ['zTE', 'TE height', 'Mid-thickness z', 0.001, 'Trailing edge'],
  ['dzTE', 'TE thickness', 'Gap at the TE', 0.001, 'Trailing edge'],
  ['alphaTE', 'TE direction', 'deg, + points down', 0.5, 'Trailing edge'],
  ['betaTE', 'TE wedge angle', 'deg', 0.5, 'Trailing edge'],
] as const
// Reflex has no table entry below p = 0.10, so switching it on lifts p to 0.10
const setReflex = (on: boolean) => update({ isReflex: on, p: on ? Math.max(props.params.p, r5.pReflex[0]) : props.params.p })
// Slider rows of the active family (labels, hints and steps are UI, so they live here rather than in AIRFOIL_FAMILIES)
const rows = computed<{ key: string, label: string, hint: string, min: number, max: number, step: number, value: number, group?: string }[]>(() => {
  const p = props.params
  return props.seriesType === 'parsec'
    ? PARSEC_ROWS.map(([key, label, hint, step, group]) => ({ key, label, hint, step, group, min: rp[key][0], max: rp[key][1], value: p[key] }))
    : props.seriesType === 'riblett'
    ? [
        { key: 'cl', label: 'Design Cl', hint: '0 to 0.6', min: rr.cl[0], max: rr.cl[1], step: 0.1, value: p.cl },
        { key: 't', label: 'Thickness', hint: '6% to 24%', min: rr.t[0], max: rr.t[1], step: 0.01, value: p.t },
      ]
    : props.seriesType === '16-series'
    ? [
        { key: 't', label: 'Thickness', hint: '6% to 21%', min: r16.t[0], max: r16.t[1], step: 0.01, value: p.t },
        { key: 'cl', label: 'Design Cl', hint: 'Ideal design lift', min: r16.cl[0], max: r16.cl[1], step: 0.1, value: p.cl },
      ]
    : props.seriesType === '6-series'
    ? [
        { key: 't', label: 'Thickness', hint: '6% to 21%', min: r6.t[0], max: r6.t[1], step: 0.01, value: p.t },
        { key: 'cl', label: 'Design Cl', hint: 'Ideal design lift', min: r6.cl[0], max: r6.cl[1], step: 0.1, value: p.cl },
        ...(p.family.endsWith('A')
          ? []
          : [{ key: 'a', label: 'Loading extent a', hint: 'Uniform load to a·chord', min: r6.a[0], max: r6.a[1], step: 0.1, value: p.a }]),
      ]
    : props.seriesType === '4-digit'
    ? [
        { key: 'm', label: 'Max camber', hint: '0% to 9.5%', min: r4.m[0], max: r4.m[1], step: 0.001, value: p.m },
        { key: 'p', label: 'Camber position', hint: '10% chord steps', min: r4.p[0], max: r4.p[1], step: 0.1, value: p.p },
        { key: 't', label: 'Thickness', hint: '1% to 40%', min: r4.t[0], max: r4.t[1], step: 0.01, value: p.t },
        ...(p.modified
          ? [
              { key: 'le', label: 'LE radius index', hint: '0 to 9, 6 = 4-digit', min: r4.le[0], max: r4.le[1], step: 1, value: p.le },
              { key: 'xt', label: 'Max thickness at', hint: '20% to 60% chord', min: r4.xt[0], max: r4.xt[1], step: 0.1, value: p.xt },
            ]
          : []),
      ]
    : props.seriesType === '5-digit'
    ? [
        { key: 'cl', label: 'Design Cl', hint: 'Ideal design lift', min: r5.cl[0], max: r5.cl[1], step: 0.15, value: p.cl },
        { key: 'p', label: 'Camber position', hint: p.isReflex ? '10% to 25%' : '5% to 25%', min: p.isReflex ? r5.pReflex[0] : r5.p[0], max: r5.p[1], step: 0.05, value: p.p },
        { key: 't', label: 'Thickness', hint: '1% to 40%', min: r5.t[0], max: r5.t[1], step: 0.01, value: p.t },
      ]
    : []
})

// Clamp to the row's range and snap to its slider step: typed values outside it give NaN or unphysical sections
function handleChange(key: string, value: string | number, input?: HTMLInputElement) {
  const row = rows.value.find(r => r.key === key)!
  const n = typeof value === 'string' ? parseFloat(value) : value
  const v = Number.isNaN(n) ? row.value : snapToStep(n, row.min, row.max, row.step)
  if (input)
    input.value = String(v) // the prop may not change (typed 2 clamps to the current 1), so set the box directly
  update({ [key]: v })
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
            :class="tabButtonClasses(params.family === f)"
            :aria-pressed="params.family === f"
            @click="update({ family: f })"
          >
            {{ f }}
          </button>
        </div>
      </div>
      <template v-if="seriesType === 'riblett'">
        <div class="space-y-1.5">
          <span class="block text-sm font-medium text-gray-700">Max thickness at % chord</span>
          <div class="inline-flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Riblett series">
            <button
              v-for="s in riblettSeries"
              :key="s"
              type="button"
              :class="tabButtonClasses(params.series === s)"
              :aria-pressed="params.series === s"
              @click="update({ series: s })"
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
              :class="tabButtonClasses(params.cusp === c.value)"
              :aria-pressed="params.cusp === c.value"
              @click="update({ cusp: c.value })"
            >
              {{ c.label }}
            </button>
          </div>
        </div>
      </template>
      <template v-for="(row, i) in rows" :key="`${seriesType}-${row.key}`">
      <h3 v-if="row.group && row.group !== rows[i - 1]?.group" class="data-label pt-1">{{ row.group }}</h3>
      <div class="grid items-center gap-3" :class="row.group ? 'grid-cols-[7rem_minmax(0,1fr)_6rem]' : 'grid-cols-[7rem_minmax(0,1fr)_5rem]'">
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
      </template>
      <div v-if="seriesType === '4-digit' || seriesType === '5-digit'" class="flex items-center gap-3">
        <VSwitch
          v-if="seriesType === '4-digit'"
          key="naca4-modified"
          name="naca4-modified"
          sr-text="Modified thickness"
          :model-value="!!params.modified"
          @update:model-value="update({ modified: $event })"
        />
        <VSwitch v-else key="naca5-reflex" name="naca5-reflex" sr-text="Reflex" :model-value="params.isReflex" @update:model-value="setReflex" />
        <span class="text-sm font-medium text-gray-700" aria-hidden="true">{{ seriesType === '4-digit' ? 'Modified thickness' : 'Reflex' }}</span>
      </div>
      <label v-if="seriesType === 'riblett'" class="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          :checked="params.sharpTE"
          class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          @change="update({ sharpTE: ($event.target as HTMLInputElement).checked })"
        >
        Sharp trailing edge
      </label>
    </div>

    <div v-if="!embedded" class="flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 p-3 text-sm text-gray-700">
      <Icon name="heroicons:information-circle-20-solid" class="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
      <p>
        <span class="font-medium text-gray-900">Technical note.</span>
        <template v-if="seriesType === '4-digit' && params.modified">
          Modified 4-digit sections keep the 4-digit camber line but set the leading-edge radius (index 6 is the plain 4-digit radius) and the position of maximum thickness, written after the dash: 0012-64.
        </template>
        <template v-else-if="seriesType === '4-digit'">
          The NACA 4-digit airfoil sections are generated using a thickness distribution equation and a mean camber line composed of two parabolic arcs merging smoothly at the position of maximum camber.
        </template>
        <template v-else-if="seriesType === '16-series'">
          The 16-series uses the modified 4-digit thickness with leading-edge index 4 and maximum thickness at half chord, on the a = 1 mean line: 16-212 has design Cl 0.2 and 12% thickness.
        </template>
        <template v-else-if="seriesType === '5-digit' && params.isReflex">
          The reflex mean line curves back up near the trailing edge so the pitching moment is close to zero; the third digit 1 marks it, as in 23112.
        </template>
        <template v-else-if="seriesType === 'riblett'">
          Harry Riblett's GA sections combine tabulated thickness forms (max thickness at 30, 35, 37 or 40% chord) with tabulated mean lines, from "GA Airfoils" (1996). Design Cl between the tabulated 0.2, 0.3, 0.4 and 0.6 mean lines is interpolated; geometry uses the 27 tabulated stations.
        </template>
        <template v-else-if="seriesType === 'parsec'">
          PARSEC (Sobieczky) sets each surface as a sum of six powers of x from 11 geometric parameters: leading-edge radius, the position, height and curvature of each crest, and the trailing-edge height, thickness, direction and wedge angle.
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
