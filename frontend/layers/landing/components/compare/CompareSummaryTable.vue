<script setup lang="ts">
import { computed } from 'vue'
import { useSortedRows } from '~/composables/useSortedRows'
import { toCSV, triggerDownload } from '~/composables/useAirfoilDownload'

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
const { sortColumn, sortDirection, sortedData, handleSort } = useSortedRows(
  () => props.summaryData, (row, col) => row[col as keyof SummaryRow], 'maxLD', 'desc')

/**
 * Format number for display
 */
const formatNumber = (value: number | undefined | null, decimals = 3): string => {
  if (value === undefined || value === null || !isFinite(value)) return 'N/A'
  return value.toFixed(decimals)
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

  const rows = sortedData.value.map(row => [
    row.name,
    ...columns.value.map(col => formatNumber(row[col.key] as number | undefined, col.decimals)),
  ])

  triggerDownload(toCSV([headers, ...rows]), 'airfoil_comparison_summary.csv', 'text/csv;charset=utf-8;')
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
