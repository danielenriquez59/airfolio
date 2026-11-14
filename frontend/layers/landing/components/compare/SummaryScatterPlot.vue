<script setup lang="ts">
import { ref, computed } from 'vue'
import { Scatter } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(LinearScale, PointElement, Title, Tooltip, Legend)
applyChartDefaults(ChartJS)

interface SummaryRow {
  name: string
  maxLD: number
  maxLDAlpha: number
  ldWidth?: number
  clMax: number
  clMaxAlpha: number
  clAtZero: number
  minCD: number
  cmAtZero: number
  ldAtZero: number
  ldAtDesignAlpha?: number
  smoothness_CM?: number
  avg_confidence?: number
  thickness?: number
  thickness_location?: number
  camber?: number
  camber_location?: number
}

interface AxisOption {
  key: keyof SummaryRow
  label: string
}

interface Props {
  summaryData: SummaryRow[]
  designAlpha?: number | null
  xAxis?: keyof SummaryRow
  yAxis?: keyof SummaryRow
}

const props = withDefaults(defineProps<Props>(), {
  xAxis: 'thickness',
  yAxis: 'maxLD',
})

const emit = defineEmits<{
  (e: 'update:xAxis', value: keyof SummaryRow): void
  (e: 'update:yAxis', value: keyof SummaryRow): void
}>()

/**
 * Axis options - dynamically include ldAtDesignAlpha if designAlpha is set
 */
const axisOptions = computed(() => {
  const options: AxisOption[] = [
    { key: 'maxLD', label: 'Max L/D' },
    { key: 'maxLDAlpha', label: 'α @ Max L/D (°)' },
    { key: 'ldWidth', label: 'L/D Width (°)' },
    { key: 'clMax', label: 'CL Max' },
    { key: 'clMaxAlpha', label: 'α @ CL Max (°)' },
    { key: 'clAtZero', label: 'CL @ α=0°' },
    { key: 'minCD', label: 'Min CD' },
    { key: 'cmAtZero', label: 'CM @ α=0°' },
    { key: 'ldAtZero', label: 'L/D @ α=0°' },
    { key: 'smoothness_CM', label: 'Smoothness CM' },
    { key: 'avg_confidence', label: 'NN Confidence' },
    { key: 'thickness', label: 'Thickness (%)' },
    { key: 'thickness_location', label: 'Thickness Loc (%)' },
    { key: 'camber', label: 'Camber (%)' },
    { key: 'camber_location', label: 'Camber Loc (%)' },
  ]

  if (props.designAlpha !== null && props.designAlpha !== undefined) {
    options.unshift({ key: 'ldAtDesignAlpha', label: 'L/D @ design α' })
  }

  return options
})

// Computed properties for v-model binding
const xAxisKey = computed({
  get: () => props.xAxis,
  set: (val) => emit('update:xAxis', val),
})

const yAxisKey = computed({
  get: () => props.yAxis,
  set: (val) => emit('update:yAxis', val),
})

/**
 * Check if a value is valid for plotting
 */
const isValidValue = (value: any): boolean => {
  return value !== undefined && value !== null && isFinite(value as number)
}

/**
 * Generate scatter chart data
 */
const scatterChartData = computed(() => {
  const xKey = xAxisKey.value
  const yKey = yAxisKey.value

  const points: Array<{ x: number; y: number; name: string }> = []

  props.summaryData.forEach((row) => {
    const xVal = row[xKey]
    const yVal = row[yKey]

    if (isValidValue(xVal) && isValidValue(yVal)) {
      points.push({
        x: xVal as number,
        y: yVal as number,
        name: row.name,
      })
    }
  })

  return {
    datasets: [
      {
        label: 'Airfoils',
        data: points,
        backgroundColor: chartColors.primary,
        borderColor: chartColors.primary,
        borderWidth: 1,
        pointRadius: 6,
        pointHoverRadius: 8,
        fill: false,
      },
    ],
  }
})

/**
 * Get labels for current axes
 */
const xAxisLabel = computed(() => {
  const option = axisOptions.value.find((opt) => opt.key === xAxisKey.value)
  return option?.label || ''
})

const yAxisLabel = computed(() => {
  const option = axisOptions.value.find((opt) => opt.key === yAxisKey.value)
  return option?.label || ''
})

/**
 * Chart options
 */
const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      ...themedTooltip,
      enabled: true,
      callbacks: {
        title: (context: any[]) => {
          if (context.length > 0 && context[0].raw) {
            return context[0].raw.name || ''
          }
          return ''
        },
        label: (context: any) => {
          if (context.raw) {
            const point = context.raw
            return `${xAxisLabel.value}: ${point.x.toFixed(3)}, ${yAxisLabel.value}: ${point.y.toFixed(3)}`
          }
          return ''
        },
      },
    },
  },
  scales: {
    x: {
      ...themedAxis(xAxisLabel.value),
      type: 'linear' as const,
      position: 'bottom' as const,
    },
    y: {
      ...themedAxis(yAxisLabel.value),
      type: 'linear' as const,
    },
  },
  interaction: {
    mode: 'nearest' as const,
    intersect: true,
  },
}))

/**
 * Get valid data count for display
 */
const validDataCount = computed(() => {
  const xKey = xAxisKey.value
  const yKey = yAxisKey.value

  return props.summaryData.filter((row) => {
    const xVal = row[xKey]
    const yVal = row[yKey]
    return isValidValue(xVal) && isValidValue(yVal)
  }).length
})
</script>

<template>
  <div>
    <!-- Axis Selection Controls -->
    <div class="mb-4 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
      <div class="w-full flex-1">
        <label for="scatter-x-axis" class="mb-1 block text-sm font-medium text-gray-700">X-Axis</label>
        <select
          id="scatter-x-axis"
          v-model="xAxisKey"
          class="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option v-for="option in axisOptions" :key="option.key" :value="option.key">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="w-full flex-1">
        <label for="scatter-y-axis" class="mb-1 block text-sm font-medium text-gray-700">Y-Axis</label>
        <select
          id="scatter-y-axis"
          v-model="yAxisKey"
          class="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option v-for="option in axisOptions" :key="option.key" :value="option.key">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="flex h-9 items-center gap-1 text-xs text-gray-500 sm:ml-auto">
        <Icon name="heroicons:information-circle" class="h-4 w-4" aria-hidden="true" />
        <span><span class="num">{{ validDataCount }}</span> of <span class="num">{{ summaryData.length }}</span> points plotted</span>
      </div>
    </div>

    <!-- Scatter Plot -->
    <div class="h-80 rounded-lg border border-gray-200 p-3">
      <Scatter :data="scatterChartData" :options="chartOptions" />
    </div>
  </div>
</template>
