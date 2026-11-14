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
import { toggleButtonClasses } from '~/layers/ui/utils/buttons'
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
applyChartDefaults(ChartJS)

// Register zoom plugin only on client side
if (process.client) {
  import('chartjs-plugin-zoom').then((zoomPlugin) => {
    ChartJS.register(zoomPlugin.default)
  })
}

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
      borderColor: seriesColor(idx),
      backgroundColor: seriesColor(idx),
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
      ...themedLegend,
      display: showLegend,
    },
    tooltip: {
      ...themedTooltip,
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
      ...themedAxis('Angle of Attack α (degrees)'),
      type: 'linear' as const,
      position: 'bottom' as const,
    },
    y: {
      ...themedAxis(yLabel),
      type: 'linear' as const,
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
  <VStateBlock
    v-if="performanceData.length === 0"
    title="No runs selected"
    description="Select conditions from the Performance Data section above to view plots."
    icon="heroicons:chart-bar"
  />

  <div v-else class="space-y-5">
    <!-- Legend: one swatch per run, colours match the series in every plot -->
    <ul class="flex max-h-32 flex-wrap gap-x-5 gap-y-1.5 overflow-y-auto text-xs text-gray-700" aria-label="Legend">
      <li v-for="(data, idx) in performanceData" :key="`${idx}-${data.name}`" class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: seriesColor(idx) }" aria-hidden="true" />
        {{ data.name }}
      </li>
    </ul>

    <!-- Control Buttons -->
    <div v-if="props.showControls" class="flex justify-end gap-2">
      <button
        type="button"
        :class="toggleButtonClasses(tooltipsEnabled)"
        :aria-pressed="tooltipsEnabled"
        @click="toggleTooltips"
      >
        <Icon name="heroicons:cursor-arrow-rays" class="h-4 w-4" aria-hidden="true" />
        Data hover
      </button>
      <VButton
        type="button"
        color="light"
        @click="resetZoom"
      >
        <Icon name="heroicons:arrow-path" class="h-4 w-4" aria-hidden="true" />
        Reset zoom
      </VButton>
    </div>

    <!-- Plots Grid: 2x2 on large screens, 1 column on smaller screens -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="h-64">
        <Line ref="clChartRef" :data="clChartData" :options="clChartOptions" />
      </div>
      <div class="h-64">
        <Line ref="cdChartRef" :data="cdChartData" :options="cdChartOptions" />
      </div>
      <div class="h-64">
        <Line ref="cmChartRef" :data="cmChartData" :options="cmChartOptions" />
      </div>
      <div class="h-64">
        <Line ref="ldChartRef" :data="ldChartData" :options="ldChartOptions" />
      </div>
    </div>

    <!-- Plot Explanation (Collapsible) -->
    <details class="group rounded-lg border border-gray-200">
      <summary
        class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        Plot explanation
        <Icon
          name="heroicons:chevron-down"
          class="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div class="space-y-2 border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
        <div>
          <strong class="font-medium text-gray-900">CL (Lift Coefficient):</strong>
          Measures the lift generated by the airfoil. Higher CL values indicate more lift at a given angle of attack.
        </div>
        <div>
          <strong class="font-medium text-gray-900">CD (Drag Coefficient):</strong>
          Measures the drag resistance. Lower CD values indicate less drag and better efficiency.
        </div>
        <div>
          <strong class="font-medium text-gray-900">CM (Moment Coefficient):</strong>
          Measures the pitching moment about the quarter-chord. Important for stability analysis.
        </div>
        <div>
          <strong class="font-medium text-gray-900">L/D (Lift-to-Drag Ratio):</strong>
          The ratio of lift to drag. Higher L/D values indicate better aerodynamic efficiency.
        </div>
      </div>
    </details>
  </div>
</template>
