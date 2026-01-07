<script setup lang="ts">
import { Scatter } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
} from 'chart.js'
import type { BezierControlPoints } from '~/composables/useBezierFit'

// Register Chart.js components
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend
)

interface Props {
  originalUpperX: number[]
  originalUpperY: number[]
  originalLowerX: number[]
  originalLowerY: number[]
  fittedUpperX: number[]
  fittedUpperY: number[]
  fittedLowerX: number[]
  fittedLowerY: number[]
  upperControlPoints: BezierControlPoints
  lowerControlPoints: BezierControlPoints
}

const props = defineProps<Props>()

// Control polygon visibility state
const showControlPolygon = ref(true)

const chartData = computed(() => {
  const datasets: any[] = []

  // Original airfoil data (gray scatter points)
  const originalUpper = props.originalUpperX.map((x, i) => ({ x, y: props.originalUpperY[i] }))
  const originalLower = props.originalLowerX.map((x, i) => ({ x, y: props.originalLowerY[i] }))

  datasets.push({
    label: 'Original Data',
    data: [...originalUpper, ...originalLower],
    borderColor: 'rgba(107, 114, 128, 0.5)',
    backgroundColor: 'rgba(107, 114, 128, 0.5)',
    showLine: false,
    pointRadius: 2,
    pointHoverRadius: 4,
  })

  // Fitted upper curve (red line)
  datasets.push({
    label: 'Fitted Upper',
    data: props.fittedUpperX.map((x, i) => ({ x, y: props.fittedUpperY[i] })),
    borderColor: 'rgb(239, 68, 68)',
    backgroundColor: 'transparent',
    showLine: true,
    pointRadius: 0,
    borderWidth: 2,
  })

  // Fitted lower curve (blue line)
  datasets.push({
    label: 'Fitted Lower',
    data: props.fittedLowerX.map((x, i) => ({ x, y: props.fittedLowerY[i] })),
    borderColor: 'rgb(59, 130, 246)',
    backgroundColor: 'transparent',
    showLine: true,
    pointRadius: 0,
    borderWidth: 2,
  })

  // Control polygons (optional)
  if (showControlPolygon.value) {
    // Upper control polygon
    datasets.push({
      label: 'Upper Control Polygon',
      data: props.upperControlPoints.x.map((x, i) => ({ x, y: props.upperControlPoints.y[i] })),
      borderColor: 'rgba(239, 68, 68, 0.4)',
      backgroundColor: 'rgb(239, 68, 68)',
      showLine: true,
      pointRadius: 5,
      pointHoverRadius: 7,
      borderWidth: 1,
      borderDash: [5, 5],
    })

    // Lower control polygon
    datasets.push({
      label: 'Lower Control Polygon',
      data: props.lowerControlPoints.x.map((x, i) => ({ x, y: props.lowerControlPoints.y[i] })),
      borderColor: 'rgba(59, 130, 246, 0.4)',
      backgroundColor: 'rgb(59, 130, 246)',
      showLine: true,
      pointRadius: 5,
      pointHoverRadius: 7,
      borderWidth: 1,
      borderDash: [5, 5],
    })
  }

  return { datasets }
})

// Calculate axis ranges
const axisRanges = computed(() => {
  const allX = [
    ...props.originalUpperX,
    ...props.originalLowerX,
    ...props.upperControlPoints.x,
    ...props.lowerControlPoints.x,
  ]
  const allY = [
    ...props.originalUpperY,
    ...props.originalLowerY,
    ...props.upperControlPoints.y,
    ...props.lowerControlPoints.y,
  ]

  const xMin = Math.min(...allX)
  const xMax = Math.max(...allX)
  const yMin = Math.min(...allY)
  const yMax = Math.max(...allY)

  // Add padding
  const xPadding = (xMax - xMin) * 0.05
  const yPadding = (yMax - yMin) * 0.1

  return {
    xMin: xMin - xPadding,
    xMax: xMax + xPadding,
    yMin: yMin - yPadding,
    yMax: yMax + yPadding,
  }
})

const chartOptions = computed(() => {
  const ranges = axisRanges.value

  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 2.5,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          padding: 15,
          font: {
            size: 11,
          },
        },
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (context: any) => {
            const point = context.raw
            return `x: ${point.x.toFixed(6)}, y: ${point.y.toFixed(6)}`
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        min: ranges.xMin,
        max: ranges.xMax,
        title: {
          display: true,
          text: 'x/c',
          font: { size: 12 },
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      y: {
        type: 'linear' as const,
        min: ranges.yMin,
        max: ranges.yMax,
        title: {
          display: true,
          text: 'y/c',
          font: { size: 12 },
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
  }
})
</script>

<template>
  <div class="w-full h-full">
    <div class="flex justify-end mb-2">
      <button
        type="button"
        @click="showControlPolygon = !showControlPolygon"
        class="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-sm flex items-center gap-1.5"
      >
        <Icon :name="showControlPolygon ? 'heroicons:eye-slash' : 'heroicons:eye'" class="h-4 w-4" />
        {{ showControlPolygon ? 'Hide' : 'Show' }} Control Polygon
      </button>
    </div>
    <ClientOnly>
      <Scatter :data="chartData" :options="chartOptions" />
    </ClientOnly>
  </div>
</template>
