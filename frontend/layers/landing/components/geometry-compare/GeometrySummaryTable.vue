<script setup lang="ts">
import { useSortedRows } from '~/composables/useSortedRows'
import { toCSV, triggerDownload } from '~/composables/useAirfoilDownload'
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

interface Props {
  airfoils: Airfoil[]
}

const props = defineProps<Props>()

/**
 * Format number for display
 */
const formatNumber = (value: number | null | undefined, decimals = 2): string => {
  if (value === null || value === undefined || !isFinite(value)) return 'N/A'
  return value.toFixed(decimals)
}

/**
 * Format percentage (stored as decimal 0-1, display as %)
 */
const formatPercent = (value: number | null | undefined, decimals = 2): string => {
  if (value === null || value === undefined || !isFinite(value)) return 'N/A'
  return (value * 100).toFixed(decimals)
}

// Column definitions: sort value and display text (cells and CSV)
const nodes = (v: number | null) => v?.toString() ?? 'N/A'
const columns: Array<{ key: string, label: string, sticky?: boolean, get: (a: Airfoil) => any, format: (v: any) => string }> = [
  { key: 'name', label: 'Airfoil Name', sticky: true, get: a => a.name, format: String },
  { key: 'thickness', label: 'Thickness (%)', get: a => a.thickness_pct, format: formatPercent },
  { key: 'thicknessLoc', label: 'Thickness Loc (%)', get: a => a.thickness_loc_pct, format: formatPercent },
  { key: 'camber', label: 'Camber (%)', get: a => a.camber_pct, format: formatPercent },
  { key: 'camberLoc', label: 'Camber Loc (%)', get: a => a.camber_loc_pct, format: formatPercent },
  { key: 'area', label: 'Area (% c²)', get: a => a.area_coefficient, format: formatPercent },
  { key: 'leRadius', label: 'LE Radius', get: a => a.le_radius, format: v => formatNumber(v, 4) },
  { key: 'teAngle', label: 'TE Angle (deg)', get: a => a.te_angle, format: v => formatNumber(v, 2) },
  { key: 'teThickness', label: 'TE Thickness', get: a => a.te_thickness, format: v => formatNumber(v, 4) },
  { key: 'upperNodes', label: 'Upper Nodes', get: a => a.upper_surface_nodes, format: nodes },
  { key: 'lowerNodes', label: 'Lower Nodes', get: a => a.lower_surface_nodes, format: nodes },
]

// Sort state - default to sorting by name
const { sortColumn, sortDirection, sortedData, handleSort } = useSortedRows(
  () => props.airfoils, (a, key) => columns.find(c => c.key === key)?.get(a) ?? null, 'name', 'asc')

/**
 * Export summary table to CSV
 */
const exportToCSV = () => {
  const headers = [
    'Airfoil Name',
    'Thickness (%)',
    'Thickness Location (%)',
    'Camber (%)',
    'Camber Location (%)',
    'Area (% c²)',
    'LE Radius',
    'TE Angle (deg)',
    'TE Thickness',
    'Upper Surface Nodes',
    'Lower Surface Nodes',
  ]

  const rows = sortedData.value.map(airfoil => columns.map(col => col.format(col.get(airfoil))))

  triggerDownload(toCSV([headers, ...rows]), 'geometry_comparison_summary.csv', 'text/csv;charset=utf-8;')
}

/** Swatch colour matches the overlay plot, which colours airfoils by selection order */
const rowColor = (airfoil: Airfoil) => seriesColor(props.airfoils.indexOf(airfoil))

const cellClass = 'px-4 py-2.5 whitespace-nowrap text-right num text-sm text-gray-700'
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="flex items-center gap-1 text-sm text-gray-500">
        <Icon name="heroicons:information-circle" class="h-4 w-4" aria-hidden="true" />
        <span>Click headers to sort.</span>
      </p>
      <VButton
        type="button"
        color="light"
        size="sm"
        @click="exportToCSV"
      >
        <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" aria-hidden="true" />
        Export CSV
      </VButton>
    </div>

    <div class="max-h-[32rem] overflow-auto rounded-lg border border-gray-200">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="sticky top-0 z-20 bg-gray-50">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :aria-sort="sortColumn === col.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
              class="bg-gray-50 p-0"
              :class="{ 'sticky left-0 z-10': col.sticky }"
            >
              <button
                type="button"
                class="data-label flex w-full items-center gap-1 whitespace-nowrap px-4 py-2.5 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                :class="[
                  col.sticky ? 'justify-start text-left' : 'justify-end text-right',
                  sortColumn === col.key ? 'text-gray-900' : '',
                ]"
                @click="handleSort(col.key)"
              >
                <span>{{ col.label }}</span>
                <Icon
                  v-if="sortColumn === col.key"
                  :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                />
              </button>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white">
          <tr
            v-for="airfoil in sortedData"
            :key="airfoil.id"
            class="group hover:bg-gray-50"
          >
            <th scope="row" class="sticky left-0 z-10 bg-white px-4 py-2.5 text-left text-sm font-medium text-gray-900 whitespace-nowrap group-hover:bg-gray-50">
              <span class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: rowColor(airfoil) }" aria-hidden="true" />
                {{ airfoil.name }}
              </span>
            </th>
            <td v-for="col in columns.slice(1)" :key="col.key" :class="cellClass">
              {{ col.format(col.get(airfoil)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
