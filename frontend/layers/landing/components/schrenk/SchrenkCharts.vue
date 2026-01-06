<script setup lang="ts">
import { ref, computed } from 'vue'
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
import type { CalculationResult } from '~/types/schrenk.types'

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
  data: CalculationResult
}

const props = defineProps<Props>()

type TabType = 'dist' | 'cla' | 'shear' | 'moment'
type LoadType = 'limit' | 'ultimate'

const activeTab = ref<TabType>('shear')
const loadType = ref<LoadType>('ultimate')
const isCopied = ref(false)

const tabs = [
  { id: 'shear' as TabType, label: 'Shear Force' },
  { id: 'moment' as TabType, label: 'Bending Moment' },
  { id: 'dist' as TabType, label: 'Lift Distribution' },
  { id: 'cla' as TabType, label: 'Local Cla' },
]

const showLoadToggle = computed(() => activeTab.value === 'shear' || activeTab.value === 'moment')

const rootStation = computed(() => props.data.params.wing_root_station_in)

// Helper function to create a vertical reference line at root station
const createRootStationLine = (yMin: number, yMax: number) => ({
  label: 'Root Station',
  data: [
    { x: rootStation.value, y: yMin },
    { x: rootStation.value, y: yMax },
  ],
  borderColor: '#94a3b8',
  backgroundColor: 'transparent',
  borderWidth: 1,
  borderDash: [3, 3],
  pointRadius: 0,
  pointHoverRadius: 0,
  tension: 0,
  fill: false,
  showLine: true,
  order: 0, // Draw behind other lines
})

// Lift Distribution Chart Data
const liftDistChartData = computed(() => {
  const allYValues = [
    ...props.data.schrenkData.map(d => d.chord_ft),
    ...props.data.schrenkData.map(d => d.ellipse),
    ...props.data.schrenkData.map(d => d.screnk_cCla),
  ]
  const yMin = Math.min(...allYValues)
  const yMax = Math.max(...allYValues)
  const yRange = yMax - yMin
  const padding = yRange * 0.1
  
  return {
    labels: props.data.schrenkData.map(d => d.station_in),
    datasets: [
      createRootStationLine(yMin - padding, yMax + padding),
      {
        label: 'Chord',
        data: props.data.schrenkData.map(d => ({ x: d.station_in, y: d.chord_ft })),
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f620',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
      },
      {
        label: 'Ellipse',
        data: props.data.schrenkData.map(d => ({ x: d.station_in, y: d.ellipse })),
        borderColor: '#ef4444',
        backgroundColor: '#ef444420',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
      },
      {
        label: 'Schrenk cCla',
        data: props.data.schrenkData.map(d => ({ x: d.station_in, y: d.screnk_cCla })),
        borderColor: '#10b981',
        backgroundColor: '#10b98120',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
      },
    ],
  }
})

// Local Cla Chart Data
const localClaChartData = computed(() => {
  const allYValues = props.data.schrenkData.map(d => d.unit_Cla)
  const yMin = Math.min(...allYValues)
  const yMax = Math.max(...allYValues)
  const yRange = yMax - yMin
  const padding = yRange * 0.1 || 0.01
  
  return {
    labels: props.data.schrenkData.map(d => d.station_in),
    datasets: [
      createRootStationLine(Math.max(0, yMin - padding), yMax + padding),
      {
        label: 'Local Cla',
        data: props.data.schrenkData.map(d => ({ x: d.station_in, y: d.unit_Cla })),
        borderColor: '#8b5cf6',
        backgroundColor: '#8b5cf620',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
      },
    ],
  }
})

// Shear Chart Data
const shearChartData = computed(() => {
  const shearKey = loadType.value === 'ultimate' ? 'ult_shear_lb' : 'total_limit_shear_lb'
  const aeroKey = loadType.value === 'ultimate' ? 'ult_aero_shear_lb' : 'aero_shear_lb'
  const inertiaKey = loadType.value === 'ultimate' ? 'ult_inertia_shear_lb' : 'inertia_shear_lb'
  
  const allYValues = [
    ...props.data.loadData.map(d => d[shearKey]),
    ...props.data.loadData.map(d => d[aeroKey]),
    ...props.data.loadData.map(d => d[inertiaKey]),
  ]
  const yMin = Math.min(...allYValues)
  const yMax = Math.max(...allYValues)
  const yRange = yMax - yMin
  const padding = yRange * 0.1 || 100
  
  return {
    labels: props.data.loadData.map(d => d.station_in),
    datasets: [
      createRootStationLine(yMin - padding, yMax + padding),
      {
        label: 'Total',
        data: props.data.loadData.map(d => ({ x: d.station_in, y: d[shearKey] })),
        borderColor: '#22c55e',
        backgroundColor: '#22c55e20',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
      },
      {
        label: 'Aero',
        data: props.data.loadData.map(d => ({ x: d.station_in, y: d[aeroKey] })),
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f620',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
      },
      {
        label: 'Inertia',
        data: props.data.loadData.map(d => ({ x: d.station_in, y: d[inertiaKey] })),
        borderColor: '#ef4444',
        backgroundColor: '#ef444420',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
      },
    ],
  }
})

