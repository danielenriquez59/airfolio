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

/** Numeric columns in display order (label, row key, decimals) */
const columns = computed(() => [
  ...((props.designAlpha !== null && props.designAlpha !== undefined)
    ? [{ key: 'ldAtDesignAlpha', label: 'L/D @ design α', decimals: 3 }]
    : []),
  { key: 'maxLD', label: 'Max L/D', decimals: 3 },
  { key: 'maxLDAlpha', label: 'α @ Max L/D', decimals: 2 },
  { key: 'ldWidth', label: 'L/D Width (°)', decimals: 2 },
  { key: 'clMax', label: 'CL Max', decimals: 3 },
  { key: 'clMaxAlpha', label: 'α @ CL Max', decimals: 2 },
  { key: 'clAtZero', label: 'CL @ α=0°', decimals: 3 },
  { key: 'minCD', label: 'Min CD', decimals: 4 },
  { key: 'cmAtZero', label: 'CM @ α=0°', decimals: 3 },
  { key: 'ldAtZero', label: 'L/D @ α=0°', decimals: 3 },
  { key: 'smoothness_CM', label: 'Smoothness CM', decimals: 3 },
  { key: 'avg_confidence', label: 'NN Confidence', decimals: 3 },
  { key: 'thickness', label: 't/c (%)', decimals: 2 },
  { key: 'thickness_location', label: 't/c Loc (%)', decimals: 2 },
  { key: 'camber', label: 'Camber (%)', decimals: 2 },
  { key: 'camber_location', label: 'Camber Loc (%)', decimals: 2 },
] as Array<{ key: keyof SummaryRow; label: string; decimals: number }>)

function ariaSort(column: string) {
  if (sortColumn.value !== column)
    return 'none'
  return sortDirection.value === 'asc' ? 'ascending' : 'descending'
}
</script>

<template>
  <div class="space-y-4">
    <!-- Export Button -->
    <div class="flex flex-wrap items-start justify-between gap-3">
      <p class="flex items-start gap-1.5 text-sm text-gray-500">
        <Icon name="heroicons:information-circle" class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Click headers to sort. Add a Design α in the sidebar to calculate L/D at that angle.</span>
      </p>
      <VButton
        type="button"
        color="light"
        @click="exportToCSV"
      >
        <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
        Export CSV
      </VButton>
    </div>

    <!-- Table: scrolls inside its own box both ways so the header row can stay sticky -->
    <div class="max-h-[70vh] overflow-auto rounded-lg border border-gray-200">
      <table class="min-w-full text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              :aria-sort="ariaSort('name')"
              class="sticky left-0 top-0 z-20 border-b border-gray-200 bg-gray-50 p-0 text-left"
            >
              <button
                type="button"
                class="flex w-full items-center gap-1 px-3 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                :class="{ 'text-gray-900': sortColumn === 'name' }"
                @click="handleSort('name')"
              >
                Airfoil Name
                <Icon
                  :name="sortColumn === 'name' ? (sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down') : 'heroicons:chevron-up-down'"
                  class="h-3.5 w-3.5 shrink-0"
                  :class="sortColumn === 'name' ? 'text-primary-600' : 'text-gray-400'"
                  aria-hidden="true"
                />
              </button>
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :aria-sort="ariaSort(col.key)"
              class="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 p-0 text-right"
            >
              <button
                type="button"
                class="flex w-full items-center justify-end gap-1 whitespace-nowrap px-3 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                :class="{ 'text-gray-900': sortColumn === col.key }"
                @click="handleSort(col.key)"
              >
                {{ col.label }}
                <Icon
                  :name="sortColumn === col.key ? (sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down') : 'heroicons:chevron-up-down'"
                  class="h-3.5 w-3.5 shrink-0"
                  :class="sortColumn === col.key ? 'text-primary-600' : 'text-gray-400'"
                  aria-hidden="true"
                />
              </button>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr
            v-for="row in sortedData"
            :key="row.name"
            class="group"
          >
            <td class="sticky left-0 z-[5] whitespace-nowrap bg-white px-3 py-2 font-medium text-gray-900 group-hover:bg-gray-50">
              {{ row.name }}
            </td>
            <td
              v-for="col in columns"
              :key="col.key"
              class="num whitespace-nowrap px-3 py-2 text-right text-gray-700 group-hover:bg-gray-50"
            >
              {{ formatNumber(row[col.key] as number | undefined, col.decimals) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
