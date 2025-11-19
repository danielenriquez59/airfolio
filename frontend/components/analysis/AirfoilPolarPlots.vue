<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
)

interface PerformanceDataPoint {
  name: string // condition label from cache
  alpha: number[]
  CL: number[]
  CD: number[]
  CM: number[]
}

interface Props {
  performanceData: PerformanceDataPoint[]
  showControls?: boolean // Whether to show reset zoom and tooltip toggle buttons
}

const props = withDefaults(defineProps<Props>(), {
  showControls: true
})

// Color palette for multiple conditions
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
 * Calculate L/D ratio from CL and CD arrays
 */
const calculateLD = (CL: number[], CD: number[]): number[] => {
  return CL.map((cl, i) => {
    const cd = CD[i]
    if (!isFinite(cl) || !isFinite(cd) || cd === 0) return 0
    return cl / cd
  })
}

// Generate chart data for a metric
const generateChartData = (
  metric: 'CL' | 'CD' | 'CM' | 'LD',
  showLegend: boolean
) => {
  const datasets = props.performanceData.map((data, idx) => {
    let values: number[]
    
    if (metric === 'LD') {
      values = calculateLD(data.CL, data.CD)
    } else {
      values = data[metric]
    }

    return {
      label: data.name,
      data: values.map((value, i) => ({
        x: data.alpha[i],
        y: value,
      })),
      borderColor: colors[idx % colors.length],
      backgroundColor: colors[idx % colors.length] + '20',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
      tension: 0.1,
    }
  })

  return {
    datasets,
  }
}

// Tooltip enabled state
const tooltipsEnabled = ref(true)

// Chart options
const getChartOptions = (
  yLabel: string,
  showLegend: boolean,
  enableTooltips: boolean = true
): any => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  parsing: false,
  normalized: true,
  plugins: {
    legend: {
      display: showLegend,
      position: 'top' as const,
      labels: {
        usePointStyle: true,
        padding: 15,
        font: {
          size: 12,
        },
      },
    },
    tooltip: {
      enabled: enableTooltips,
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        title: (context: any[]) => {
          const point = context[0]
          return `α = ${point.raw.x.toFixed(2)}°`
        },
        label: (context: any) => {
          return `${context.dataset.label}: ${context.raw.y.toFixed(4)}`
        },
      },
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: 'white',
      bodyColor: 'white',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 1,
      padding: 12,
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
    },
  },
  scales: {
    x: {
      type: 'linear' as const,
      position: 'bottom' as const,
      title: {
        display: true,
        text: 'Angle of Attack α (degrees)',
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
        text: yLabel,
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
  elements: {
    point: {
      radius: 0,
      hitRadius: 0,
      hoverRadius: 3,
    },
    line: {
      tension: 0,
    },
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false,
  },
})

const clChartData = computed(() => generateChartData('CL', true))
const cdChartData = computed(() => generateChartData('CD', false))
const cmChartData = computed(() => generateChartData('CM', false))
const ldChartData = computed(() => generateChartData('LD', false))

const clChartOptions = computed(() => getChartOptions('Lift Coefficient (CL)', false, tooltipsEnabled.value))
const cdChartOptions = computed(() => getChartOptions('Drag Coefficient (CD)', false, tooltipsEnabled.value))
const cmChartOptions = computed(() => getChartOptions('Moment Coefficient (CM)', false, tooltipsEnabled.value))
const ldChartOptions = computed(() => getChartOptions('Lift-to-Drag Ratio (L/D)', false, tooltipsEnabled.value))

// Generate datasets for legend-only chart (using CL data as base)
const legendChartData = computed(() => {
  const datasets = props.performanceData.map((data, idx) => ({
    label: data.name,
    data: [], // Empty data array - we only want the legend
    borderColor: colors[idx % colors.length],
    backgroundColor: colors[idx % colors.length] + '20',
    borderWidth: 2,
  }))

  return { datasets }
})

// Options for legend-only chart
const legendChartOptions = computed((): any => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      maxHeight: 200,
      labels: {
        usePointStyle: true,
        padding: props.performanceData.length > 100 ? 8 : 15,
        font: {
          size: props.performanceData.length > 100 ? 10 : 13,
        },
        boxWidth: props.performanceData.length > 100 ? 8 : 12,
      },
    },
    tooltip: {
      enabled: false, // Disable tooltip for legend chart
    },
  },
  scales: {
    x: {
      display: false, // Hide x-axis
    },
    y: {
      display: false, // Hide y-axis
    },
  },
  elements: {
    point: {
      radius: 0, // Hide points
    },
    line: {
      borderWidth: 0, // Hide lines
    },
  },
}))

