<script setup lang="ts">
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
  smoothness_CM?: number
  avg_confidence?: number
  thickness?: number
  thickness_location?: number
  camber?: number
  camber_location?: number
}

interface Props {
  summaryData: SummaryRow[]
}

const props = defineProps<Props>()

/**
 * Format number for display
 */
const formatNumber = (value: number | undefined | null, decimals = 3): string => {
  if (value === undefined || value === null || !isFinite(value)) return 'N/A'
  return value.toFixed(decimals)
}

/**
 * Export summary table to CSV
 */
const exportToCSV = () => {
  const headers = [
    'Airfoil Name',
    'Max L/D',
    'α at Max L/D (°)',
    'CL Max',
    'α at CL Max (°)',
    'CL @ α=0°',
    'Min CD',
    'CM @ α=0°',
    'L/D @ α=0°',
    'Smoothness CM',
    'NN Confidence',
    'Thickness (%)',
    'Thickness Location (%)',
    'Camber (%)',
    'Camber Location (%)',
  ]

  const rows = props.summaryData.map((row) => [
    row.name,
    formatNumber(row.maxLD, 3),
    formatNumber(row.maxLDAlpha, 2),
    formatNumber(row.clMax, 3),
    formatNumber(row.clMaxAlpha, 2),
    formatNumber(row.clAtZero, 3),
    formatNumber(row.minCD, 4),
    formatNumber(row.cmAtZero, 3),
    formatNumber(row.ldAtZero, 3),
    formatNumber(row.smoothness_CM, 3),
    formatNumber(row.avg_confidence, 3),
    formatNumber(row.thickness, 2),
    formatNumber(row.thickness_location, 2),
    formatNumber(row.camber, 2),
    formatNumber(row.camber_location, 2),
  ])

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', 'airfoil_comparison_summary.csv')
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Export Button -->
    <div class="flex justify-end">
      <button
        type="button"
        class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        @click="exportToCSV"
      >
        <Icon name="heroicons:arrow-down-tray" class="h-5 w-5" />
        Export CSV
      </button>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto bg-white rounded-lg border border-gray-200">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              scope="col"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10"
            >
              Airfoil Name
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Max L/D
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              α @ Max L/D
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              CL Max
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              α @ CL Max
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              CL @ α=0°
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Min CD
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              CM @ α=0°
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              L/D @ α=0°
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Smoothness CM
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              NN Confidence
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              t/c (%)
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              t/c Loc (%)
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Camber (%)
            </th>
            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Camber Loc (%)
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="row in summaryData"
            :key="row.name"
            class="hover:bg-gray-50 transition-colors"
          >
            <td
              class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10"
            >
              {{ row.name }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.maxLD, 3) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.maxLDAlpha, 2) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.clMax, 3) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.clMaxAlpha, 2) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.clAtZero, 3) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.minCD, 4) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.cmAtZero, 3) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.ldAtZero, 3) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.smoothness_CM, 3) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.avg_confidence, 3) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.thickness, 2) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.thickness_location, 2) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.camber, 2) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.camber_location, 2) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

