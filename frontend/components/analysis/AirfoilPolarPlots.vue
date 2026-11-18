<script setup lang="ts">
import { Line } from 'vue-chartjs'
import { tabButtonClasses, toggleButtonClasses } from '~/layers/ui/utils/buttons'
registerCharts()

interface PerformanceDataPoint {
  name: string // condition label from cache
  alpha: number[]
  CL: number[]
  CD: number[]
  CM: number[]
  color?: string // falls back to the palette by position
}

interface Props {
  performanceData: PerformanceDataPoint[]
  showControls?: boolean // Whether to show reset zoom and tooltip toggle buttons
  showExplanation?: boolean
  showLegend?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showControls: true,
  showExplanation: true,
  showLegend: true,
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

type XAxis = 'alpha' | 'CL'
const xAxis = ref<XAxis>('alpha')

// Generate chart data for a metric
const generateChartData = (
  metric: 'CL' | 'CD' | 'CM' | 'LD',
  showLegend: boolean,
  x: XAxis = 'alpha'
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
        x: x === 'CL' ? data.CL[i] : data.alpha[i],
        y: value,
        alpha: data.alpha[i],
      })),
      borderColor: data.color ?? seriesColor(idx),
      backgroundColor: data.color ?? seriesColor(idx),
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
  enableTooltips: boolean = true,
  x: XAxis = 'alpha'
): any => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  // parsing: false assumes data sorted by x (binary search); CL is not monotonic past stall
  ...(x === 'alpha' && { parsing: false, normalized: true }),
  plugins: {
    legend: {
      ...themedLegend,
      display: showLegend,
    },
    tooltip: {
      ...themedTooltip,
      enabled: enableTooltips,
      // Same index in different series is a different CL, so pick the nearest point instead
      mode: x === 'CL' ? 'nearest' as const : 'index' as const,
      intersect: false,
      callbacks: x === 'CL'
        ? {
            title: (context: any[]) => `CL = ${context[0].raw.x.toFixed(4)}`,
            label: (context: any) => `${context.dataset.label}: ${context.raw.y.toFixed(4)}, α = ${context.raw.alpha.toFixed(2)}°`,
          }
        : {
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
      ...themedAxis(x === 'CL' ? 'Lift Coefficient (CL)' : 'Angle of Attack α (degrees)'),
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
const cdChartData = computed(() => generateChartData('CD', false, xAxis.value))
const cmChartData = computed(() => generateChartData('CM', false, xAxis.value))
const ldChartData = computed(() => generateChartData('LD', false, xAxis.value))

const clChartOptions = computed(() => getChartOptions('Lift Coefficient (CL)', false, tooltipsEnabled.value))
const cdChartOptions = computed(() => getChartOptions('Drag Coefficient (CD)', false, tooltipsEnabled.value, xAxis.value))
const cmChartOptions = computed(() => getChartOptions('Moment Coefficient (CM)', false, tooltipsEnabled.value, xAxis.value))
const ldChartOptions = computed(() => getChartOptions('Lift-to-Drag Ratio (L/D)', false, tooltipsEnabled.value, xAxis.value))

// Chart refs for reset zoom
const clChartRef = ref<InstanceType<typeof Line> | null>(null)
const cdChartRef = ref<InstanceType<typeof Line> | null>(null)
const cmChartRef = ref<InstanceType<typeof Line> | null>(null)
const ldChartRef = ref<InstanceType<typeof Line> | null>(null)

// Reset zoom on all charts
const resetZoom = () => resetChartZoom([clChartRef.value, cdChartRef.value, cmChartRef.value, ldChartRef.value])

// A zoom window from the old x-axis would be stale
watch(xAxis, resetZoom, { flush: 'post' })

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
    <ul v-if="showLegend" class="flex max-h-32 flex-wrap gap-x-5 gap-y-1.5 overflow-y-auto text-xs text-gray-700" aria-label="Legend">
      <li v-for="(data, idx) in performanceData" :key="`${idx}-${data.name}`" class="flex items-center gap-1.5">
        <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: data.color ?? seriesColor(idx) }" aria-hidden="true" />
        {{ data.name }}
      </li>
    </ul>

    <!-- Control Buttons -->
    <div v-if="props.showControls" class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-gray-700" aria-hidden="true">X axis</span>
        <div class="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="radiogroup" aria-label="X axis">
          <button
            v-for="opt in ([['alpha', 'α'], ['CL', 'CL']] as const)"
            :key="opt[0]"
            type="button"
            role="radio"
            :aria-checked="xAxis === opt[0]"
            :class="tabButtonClasses(xAxis === opt[0])"
            @click="xAxis = opt[0]"
          >
            {{ opt[1] }}
          </button>
        </div>
      </div>
      <div class="flex gap-2">
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
    <details v-if="showExplanation" class="group rounded-lg border border-gray-200">
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
