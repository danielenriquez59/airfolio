<script setup lang="ts">
import { ref, computed } from 'vue'

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

interface Props {
  summaryData: SummaryRow[]
  designAlpha?: number | null
}

const props = defineProps<Props>()

// Sort state - default to sorting by Max L/D in descending order
const sortColumn = ref<string | null>('maxLD')
const sortDirection = ref<'asc' | 'desc'>('desc')

/**
 * Format number for display
 */
const formatNumber = (value: number | undefined | null, decimals = 3): string => {
  if (value === undefined || value === null || !isFinite(value)) return 'N/A'
  return value.toFixed(decimals)
}

/**
 * Check if a value is valid (not N/A)
 */
const isValidValue = (value: any): boolean => {
  return value !== undefined && value !== null && isFinite(value)
}

/**
 * Computed sorted data
 */
const sortedData = computed(() => {
  if (!sortColumn.value) {
    return props.summaryData
  }

  const sorted = [...props.summaryData].sort((a, b) => {
    const keyA = sortColumn.value as keyof SummaryRow
    const valA = a[keyA]
    const valB = b[keyA]

    // Handle N/A values - they always go to the bottom
    const isValidA = isValidValue(valA)
    const isValidB = isValidValue(valB)

    if (!isValidA && !isValidB) return 0
    if (!isValidA) return 1
    if (!isValidB) return -1

    // Compare based on type
    let result = 0
    if (typeof valA === 'string') {
      result = valA.localeCompare(valB as string, undefined, { sensitivity: 'base' })
    } else {
      result = (valA as number) - (valB as number)
    }

    return sortDirection.value === 'asc' ? result : -result
  })

  return sorted
})

/**
 * Handle column sort click
 */
const handleSort = (column: string) => {
  if (sortColumn.value === column) {
    // Toggle direction or remove sort
    if (sortDirection.value === 'asc') {
      sortDirection.value = 'desc'
    } else {
      sortColumn.value = null
      sortDirection.value = 'asc'
    }
  } else {
    // Set new sort column
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

/**
 * Export summary table to CSV (uses sorted data)
 */
const exportToCSV = () => {
  const headers = [
    'Airfoil Name',
    ...(props.designAlpha !== null && props.designAlpha !== undefined ? [`L/D @ design α`] : []),
    'Max L/D',
    'α at Max L/D (°)',
    'L/D Width (°)',
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

  const rows = sortedData.value.map((row) => [
    row.name,
    ...(props.designAlpha !== null && props.designAlpha !== undefined ? [formatNumber(row.ldAtDesignAlpha, 3)] : []),
    formatNumber(row.maxLD, 3),
    formatNumber(row.maxLDAlpha, 2),
    formatNumber(row.ldWidth, 2),
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
    <div class="flex justify-between items-center gap-2">
      <div class="text-sm text-gray-500">
        <Icon name="heroicons:information-circle" class="h-4 w-4" />
        Click headers to sort. <br>
        Add a Design α to calculate L/D at that angle. 
      </div>
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
    <div class="overflow-x-auto bg-white rounded-lg border border-gray-200" style="transform: scaleY(-1);">
      <table class="min-w-full divide-y divide-gray-200" style="transform: scaleY(-1);">
        <thead class="bg-gray-50">
          <tr>
            <th
              scope="col"
              @click="handleSort('name')"
              :class="{
                'bg-gray-100': sortColumn === 'name',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 z-10"
            >
              <div class="flex items-center justify-between">
                <span>Airfoil Name</span>
                <Icon
                  v-if="sortColumn === 'name'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              v-if="designAlpha !== null && designAlpha !== undefined"
              scope="col"
              @click="handleSort('ldAtDesignAlpha')"
              :class="{
                'bg-gray-100': sortColumn === 'ldAtDesignAlpha',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>L/D @ design α</span>
                <Icon
                  v-if="sortColumn === 'ldAtDesignAlpha'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('maxLD')"
              :class="{
                'bg-gray-100': sortColumn === 'maxLD',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>Max L/D</span>
                <Icon
                  v-if="sortColumn === 'maxLD'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('maxLDAlpha')"
              :class="{
                'bg-gray-100': sortColumn === 'maxLDAlpha',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>α @ Max L/D</span>
                <Icon
                  v-if="sortColumn === 'maxLDAlpha'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('ldWidth')"
              :class="{
                'bg-gray-100': sortColumn === 'ldWidth',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>L/D Width (°)</span>
                <Icon
                  v-if="sortColumn === 'ldWidth'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('clMax')"
              :class="{
                'bg-gray-100': sortColumn === 'clMax',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>CL Max</span>
                <Icon
                  v-if="sortColumn === 'clMax'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('clMaxAlpha')"
              :class="{
                'bg-gray-100': sortColumn === 'clMaxAlpha',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>α @ CL Max</span>
                <Icon
                  v-if="sortColumn === 'clMaxAlpha'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('clAtZero')"
              :class="{
                'bg-gray-100': sortColumn === 'clAtZero',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>CL @ α=0°</span>
                <Icon
                  v-if="sortColumn === 'clAtZero'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('minCD')"
              :class="{
                'bg-gray-100': sortColumn === 'minCD',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>Min CD</span>
                <Icon
                  v-if="sortColumn === 'minCD'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('cmAtZero')"
              :class="{
                'bg-gray-100': sortColumn === 'cmAtZero',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>CM @ α=0°</span>
                <Icon
                  v-if="sortColumn === 'cmAtZero'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('ldAtZero')"
              :class="{
                'bg-gray-100': sortColumn === 'ldAtZero',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>L/D @ α=0°</span>
                <Icon
                  v-if="sortColumn === 'ldAtZero'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('smoothness_CM')"
              :class="{
                'bg-gray-100': sortColumn === 'smoothness_CM',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>Smoothness CM</span>
                <Icon
                  v-if="sortColumn === 'smoothness_CM'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('avg_confidence')"
              :class="{
                'bg-gray-100': sortColumn === 'avg_confidence',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>NN Confidence</span>
                <Icon
                  v-if="sortColumn === 'avg_confidence'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('thickness')"
              :class="{
                'bg-gray-100': sortColumn === 'thickness',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>t/c (%)</span>
                <Icon
                  v-if="sortColumn === 'thickness'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('thickness_location')"
              :class="{
                'bg-gray-100': sortColumn === 'thickness_location',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>t/c Loc (%)</span>
                <Icon
                  v-if="sortColumn === 'thickness_location'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('camber')"
              :class="{
                'bg-gray-100': sortColumn === 'camber',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>Camber (%)</span>
                <Icon
                  v-if="sortColumn === 'camber'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
            <th
              scope="col"
              @click="handleSort('camber_location')"
              :class="{
                'bg-gray-100': sortColumn === 'camber_location',
                'cursor-pointer hover:bg-gray-100 transition-colors': true,
              }"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <div class="flex items-center justify-between">
                <span>Camber Loc (%)</span>
                <Icon
                  v-if="sortColumn === 'camber_location'"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-4 w-4 ml-2"
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="row in sortedData"
            :key="row.name"
            class="hover:bg-gray-50 transition-colors"
          >
            <td
              class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10"
            >
              {{ row.name }}
            </td>
            <td
              v-if="designAlpha !== null && designAlpha !== undefined"
              class="px-4 py-3 whitespace-nowrap text-sm text-gray-700"
            >
              {{ formatNumber(row.ldAtDesignAlpha, 3) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.maxLD, 3) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.maxLDAlpha, 2) }}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
              {{ formatNumber(row.ldWidth, 2) }}
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

