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
import zoomPlugin from 'chartjs-plugin-zoom'

// Register Chart.js components
ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
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
  /** Aspect ratio (width/height). Use null for 1:1 scaling based on data range */
  aspectRatio?: number | null
  /** Enable zoom and pan */
  zoomable?: boolean
  /** Show data points on hover */
  showPointsOnHover?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showGrid: true,
  showLegend: false,
  aspectRatio: 2.5,
  zoomable: false,
  showPointsOnHover: false,
})

// Chart instance reference for zoom reset
const chartRef = ref<InstanceType<typeof Scatter> | null>(null)

// Marker visibility state
const showMarkers = ref(props.showPointsOnHover)

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
        pointRadius: showMarkers.value ? 2 : 0,
        pointHoverRadius: showMarkers.value ? 4 : 0,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: 'rgb(59, 130, 246)',
        pointHoverBackgroundColor: 'rgb(255, 255, 255)',
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

// Calculate 1:1 aspect ratio based on data range
const calculatedAspectRatio = computed(() => {
  if (props.aspectRatio === null) {
    // Calculate aspect ratio to maintain 1:1 scale (equal units on both axes)
    const ranges = axisRanges.value
    const xRange = ranges.xMax - ranges.xMin
    const yRange = ranges.yMax - ranges.yMin
    
    if (xRange === 0 || yRange === 0) return 1
    
    // Maintain aspect ratio so 1 unit in X equals 1 unit in Y visually
    return xRange / yRange
  }
  return props.aspectRatio
})

const chartOptions = computed(() => {
  const ranges = axisRanges.value

  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: calculatedAspectRatio.value,
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
        enabled: true,
        intersect: false,
        mode: showMarkers.value ? 'nearest' : 'index',
        callbacks: {
          label: (context: any) => {
            const point = context.raw
            return `x: ${point.x.toFixed(6)}, y: ${point.y.toFixed(6)}`
          },
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        padding: 12,
      },
      ...(props.zoomable && {
        zoom: {
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: 'xy',
          },
          pan: {
            enabled: true,
            mode: 'xy',
          },
          limits: {
            x: {
              min: ranges.xMin,
              max: ranges.xMax,
            },
            y: {
              min: ranges.yMin,
              max: ranges.yMax,
            },
          },
        },
      }),
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
        min: props.aspectRatio === null ? ranges.yMin : ranges.yMin - 0.001,
        max: props.aspectRatio === null ? ranges.yMax : ranges.yMax + 0.001,
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

// Reset zoom function
const resetZoom = () => {
  if (chartRef.value && chartRef.value.chart) {
    const chart = chartRef.value.chart as any
    if (chart && typeof chart.resetZoom === 'function') {
      chart.resetZoom()
    }
  }
}

// Toggle marker visibility
const toggleMarkers = () => {
  showMarkers.value = !showMarkers.value
}

// Watch showPointsOnHover prop to sync initial state
watch(() => props.showPointsOnHover, (newVal) => {
  showMarkers.value = newVal
}, { immediate: true })
</script>

<template>
  <div class="w-full relative" :style="{ height: `${props.height}px` }">
    <!-- Control Buttons -->
    <div
      v-if="zoomable || showPointsOnHover"
      class="absolute top-2 right-2 z-10 flex gap-2"
    >
      <button
        v-if="zoomable"
        type="button"
        @click="resetZoom"
        class="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-sm flex items-center gap-1.5"
        title="Reset Zoom"
      >
        <Icon name="heroicons:arrows-pointing-out" class="h-4 w-4" />
        <span>Reset Zoom</span>
      </button>
      <button
        v-if="showPointsOnHover"
        type="button"
        @click="toggleMarkers"
        class="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 shadow-sm flex items-center gap-1.5"
        :title="showMarkers ? 'Hide Markers' : 'Show Markers'"
      >
        <Icon :name="showMarkers ? 'heroicons:eye-slash' : 'heroicons:eye'" class="h-4 w-4" />
        <span>{{ showMarkers ? 'Hide Markers' : 'Show Markers' }}</span>
      </button>
    </div>

    <Scatter
      ref="chartRef"
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

