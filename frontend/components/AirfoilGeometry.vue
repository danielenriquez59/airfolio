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
  Filler,
} from 'chart.js'

// Register Chart.js components
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend,
  Filler
)

interface Props {
  /** Upper surface X coordinates */
  upperX?: number[]
  /** Upper surface Y coordinates */
  upperY?: number[]
  /** Lower surface X coordinates */
  lowerX?: number[]
  /** Lower surface Y coordinates */
  lowerY?: number[]
  /** Airfoil name for title */
  name?: string
  /** Show grid */
  showGrid?: boolean
  /** Show legend */
  showLegend?: boolean
  /** Chart height */
  height?: number
  /** Aspect ratio (width/height) */
  aspectRatio?: number
}

const props = withDefaults(defineProps<Props>(), {
  showGrid: true,
  showLegend: false,
  height: 400,
  aspectRatio: 2.5,
})

// Process coordinate data
const chartData = computed(() => {
  let upperCoords: Array<[number, number]> = []
  let lowerCoords: Array<[number, number]> = []

  if (props.upperX && props.upperY) {
    // Sort upper coordinates by X in descending order
    upperCoords = props.upperX
      .map((x, i) => [x, props.upperY![i]] as [number, number])
      .sort((a, b) => b[0] - a[0]) // Descending X order
  }
  if (props.lowerX && props.lowerY) {
    // Sort lower coordinates by X in ascending order
    lowerCoords = props.lowerX
      .map((x, i) => [x, props.lowerY![i]] as [number, number])
      .sort((a, b) => a[0] - b[0]) // Ascending X order
  }

  // Combine coordinates for closed loop
  const allCoords = [...upperCoords, ...lowerCoords]

  return {
    datasets: [
      {
        label: 'Airfoil Profile',
        data: allCoords.map(([x, y]) => ({ x, y })),
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        showLine: true,
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.1,
        fill: true,
      },
    ],
  }
})

// Calculate axis ranges dynamically
const axisRanges = computed(() => {
  const allX: number[] = []
  const allY: number[] = []

  // Collect all X and Y coordinates
  if (props.upperX) allX.push(...props.upperX)
  if (props.lowerX) allX.push(...props.lowerX)
  if (props.upperY) allY.push(...props.upperY)
  if (props.lowerY) allY.push(...props.lowerY)

  // Use min/max values directly
  const xMin = Math.min(...allX)
  const xMax = Math.max(...allX)
  const yMin = Math.min(...allY)
  const yMax = Math.max(...allY)

  return {
    xMin,
    xMax,
    yMin,
    yMax,
  }
})

const chartOptions = computed(() => {
  const ranges = axisRanges.value

  return {
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: props.aspectRatio,
    plugins: {
      title: {
        display: !!props.name,
        text: props.name ? `Airfoil Profile` : '',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: {
          top: 10,
          bottom: 20,
        },
      },
      legend: {
        display: props.showLegend,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const point = context.raw
            return `(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`
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
          text: 'Chord Position (x/c)',
          font: {
            size: 12,
          },
        },
        grid: {
          display: props.showGrid,
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          stepSize: 10,
        },
      },
      y: {
        type: 'linear' as const,
        min: ranges.yMin - 0.001,
        max: ranges.yMax + 0.001,
        title: {
          display: true,
          text: 'Thickness (y/c)',
          font: {
            size: 12,
          },
        },
        grid: {
          display: props.showGrid,
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          stepSize: 5,
        },
      },
    },
    elements: {
      line: {
        tension: 0.1,
      },
    },
  }
})
</script>

<template>
  <div class="w-full" :style="{ height: `${height}px` }">
    <Scatter
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

