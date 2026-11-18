<script setup lang="ts">
import { Scatter } from 'vue-chartjs'
import type { BezierControlPoints, CurvatureData } from '~/composables/useBezierFit'
import { bezierCurvature, discreteCurvature } from '~/composables/useBezierFit'

registerCharts()

// Same meaning as BezierFitPlot: originals in greys, fitted upper/lower in two palette colours
const FIT_UPPER = seriesPalette[1]
const FIT_LOWER = seriesPalette[0]

interface Props {
  upperX: number[]
  upperY: number[]
  lowerX: number[]
  lowerY: number[]
  upperControlPoints?: BezierControlPoints
  lowerControlPoints?: BezierControlPoints
}

const props = defineProps<Props>()

// Leading-edge curvature dwarfs the rest, so the default y range ignores the first bit of chord.
const LE_EXCLUDE_X = 0.1

const chartRef = ref<any>(null)

const original = computed(() => discreteCurvature(props.upperX, props.upperY, props.lowerX, props.lowerY))

const fitted = computed(() => {
  if (!props.upperControlPoints?.x.length || !props.lowerControlPoints?.x.length)
    return null
  return {
    upper: bezierCurvature(props.upperControlPoints, 'upper'),
    lower: bezierCurvature(props.lowerControlPoints, 'lower'),
  }
})

const toPoints = (c: CurvatureData) => c.x.map((x, i) => ({ x, y: c.k[i] }))

const chartData = computed(() => {
  const datasets: any[] = [
    {
      label: 'Original Upper',
      data: toPoints(original.value.upper),
      borderColor: chartColors.title,
      backgroundColor: chartColors.title,
      showLine: true,
      borderWidth: 1,
      pointRadius: 0,
    },
    {
      label: 'Original Lower',
      data: toPoints(original.value.lower),
      borderColor: chartColors.tick,
      backgroundColor: chartColors.tick,
      showLine: true,
      borderWidth: 1,
      pointRadius: 0,
    },
  ]

  if (fitted.value) {
    datasets.push(
      {
        label: 'Fitted Upper',
        data: toPoints(fitted.value.upper),
        borderColor: FIT_UPPER,
        backgroundColor: 'transparent',
        showLine: true,
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'Fitted Lower',
        data: toPoints(fitted.value.lower),
        borderColor: FIT_LOWER,
        backgroundColor: 'transparent',
        showLine: true,
        borderWidth: 2,
        pointRadius: 0,
      },
    )
  }

  return { datasets }
})

const yRange = (points: { x: number; y: number }[]) => {
  const ys = points.map(p => p.y).filter(Number.isFinite)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const pad = (max - min) * 0.1 || 1
  return { min: min - pad, max: max + pad }
}

const chartOptions = computed(() => {
  const all = chartData.value.datasets.flatMap((d: any) => d.data as { x: number; y: number }[])
  const view = yRange(all.filter(p => p.x > LE_EXCLUDE_X))
  const full = yRange(all)

  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2.5,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: { ...themedLegend.labels, usePointStyle: true, boxWidth: 8, padding: 15 },
      },
      tooltip: {
        ...themedTooltip,
        callbacks: {
          label: (context: any) => `x: ${context.raw.x.toFixed(4)}, κ: ${context.raw.y.toFixed(3)}`,
        },
      },
      zoom: {
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' as const },
        pan: { enabled: true, mode: 'xy' as const },
        limits: { x: { min: -0.05, max: 1.05 }, y: full },
      },
    },
    scales: {
      x: {
        ...themedAxis('x/c'),
        type: 'linear' as const,
        min: -0.05,
        max: 1.05,
      },
      y: {
        ...themedAxis('Curvature κ (1/c), convex +'),
        type: 'linear' as const,
        min: view.min,
        max: view.max,
      },
    },
  }
})

const resetZoom = () => resetChartZoom([chartRef.value])
</script>

<template>
  <div class="w-full h-full">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs text-gray-500">
        Leading edge clipped by default. Scroll to zoom, drag to pan.
      </p>
      <VButton
        type="button"
        color="light"
        size="sm"
        title="Reset Zoom"
        @click="resetZoom"
      >
        <Icon name="heroicons:arrows-pointing-out" class="h-4 w-4" aria-hidden="true" />
        Reset Zoom
      </VButton>
    </div>
    <ClientOnly>
      <Scatter ref="chartRef" :data="chartData" :options="chartOptions" />
    </ClientOnly>
  </div>
</template>
