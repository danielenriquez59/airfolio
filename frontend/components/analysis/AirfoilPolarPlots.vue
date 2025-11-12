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

interface PerformanceDataPoint {
  name: string // condition label from cache
  alpha: number[]
  CL: number[]
  CD: number[]
  CM: number[]
}

interface Props {
  performanceData: PerformanceDataPoint[]
}

const props = defineProps<Props>()

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

// Chart options
const getChartOptions = (
  yLabel: string,
  showLegend: boolean
): any => ({
  responsive: true,
  maintainAspectRatio: false,
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
})

const clChartData = computed(() => generateChartData('CL', true))
const cdChartData = computed(() => generateChartData('CD', false))
const cmChartData = computed(() => generateChartData('CM', false))
const ldChartData = computed(() => generateChartData('LD', false))

const clChartOptions = computed(() => getChartOptions('Lift Coefficient (CL)', true))
const cdChartOptions = computed(() => getChartOptions('Drag Coefficient (CD)', false))
const cmChartOptions = computed(() => getChartOptions('Moment Coefficient (CM)', false))
const ldChartOptions = computed(() => getChartOptions('Lift-to-Drag Ratio (L/D)', false))
</script>

<template>
  <div v-if="performanceData.length === 0" class="text-center py-8 text-gray-500">
    <p>No performance data selected. Select conditions from the Performance Data section above to view plots.</p>
  </div>
  
  <div v-else class="space-y-6">
    <!-- CL vs α -->
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="h-64">
        <Line :data="clChartData" :options="clChartOptions" />
      </div>
    </div>

    <!-- CD vs α -->
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="h-64">
        <Line :data="cdChartData" :options="cdChartOptions" />
      </div>
    </div>

    <!-- CM vs α -->
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="h-64">
        <Line :data="cmChartData" :options="cmChartOptions" />
      </div>
    </div>

    <!-- L/D vs α -->
    <div class="bg-white rounded-lg border border-gray-200 p-4">
      <div class="h-64">
        <Line :data="ldChartData" :options="ldChartOptions" />
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