// Chart refs for reset zoom
const clChartRef = ref<InstanceType<typeof Line> | null>(null)
const cdChartRef = ref<InstanceType<typeof Line> | null>(null)
const cmChartRef = ref<InstanceType<typeof Line> | null>(null)
const ldChartRef = ref<InstanceType<typeof Line> | null>(null)

// Reset zoom on all charts
const resetZoom = () => {
  const charts = [clChartRef.value, cdChartRef.value, cmChartRef.value, ldChartRef.value]
  charts.forEach((chartRef) => {
    if (chartRef && chartRef.chart) {
      const chart = chartRef.chart as any
      if (chart && typeof chart.resetZoom === 'function') {
        chart.resetZoom()
      }
    }
  })
}

const emit = defineEmits<{
  tooltipsToggled: [enabled: boolean]
}>()

// Toggle tooltips
const toggleTooltips = () => {
  tooltipsEnabled.value = !tooltipsEnabled.value
  emit('tooltipsToggled', tooltipsEnabled.value)
}

// Expose methods and state for parent component
defineExpose({
  resetZoom,
  toggleTooltips,
  get tooltipsEnabled() {
    return tooltipsEnabled.value
  },
})
</script>

<template>
  <div v-if="performanceData.length === 0" class="text-center py-8 text-gray-500">
    <p>No performance data selected. Select conditions from the Performance Data section above to view plots.</p>
  </div>
  
  <div v-else class="space-y-6">
    <!-- Legend Panel (spans 2 columns) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-4">
        <div :class="props.performanceData.length > 100 ? 'h-32' : 'h-16'">
          <Line :data="legendChartData" :options="legendChartOptions" />
        </div>
      </div>
    </div>

    <!-- Control Buttons (below legend, above plots) -->
    <div v-if="props.showControls" class="flex justify-end gap-2">
      <button
        type="button"
        @click="toggleTooltips"
        :class="[
          'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
          tooltipsEnabled
            ? 'text-indigo-700 bg-indigo-50 border border-indigo-300 hover:bg-indigo-100'
            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
        ]"
      >
        <Icon name="heroicons:information-circle" class="h-4 w-4" />
        {{ tooltipsEnabled ? 'Disable Data Hover' : 'Enable Data Hover' }}
      </button>
      <button
        type="button"
        @click="resetZoom"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <Icon name="heroicons:arrow-path" class="h-4 w-4" />
        Reset Zoom
      </button>
    </div>

    <!-- Plots Grid: 2x2 on large screens, 1 column on smaller screens -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- CL vs α -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="h-64">
          <Line ref="clChartRef" :data="clChartData" :options="clChartOptions" />
        </div>
      </div>

      <!-- CD vs α -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="h-64">
          <Line ref="cdChartRef" :data="cdChartData" :options="cdChartOptions" />
        </div>
      </div>

      <!-- CM vs α -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="h-64">
          <Line ref="cmChartRef" :data="cmChartData" :options="cmChartOptions" />
        </div>
      </div>

      <!-- L/D vs α -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="h-64">
          <Line ref="ldChartRef" :data="ldChartData" :options="ldChartOptions" />
        </div>
      </div>
    </div>

    <!-- Plot Explanation (Collapsible) -->
    <div class="bg-gray-50 rounded-lg border border-gray-200">
      <details class="group">
        <summary
          class="cursor-pointer p-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <span class="font-medium text-gray-900">Plot Explanation</span>
          <Icon
            name="heroicons:chevron-down"
            class="h-5 w-5 text-gray-500 group-open:rotate-180 transition-transform"
          />
        </summary>
        <div class="px-4 pb-4 space-y-3 text-sm text-gray-700">
          <div>
            <strong class="text-gray-900">CL (Lift Coefficient):</strong> Measures the lift
            generated by the airfoil. Higher CL values indicate more lift at a given angle of
            attack.
          </div>
          <div>
            <strong class="text-gray-900">CD (Drag Coefficient):</strong> Measures the drag
            resistance. Lower CD values indicate less drag and better efficiency.
          </div>
          <div>
            <strong class="text-gray-900">CM (Moment Coefficient):</strong> Measures the pitching
            moment about the quarter-chord. Important for stability analysis.
          </div>
          <div>
            <strong class="text-gray-900">L/D (Lift-to-Drag Ratio):</strong> The ratio of lift to
            drag. Higher L/D values indicate better aerodynamic efficiency.
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