// Moment Chart Data
const momentChartData = computed(() => {
  const momentKey = loadType.value === 'ultimate' ? 'ult_moment_lb_in' : 'total_limit_moment_lb_in'
  const aeroKey = loadType.value === 'ultimate' ? 'ult_aero_moment_lb_in' : 'aero_moment_lb_in'
  const inertiaKey = loadType.value === 'ultimate' ? 'ult_inertia_moment_lb_in' : 'inertia_moment_lb_in'
  
  const allYValues = [
    ...props.data.loadData.map(d => d[momentKey]),
    ...props.data.loadData.map(d => d[aeroKey]),
    ...props.data.loadData.map(d => d[inertiaKey]),
  ]
  const yMin = Math.min(...allYValues)
  const yMax = Math.max(...allYValues)
  const yRange = yMax - yMin
  const padding = yRange * 0.1 || 1000
  
  return {
    labels: props.data.loadData.map(d => d.station_in),
    datasets: [
      createRootStationLine(yMin - padding, yMax + padding),
      {
        label: 'Total',
        data: props.data.loadData.map(d => ({ x: d.station_in, y: d[momentKey] })),
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b20',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0,
      },
      {
        label: 'Aero',
        data: props.data.loadData.map(d => ({ x: d.station_in, y: d[aeroKey] })),
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f620',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
      },
      {
        label: 'Inertia',
        data: props.data.loadData.map(d => ({ x: d.station_in, y: d[inertiaKey] })),
        borderColor: '#ef4444',
        backgroundColor: '#ef444420',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
      },
    ],
  }
})

// Chart Options
const getChartOptions = (yLabel: string, showLegend: boolean) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: showLegend,
      position: 'top' as const,
      filter: (legendItem: any) => legendItem.text !== 'Root Station',
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        label: (context: any) => {
          return `${context.dataset.label}: ${context.parsed.y.toFixed(activeTab.value === 'cla' ? 4 : activeTab.value === 'dist' ? 3 : activeTab.value === 'shear' ? 1 : 0)}`
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
      type: 'linear' as const,
      position: 'bottom' as const,
      title: {
        display: true,
        text: 'Station (in)',
        font: {
          size: 12,
          weight: 'bold' as const,
        },
      },
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.1)',
      },
      min: 0,
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
        drawBorder: false,
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

const liftDistOptions = computed(() => getChartOptions('Chord / Ellipse (ft)', true))
const localClaOptions = computed(() => getChartOptions('Local Cla', true))
const shearOptions = computed(() => getChartOptions(`Shear (${loadType.value === 'ultimate' ? 'Ult' : 'Limit'}) lb`, true))
const momentOptions = computed(() => getChartOptions(`Moment (${loadType.value === 'ultimate' ? 'Ult' : 'Limit'}) lb-in`, true))

// Copy data to clipboard
const copyDataToClipboard = async () => {
  let chartData
  let title = ''

  switch (activeTab.value) {
    case 'dist':
      chartData = liftDistChartData.value
      title = 'Lift Distribution Data'
      break
    case 'cla':
      chartData = localClaChartData.value
      title = 'Local Cla Data'
      break
    case 'shear':
      chartData = shearChartData.value
      title = `Shear Force Data (${loadType.value === 'ultimate' ? 'Ultimate' : 'Limit'})`
      break
    case 'moment':
      chartData = momentChartData.value
      title = `Bending Moment Data (${loadType.value === 'ultimate' ? 'Ultimate' : 'Limit'})`
      break
  }

  if (!chartData) return

  // Filter out the root station line (first dataset)
  const dataLines = chartData.datasets.filter((ds: any) => ds.label !== 'Root Station')

  // Create CSV header
  const headers = ['Station (in)', ...dataLines.map((ds: any) => ds.label)]
  let csv = headers.join(',') + '\n'

  // Get all data points
  const numPoints = dataLines[0]?.data?.length || 0
  for (let i = 0; i < numPoints; i++) {
    const station = dataLines[0].data[i].x
    const values = dataLines.map((ds: any) => ds.data[i].y)
    csv += [station, ...values].join(',') + '\n'
  }

  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(csv)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy data:', err)
  }
}
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
    <div class="border-b border-slate-200 bg-slate-50 px-4 py-2 flex flex-col sm:flex-row justify-between items-center gap-2">
      <nav class="flex space-x-4" aria-label="Tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            activeTab === tab.id
              ? 'bg-blue-100 text-blue-700'
              : 'text-slate-500 hover:text-slate-700',
            'rounded-md px-3 py-2 text-sm font-medium transition-colors'
          ]"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="flex items-center gap-2">
        <div v-if="showLoadToggle" class="flex items-center space-x-2 bg-white rounded-md border border-slate-300 px-2 py-1">
          <span class="text-xs font-semibold text-slate-500 uppercase">Loads:</span>
          <select
            v-model="loadType"
            class="text-sm border-none py-1 pl-2 pr-6 focus:ring-0 text-slate-700 font-medium bg-transparent cursor-pointer"
          >
            <option value="limit">Limit</option>
            <option value="ultimate">Ultimate</option>
          </select>
        </div>

        <button
          @click="copyDataToClipboard"
          :class="[
            'rounded-md px-3 py-1.5 text-sm font-medium transition-all flex items-center gap-1.5 border',
            isCopied
              ? 'bg-green-50 text-green-700 border-green-300'
              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
          ]"
          title="Copy chart data to clipboard"
        >
          <svg v-if="!isCopied" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {{ isCopied ? 'Copied!' : 'Copy Data' }}
        </button>
      </div>
    </div>

    <div class="p-4 flex-1 min-h-[400px]">
      <Line
        v-if="activeTab === 'dist'"
        :data="liftDistChartData"
        :options="liftDistOptions"
      />
      <Line
        v-else-if="activeTab === 'cla'"
        :data="localClaChartData"
        :options="localClaOptions"
      />
      <Line
        v-else-if="activeTab === 'shear'"
        :data="shearChartData"
        :options="shearOptions"
      />
      <Line
        v-else-if="activeTab === 'moment'"
        :data="momentChartData"
        :options="momentOptions"
      />
    </div>
  </div>
</template>

