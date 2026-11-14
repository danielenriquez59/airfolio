<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

interface Props {
  airfoils: Airfoil[]
}

const props = defineProps<Props>()

// Sort state - default to sorting by name
const sortColumn = ref<string | null>('name')
const sortDirection = ref<'asc' | 'desc'>('asc')

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

/**
 * Check if a value is valid (not N/A)
 */
const isValidValue = (value: any): boolean => {
  return value !== undefined && value !== null && isFinite(value)
}

/**
 * Get sortable value for a column
 */
const getSortValue = (airfoil: Airfoil, column: string): any => {
  switch (column) {
    case 'name':
      return airfoil.name
    case 'thickness':
      return airfoil.thickness_pct
    case 'thicknessLoc':
      return airfoil.thickness_loc_pct
    case 'camber':
      return airfoil.camber_pct
    case 'camberLoc':
      return airfoil.camber_loc_pct
    case 'area':
      return airfoil.area_coefficient
    case 'leRadius':
      return airfoil.le_radius
    case 'teAngle':
      return airfoil.te_angle
    case 'teThickness':
      return airfoil.te_thickness
    case 'upperNodes':
      return airfoil.upper_surface_nodes
    case 'lowerNodes':
      return airfoil.lower_surface_nodes
    default:
      return null
  }
}

/**
 * Computed sorted data
 */
const sortedData = computed(() => {
  if (!sortColumn.value) {
    return props.airfoils
  }

  const sorted = [...props.airfoils].sort((a, b) => {
    const valA = getSortValue(a, sortColumn.value!)
    const valB = getSortValue(b, sortColumn.value!)

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

  const rows = sortedData.value.map((airfoil) => [
    airfoil.name,
    formatPercent(airfoil.thickness_pct),
    formatPercent(airfoil.thickness_loc_pct),
    formatPercent(airfoil.camber_pct),
    formatPercent(airfoil.camber_loc_pct),
    formatPercent(airfoil.area_coefficient),
    formatNumber(airfoil.le_radius, 4),
    formatNumber(airfoil.te_angle, 2),
    formatNumber(airfoil.te_thickness, 4),
    airfoil.upper_surface_nodes?.toString() ?? 'N/A',
    airfoil.lower_surface_nodes?.toString() ?? 'N/A',
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
  link.setAttribute('download', 'geometry_comparison_summary.csv')
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Column definitions for cleaner template
const columns: Array<{ key: string, label: string, sticky?: boolean }> = [
  { key: 'name', label: 'Airfoil Name', sticky: true },
  { key: 'thickness', label: 'Thickness (%)' },
  { key: 'thicknessLoc', label: 'Thickness Loc (%)' },
  { key: 'camber', label: 'Camber (%)' },
  { key: 'camberLoc', label: 'Camber Loc (%)' },
  { key: 'area', label: 'Area (% c²)' },
  { key: 'leRadius', label: 'LE Radius' },
  { key: 'teAngle', label: 'TE Angle (deg)' },
  { key: 'teThickness', label: 'TE Thickness' },
  { key: 'upperNodes', label: 'Upper Nodes' },
  { key: 'lowerNodes', label: 'Lower Nodes' },
]

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
            <td :class="cellClass">
              {{ formatPercent(airfoil.thickness_pct) }}
            </td>
            <td :class="cellClass">
              {{ formatPercent(airfoil.thickness_loc_pct) }}
            </td>
            <td :class="cellClass">
              {{ formatPercent(airfoil.camber_pct) }}
            </td>
            <td :class="cellClass">
              {{ formatPercent(airfoil.camber_loc_pct) }}
            </td>
            <td :class="cellClass">
              {{ formatPercent(airfoil.area_coefficient) }}
            </td>
            <td :class="cellClass">
              {{ formatNumber(airfoil.le_radius, 4) }}
            </td>
            <td :class="cellClass">
              {{ formatNumber(airfoil.te_angle, 2) }}
            </td>
            <td :class="cellClass">
              {{ formatNumber(airfoil.te_thickness, 4) }}
            </td>
            <td :class="cellClass">
              {{ airfoil.upper_surface_nodes ?? 'N/A' }}
            </td>
            <td :class="cellClass">
              {{ airfoil.lower_surface_nodes ?? 'N/A' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
