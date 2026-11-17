<script setup lang="ts">
import { Scatter } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import type { MfoilPoint, MfoilSurface } from '~/utils/mfoil/index'

const props = defineProps<{ series: { name: string; color: string; point: MfoilPoint }[] }>()
ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend)
applyChartDefaults(ChartJS)

const DASH = [5, 4]

function line(label: string, x: number[], y: number[], color: string, dash: number[] = [], width = 2) {
  return {
    label,
    data: x.map((v, i) => ({ x: v, y: y[i] })),
    borderColor: color,
    backgroundColor: color,
    borderWidth: width,
    borderDash: dash,
    showLine: true,
    pointRadius: 0,
    pointHoverRadius: 3,
  }
}

// Transition marker sits on the curve at the surface node nearest to xtr; none when laminar to the TE
function marker(label: string, s: MfoilSurface, y: number[], xtr: number, color: string) {
  const laminar = !(xtr < s.x[s.x.length - 1])
  let k = 0
  s.x.forEach((x, i) => {
    if (Math.abs(x - xtr) < Math.abs(s.x[k] - xtr))
      k = i
  })
  return {
    label,
    data: (s.x.length && !laminar) ? [{ x: s.x[k], y: y[k] }] : [],
    borderColor: color,
    backgroundColor: color,
    pointStyle: 'triangle',
    pointRadius: 6,
    pointHoverRadius: 7,
  }
}

function options(yLabel: string, reverse = false): any {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...themedTooltip,
        callbacks: {
          label: (c: any) => `${c.dataset.label}: x/c ${c.raw.x.toFixed(3)}, ${c.raw.y.toPrecision(4)}`,
        },
      },
    },
    scales: {
      x: { ...themedAxis('x/c'), type: 'linear' as const, min: 0, max: 1 }, // paneled LE can sit just below 0
      y: { ...themedAxis(yLabel), type: 'linear' as const, reverse },
    },
  }
}

function blChart(key: 'cf' | 'ds' | 'hk') {
  return {
    datasets: props.series.flatMap(({ name, color, point: { upper, lower, xtrUpper, xtrLower } }) => [
      line(`${name} upper`, upper.x, upper[key], color),
      line(`${name} lower`, lower.x, lower[key], color, DASH),
      marker(`${name} transition (upper)`, upper, upper[key], xtrUpper, color),
      marker(`${name} transition (lower)`, lower, lower[key], xtrLower, color),
    ]),
  }
}

const cpData = computed(() => ({
  datasets: props.series.flatMap(({ name, color, point }) => [
    line(`${name} viscous`, point.x, point.cp, color),
    line(`${name} inviscid`, point.x, point.cpi, color, [4, 3], 1),
  ]),
}))
const cfData = computed(() => blChart('cf'))
const dsData = computed(() => blChart('ds'))
const hkData = computed(() => blChart('hk'))

const invertCp = ref(true)
const cpOptions = computed(() => options('Cp', invertCp.value))
const cfOptions = options('Cf')
const dsOptions = options('δ*/c')
// Separated flow drives Hk far up; cap the axis so one spike does not flatten the attached-flow values
const HK_MAX = 8
const fmtXtr = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : '—') // NaN when the solve failed
const hkOptions = computed(() => {
  const o = options('Hk')
  if (props.series.some(({ point: { upper, lower } }) => [...upper.hk, ...lower.hk].some(h => h > HK_MAX)))
    o.scales.y.max = HK_MAX
  return o
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <VSwitch v-model="invertCp" name="invert-cp" sr-text="Invert Cp" />
      <span class="text-sm font-medium text-gray-700" aria-hidden="true">Invert Cp</span>
    </div>
    <ul class="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-700" aria-label="Line style key">
      <li class="flex items-center gap-1.5">
        <span class="w-5 border-t-2 border-gray-600" aria-hidden="true" />
        Upper surface
      </li>
      <li class="flex items-center gap-1.5">
        <span class="w-5 border-t-2 border-dashed border-gray-600" aria-hidden="true" />
        Lower surface
      </li>
      <li class="flex items-center gap-1.5">
        <span aria-hidden="true">▲</span>
        Transition
      </li>
      <li class="flex items-center gap-1.5">
        Cp:
        <span class="w-5 border-t-2 border-gray-600" aria-hidden="true" />
        viscous
        <span class="w-5 border-t border-dashed border-gray-600" aria-hidden="true" />
        inviscid
      </li>
    </ul>
    <ul class="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-700" aria-label="Transition locations">
      <li v-for="s in series" :key="s.name" class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: s.color }" aria-hidden="true" />
        <span class="uppercase">{{ s.name }}</span>
        xtr upper <span class="num text-gray-900">{{ fmtXtr(s.point.xtrUpper) }}</span>,
        lower <span class="num text-gray-900">{{ fmtXtr(s.point.xtrLower) }}</span>
      </li>
    </ul>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="h-64">
        <Scatter :data="cpData" :options="cpOptions" />
      </div>
      <div class="h-64">
        <Scatter :data="cfData" :options="cfOptions" />
      </div>
      <div class="h-64">
        <Scatter :data="dsData" :options="dsOptions" />
      </div>
      <div class="h-64">
        <Scatter :data="hkData" :options="hkOptions" />
      </div>
    </div>
  </div>
</template>
