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

const props = defineProps<{ point: MfoilPoint }>()
ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend)
applyChartDefaults(ChartJS)

const UPPER = seriesColor(0)
const LOWER = seriesColor(1)

function line(label: string, x: number[], y: number[], color: string, dashed = false) {
  return {
    label,
    data: x.map((v, i) => ({ x: v, y: y[i] })),
    borderColor: color,
    backgroundColor: color,
    borderWidth: dashed ? 1.5 : 2,
    borderDash: dashed ? [5, 4] : [],
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

function options(yLabel: string, reverse = false, legend = false): any {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { ...themedLegend, display: legend },
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
  const { upper, lower, xtrUpper, xtrLower } = props.point
  return {
    datasets: [
      line('Upper', upper.x, upper[key], UPPER),
      line('Lower', lower.x, lower[key], LOWER),
      marker('Transition (upper)', upper, upper[key], xtrUpper, UPPER),
      marker('Transition (lower)', lower, lower[key], xtrLower, LOWER),
    ],
  }
}

const cpData = computed(() => ({
  datasets: [
    line('Viscous', props.point.x, props.point.cp, chartColors.primary),
    line('Inviscid', props.point.x, props.point.cpi, chartColors.tick, true),
  ],
}))
const cfData = computed(() => blChart('cf'))
const dsData = computed(() => blChart('ds'))
const hkData = computed(() => blChart('hk'))

const cpOptions = options('Cp', true, true)
const cfOptions = options('Cf')
const dsOptions = options('δ*/c')
// Separated flow drives Hk far up; cap the axis so one spike does not flatten the attached-flow values
const HK_MAX = 8
const hkOptions = computed(() => {
  const o = options('Hk')
  const { upper, lower } = props.point
  if ([...upper.hk, ...lower.hk].some(h => h > HK_MAX))
    o.scales.y.max = HK_MAX
  return o
})
</script>

<template>
  <div class="space-y-3">
    <ul class="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-700" aria-label="Boundary-layer legend">
      <li class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-sm" :style="{ backgroundColor: UPPER }" aria-hidden="true" />
        Upper surface
      </li>
      <li class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 rounded-sm" :style="{ backgroundColor: LOWER }" aria-hidden="true" />
        Lower surface
      </li>
      <li class="flex items-center gap-1.5">
        <span aria-hidden="true">▲</span>
        Transition (upper {{ point.xtrUpper.toFixed(3) }}, lower {{ point.xtrLower.toFixed(3) }})
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
