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

interface SummaryRow {
  name: string
  maxLD: number
  maxLDAlpha: number
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
}

const props = defineProps<Props>()

// Color palette for points
const colors = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
]

/**
 * Axis options - dynamically include ldAtDesignAlpha if designAlpha is set
 */
const axisOptions = computed(() => {
  const options: AxisOption[] = [
    { key: 'maxLD', label: 'Max L/D' },
    { key: 'maxLDAlpha', label: 'α @ Max L/D (°)' },
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

// Default selections
const xAxisKey = ref<keyof SummaryRow>('thickness')
const yAxisKey = ref<keyof SummaryRow>('maxLD')

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
        backgroundColor: colors[0],
        borderColor: colors[0],
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
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: 'white',
      bodyColor: 'white',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 1,
      padding: 12,
      titleFont: {
        size: 14,
        weight: 'bold' as const,
      },
      bodyFont: {
        size: 12,
      },
    },
  },
  scales: {
    x: {
      type: 'linear' as const,
      position: 'bottom' as const,
      title: {
        display: true,
        text: xAxisLabel.value,
        font: {
          size: 12,
          weight: 'bold' as const,
        },
      },
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.1)',
      },
    },
    y: {
      type: 'linear' as const,
      title: {
        display: true,
        text: yAxisLabel.value,
        font: {
          size: 12,
          weight: 'bold' as const,
        },
      },
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.1)',
      },
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
  <div class="bg-white rounded-lg border border-gray-200 p-4">
    <!-- Title -->
    <h3 class="text-lg font-semibold text-gray-900 mb-4">Scatter Plot View</h3>
    
    <!-- Axis Selection Controls -->
    <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-end mb-4">
      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-2">X-Axis</label>
        <select
          v-model="xAxisKey"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option v-for="option in axisOptions" :key="option.key" :value="option.key">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="flex-1">
        <label class="block text-sm font-medium text-gray-700 mb-2">Y-Axis</label>
        <select
          v-model="yAxisKey"
          class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option v-for="option in axisOptions" :key="option.key" :value="option.key">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="text-xs text-gray-500 sm:ml-auto">
        <Icon name="heroicons:information-circle" class="h-4 w-4 inline mr-1" />
        {{ validDataCount }} of {{ summaryData.length }} points plotted
      </div>
    </div>

    <!-- Scatter Plot -->
    <div class="h-80">
      <Scatter :data="scatterChartData" :options="chartOptions" />
    </div>
  </div>
</template>
