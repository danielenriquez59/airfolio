<script setup lang="ts">
import { computed, ref } from 'vue'
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
import type { AirfoilPolarData } from '~/composables/useCompare'
import { calculateLD } from '~/composables/useCompare'
import { exportPolarDataCSV } from '~/composables/useCSVExport'
import { downsampleLTTB, getOptimalThreshold } from '~/utils/dataDownsampling'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// Register zoom plugin only on client side
if (process.client) {
  import('chartjs-plugin-zoom').then((zoomPlugin) => {
    ChartJS.register(zoomPlugin.default)
  })
}

interface Props {
  airfoils: AirfoilPolarData[]
  performanceMode?: 'performance' | 'detail'
}

const props = withDefaults(defineProps<Props>(), {
  performanceMode: 'performance'
})

// Color palette for multiple airfoils
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

// Computed properties for downsampling
const downsampleThreshold = computed(() => 
  getOptimalThreshold(
    props.airfoils[0]?.alpha.length || 0,
    props.airfoils.length
  )
)

const shouldDownsample = computed(() => 
  props.performanceMode === 'performance' && props.airfoils.length > 20
)

// Generate chart data for a metric
const generateChartData = (
  metric: 'CL' | 'CD' | 'CM' | 'LD',
  showLegend: boolean
) => {
  const datasets = props.airfoils.map((airfoil, idx) => {
    let data: number[]
    
    if (metric === 'LD') {
      data = calculateLD(airfoil.CL, airfoil.CD)
    } else {
      data = airfoil[metric]
    }

    let chartData = data.map((value, i) => ({
      x: airfoil.alpha[i],
      y: value,
    }))

    // Apply downsampling in performance mode
    if (shouldDownsample.value) {
      chartData = downsampleLTTB(chartData, downsampleThreshold.value)
    }

    return {
      label: airfoil.name,
      data: chartData,
      borderColor: colors[idx % colors.length],
      backgroundColor: colors[idx % colors.length] + '20',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
      tension: 0,
    }
  })

  return {
    datasets,
  }
}

// Tooltip enabled state
const tooltipsEnabled = ref(true)

// Plots expanded state (1 column vs 2 columns)
const plotsExpanded = ref(false)

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

// Generate datasets for legend-only chart (using CL data as base)
const legendChartData = computed(() => {
  const datasets = props.airfoils.map((airfoil, idx) => ({
    label: airfoil.name.toUpperCase(),
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
        padding: props.airfoils.length > 100 ? 8 : 15,
        font: {
          size: props.airfoils.length > 100 ? 10 : 13,
        },
        boxWidth: props.airfoils.length > 100 ? 8 : 12,
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

const clChartData = computed(() => generateChartData('CL', false))
const cdChartData = computed(() => generateChartData('CD', false))
const cmChartData = computed(() => generateChartData('CM', false))
const ldChartData = computed(() => generateChartData('LD', false))

const clChartOptions = computed(() => getChartOptions('Lift Coefficient (CL)', false, tooltipsEnabled.value))
const cdChartOptions = computed(() => getChartOptions('Drag Coefficient (CD)', false, tooltipsEnabled.value))
const cmChartOptions = computed(() => getChartOptions('Moment Coefficient (CM)', false, tooltipsEnabled.value))
const ldChartOptions = computed(() => getChartOptions('Lift-to-Drag Ratio (L/D)', false, tooltipsEnabled.value))

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

// Export filtered data to CSV
const handleExportCSV = () => {
  if (!props.airfoils || props.airfoils.length === 0) {
    return
  }
  exportPolarDataCSV(props.airfoils)
}

// Toggle tooltips
const toggleTooltips = () => {
  tooltipsEnabled.value = !tooltipsEnabled.value
}

// Toggle plots view
const togglePlotsView = () => {
  plotsExpanded.value = !plotsExpanded.value
}
</script>

<template>
  <div class="space-y-6">
    <!-- Performance Info Banner -->
    <div v-if="airfoils.length > 50" class="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <p class="text-sm text-blue-800">
        <Icon name="heroicons:information-circle" class="inline h-4 w-4 mr-1" />
        Rendering {{ airfoils.length }} airfoils
        <span v-if="shouldDownsample">
          ({{ downsampleThreshold }} points per curve for optimal performance)
        </span>
      </p>
    </div>

    <!-- Legend Panel (spans 2 columns) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-4">
        <div :class="airfoils.length > 100 ? 'h-32' : 'h-16'">
          <Line :data="legendChartData" :options="legendChartOptions" />
        </div>
      </div>
    </div>

    <!-- Reset Zoom, Export, and Tooltip Toggle Buttons -->
    <div class="flex justify-end gap-2">
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
        @click="togglePlotsView"
        :class="[
          'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
          plotsExpanded
            ? 'text-indigo-700 bg-indigo-50 border border-indigo-300 hover:bg-indigo-100'
            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
        ]"
      >
        <Icon :name="plotsExpanded ? 'heroicons:squares-2x2' : 'heroicons:arrows-pointing-out'" class="h-4 w-4" />
        {{ plotsExpanded ? 'Compact Plots' : 'Enlarge Plots' }}
      </button>
      <button
        type="button"
        @click="resetZoom"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <Icon name="heroicons:arrow-path" class="h-4 w-4" />
        Reset Zoom
      </button>
      <button
        type="button"
        @click="handleExportCSV"
        :disabled="!airfoils || airfoils.length === 0"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
        Export Filtered Data
      </button>
    </div>

    <!-- Plots Grid: 2x2 on large screens, 1 column on smaller screens, 1 column when expanded -->
    <div :class="['grid gap-6', plotsExpanded ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2']">
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

