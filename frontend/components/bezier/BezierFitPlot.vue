<script setup lang="ts">
import { Scatter } from 'vue-chartjs'
import type { BezierControlPoints } from '~/composables/useBezierFit'

registerCharts()

// Originals in greys; fitted upper/lower (and their control polygons) in two palette colours
const FIT_UPPER = seriesPalette[1]
const FIT_LOWER = seriesPalette[0]
const REPARAM = seriesPalette[2]

interface Props {
  originalUpperX: number[]
  originalUpperY: number[]
  originalLowerX: number[]
  originalLowerY: number[]
  fittedUpperX?: number[]
  fittedUpperY?: number[]
  fittedLowerX?: number[]
  fittedLowerY?: number[]
  upperControlPoints?: BezierControlPoints
  lowerControlPoints?: BezierControlPoints
  reparamUpperX?: number[]
  reparamUpperY?: number[]
  reparamLowerX?: number[]
  reparamLowerY?: number[]
}

const props = withDefaults(defineProps<Props>(), {
  fittedUpperX: () => [],
  fittedUpperY: () => [],
  fittedLowerX: () => [],
  fittedLowerY: () => [],
  upperControlPoints: () => ({ x: [], y: [] }),
  lowerControlPoints: () => ({ x: [], y: [] }),
})

const hasFit = computed(() => props.fittedUpperX.length > 0 && props.fittedLowerX.length > 0)
const hasControlPoints = computed(
  () => props.upperControlPoints.x.length > 0 && props.lowerControlPoints.x.length > 0,
)

// Control polygon visibility state
const showControlPolygon = ref(true)

// Chart instance reference for zoom reset
const chartRef = ref<any>(null)

const chartData = computed(() => {
  const datasets: any[] = []

  // Original points, split by surface so the upload preview shows which side each point landed on.
  const originalUpper = props.originalUpperX.map((x, i) => ({ x, y: props.originalUpperY[i] }))
  const originalLower = props.originalLowerX.map((x, i) => ({ x, y: props.originalLowerY[i] }))

  datasets.push({
    label: 'Upper points',
    data: originalUpper,
    borderColor: chartColors.title,
    backgroundColor: chartColors.title,
    showLine: false,
    pointRadius: 2,
    pointHoverRadius: 4,
  })

  datasets.push({
    label: 'Lower points',
    data: originalLower,
    borderColor: chartColors.tick,
    backgroundColor: chartColors.tick,
    showLine: false,
    pointRadius: 2,
    pointHoverRadius: 4,
  })

  // Fitted curves
  if (hasFit.value) {
    datasets.push({
      label: 'Fitted Upper',
      data: props.fittedUpperX.map((x, i) => ({ x, y: props.fittedUpperY[i] })),
      borderColor: FIT_UPPER,
      backgroundColor: 'transparent',
      showLine: true,
      pointRadius: 0,
      borderWidth: 2,
    })

    datasets.push({
      label: 'Fitted Lower',
      data: props.fittedLowerX.map((x, i) => ({ x, y: props.fittedLowerY[i] })),
      borderColor: FIT_LOWER,
      backgroundColor: 'transparent',
      showLine: true,
      pointRadius: 0,
      borderWidth: 2,
    })
  }

  // Control polygons (optional)
  if (hasControlPoints.value && showControlPolygon.value) {
    // Upper control polygon
    datasets.push({
      label: 'Upper Control Polygon',
      data: props.upperControlPoints.x.map((x, i) => ({ x, y: props.upperControlPoints.y[i] })),
      borderColor: `${FIT_UPPER}66`,
      backgroundColor: FIT_UPPER,
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
      borderColor: `${FIT_LOWER}66`,
      backgroundColor: FIT_LOWER,
      showLine: true,
      pointRadius: 5,
      pointHoverRadius: 7,
      borderWidth: 1,
      borderDash: [5, 5],
    })
  }

  // Reparametrized points
  if (props.reparamUpperX && props.reparamUpperY && props.reparamLowerX && props.reparamLowerY) {
    const reparamUpper = props.reparamUpperX.map((x, i) => ({ x, y: props.reparamUpperY![i] }))
    const reparamLower = props.reparamLowerX.map((x, i) => ({ x, y: props.reparamLowerY![i] }))
    datasets.push({
      label: 'Reparametrized Points',
      data: [...reparamUpper, ...reparamLower],
      borderColor: REPARAM,
      backgroundColor: REPARAM,
      showLine: false,
      pointRadius: 3,
      pointHoverRadius: 5,
    })
  }

  return { datasets }
})

// Calculate axis ranges
const axisRanges = computed(() => {
  const allX = [
    ...props.originalUpperX,
    ...props.originalLowerX,
    ...(hasFit.value ? props.fittedUpperX : []),
    ...(hasFit.value ? props.fittedLowerX : []),
    ...(hasControlPoints.value ? props.upperControlPoints.x : []),
    ...(hasControlPoints.value ? props.lowerControlPoints.x : []),
    ...(props.reparamUpperX || []),
    ...(props.reparamLowerX || []),
  ]
  const allY = [
    ...props.originalUpperY,
    ...props.originalLowerY,
    ...(hasFit.value ? props.fittedUpperY : []),
    ...(hasFit.value ? props.fittedLowerY : []),
    ...(hasControlPoints.value ? props.upperControlPoints.y : []),
    ...(hasControlPoints.value ? props.lowerControlPoints.y : []),
    ...(props.reparamUpperY || []),
    ...(props.reparamLowerY || []),
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

// Below Tailwind `sm` a 2.5 ratio leaves the airfoil ~40px tall under the legend
const isSmUp = useMediaQuery('(min-width: 640px)')

const chartOptions = computed(() => {
  const ranges = axisRanges.value

  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: isSmUp.value ? 2.5 : 1.4,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          ...themedLegend.labels,
          usePointStyle: true,
          boxWidth: 8,
          padding: 15,
        },
      },
      tooltip: {
        ...themedTooltip,
        enabled: true,
        callbacks: {
          label: (context: any) => {
            const point = context.raw
            return `x: ${point.x.toFixed(6)}, y: ${point.y.toFixed(6)}`
          },
        },
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'xy' as const,
        },
        pan: {
          enabled: true,
          mode: 'xy' as const,
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
    },
    scales: {
      x: {
        ...themedAxis('x/c'),
        type: 'linear' as const,
        position: 'bottom' as const,
        min: ranges.xMin,
        max: ranges.xMax,
      },
      y: {
        ...themedAxis('y/c'),
        type: 'linear' as const,
        min: ranges.yMin,
        max: ranges.yMax,
      },
    },
  }
})

// Reset zoom function
const resetZoom = () => resetChartZoom([chartRef.value])
</script>

<template>
  <div class="w-full h-full">
    <div class="mb-2 flex flex-wrap justify-end gap-2">
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
      <VButton
        v-if="hasControlPoints"
        type="button"
        color="light"
        size="sm"
        @click="showControlPolygon = !showControlPolygon"
      >
        <Icon :name="showControlPolygon ? 'heroicons:eye-slash' : 'heroicons:eye'" class="h-4 w-4" aria-hidden="true" />
        {{ showControlPolygon ? 'Hide' : 'Show' }} Control Polygon
      </VButton>
    </div>
    <ClientOnly>
      <Scatter ref="chartRef" :data="chartData" :options="chartOptions" />
    </ClientOnly>
  </div>
</template>
