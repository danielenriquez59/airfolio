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
import type { AirfoilPolarData } from '~/composables/useCompare'
import { calculateLD } from '~/composables/useCompare'

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

interface Props {
  airfoils: AirfoilPolarData[]
}

const props = defineProps<Props>()

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

    return {
      label: airfoil.name,
      data: data.map((value, i) => ({
        x: airfoil.alpha[i],
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

// Generate datasets for legend-only chart (using CL data as base)
const legendChartData = computed(() => {
  const datasets = props.airfoils.map((airfoil, idx) => ({
    label: airfoil.name,
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
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      labels: {
        usePointStyle: true,
        padding: 15,
        font: {
          size: 13,
        },
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

const clChartOptions = computed(() => getChartOptions('Lift Coefficient (CL)', false))
const cdChartOptions = computed(() => getChartOptions('Drag Coefficient (CD)', false))
const cmChartOptions = computed(() => getChartOptions('Moment Coefficient (CM)', false))
const ldChartOptions = computed(() => getChartOptions('Lift-to-Drag Ratio (L/D)', false))
</script>

<template>
  <div class="space-y-6">
    <!-- Legend Panel (spans 2 columns) -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-4">
        <div class="h-16">
          <Line :data="legendChartData" :options="legendChartOptions" />
        </div>
      </div>
    </div>

    <!-- Plots Grid: 2x2 on large screens, 1 column on smaller screens -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

