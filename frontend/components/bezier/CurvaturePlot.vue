<script setup lang="ts">
import { Scatter } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { BezierControlPoints, CurvatureData } from '~/composables/useBezierFit'
import { bezierCurvature, discreteCurvature } from '~/composables/useBezierFit'

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend)

if (process.client) {
  import('chartjs-plugin-zoom').then((zoomPlugin) => {
    ChartJS.register(zoomPlugin.default)
  })
}

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
      borderColor: 'rgb(55, 65, 81)',
      backgroundColor: 'rgb(55, 65, 81)',
      showLine: true,
      borderWidth: 1,
      pointRadius: 0,
    },
    {
      label: 'Original Lower',
      data: toPoints(original.value.lower),
      borderColor: 'rgb(156, 163, 175)',
      backgroundColor: 'rgb(156, 163, 175)',
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
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'transparent',
        showLine: true,
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'Fitted Lower',
        data: toPoints(fitted.value.lower),
        borderColor: 'rgb(59, 130, 246)',
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
        labels: { usePointStyle: true, boxWidth: 8, padding: 15, font: { size: 11 } },
      },
      tooltip: {
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
        type: 'linear' as const,
        min: -0.05,
        max: 1.05,
        title: { display: true, text: 'x/c', font: { size: 12 } },
        grid: { color: 'rgba(0, 0, 0, 0.1)' },
      },
      y: {
        type: 'linear' as const,
        min: view.min,
        max: view.max,
        title: { display: true, text: 'Curvature κ (1/c), convex +', font: { size: 12 } },
        grid: { color: 'rgba(0, 0, 0, 0.1)' },
      },
    },
  }
})

const resetZoom = () => {
  chartRef.value?.chart?.resetZoom?.()
}
</script>

<template>
  <div class="w-full h-full">
    <div class="flex items-center justify-between mb-2 gap-2">
      <p class="text-xs text-gray-500">
        Leading edge clipped by default. Scroll to zoom, drag to pan.
      </p>
      <VButton
        type="button"
        color="light"
        size="sm"
        shadow="sm"
        title="Reset Zoom"
        @click="resetZoom"
      >
        <Icon name="heroicons:arrows-pointing-out" class="h-4 w-4" />
        Reset Zoom
      </VButton>
    </div>
    <ClientOnly>
      <Scatter ref="chartRef" :data="chartData" :options="chartOptions" />
    </ClientOnly>
  </div>
</template>
