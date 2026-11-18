<script setup lang="ts">
import type { CombinedLoadPoint } from '~/types/schrenk.types'
import { toCSV, triggerDownload } from '~/composables/useAirfoilDownload'

interface Props {
  loadData: CombinedLoadPoint[]
}

defineProps<Props>()

const groups = ['Aero', 'Inertia', 'Limit total', 'Ultimate']

const fmt = (n: number, d = 1) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })

const exportToCSV = (loadData: CombinedLoadPoint[]) => {
  const headers = [
    'Station (in)',
    'Aero Shear (lb)',
    'Aero Moment (lb-in)',
    'Inertia Shear (lb)',
    'Inertia Moment (lb-in)',
    'Total Limit Shear (lb)',
    'Total Limit Moment (lb-in)',
    'Ultimate Shear (lb)',
    'Ultimate Moment (lb-in)',
  ]

  const rows = loadData.map(row => [
    row.station_in.toFixed(1),
    row.aero_shear_lb.toFixed(0),
    row.aero_moment_lb_in.toFixed(0),
    row.inertia_shear_lb.toFixed(0),
    row.inertia_moment_lb_in.toFixed(0),
    row.total_limit_shear_lb.toFixed(0),
    row.total_limit_moment_lb_in.toFixed(0),
    row.ult_shear_lb.toFixed(0),
    row.ult_moment_lb_in.toFixed(0),
  ])

  triggerDownload(toCSV([headers, ...rows]), 'schrenk_loads.csv', 'text/csv;charset=utf-8;')
}
</script>

<template>
  <VPanel title="Load table" description="Shear and bending moment at each spanwise station" flush>
    <template #actions>
      <VButton type="button" color="light" size="sm" @click="exportToCSV(loadData)">
        <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" aria-hidden="true" />
        Download CSV
      </VButton>
    </template>

    <div class="max-h-[28rem] overflow-auto">
      <table class="min-w-full text-sm">
        <thead class="sticky top-0 z-10 bg-gray-50">
          <tr class="border-b border-gray-200">
            <th scope="col" rowspan="2" class="data-label px-3 py-2 text-right align-bottom">
              Station (in)
            </th>
            <th
              v-for="group in groups"
              :key="group"
              scope="colgroup"
              colspan="2"
              class="data-label border-l border-gray-200 px-3 pb-1 pt-2 text-center"
            >
              {{ group }}
            </th>
          </tr>
          <tr class="border-b border-gray-200">
            <template v-for="group in groups" :key="group">
              <th scope="col" class="border-l border-gray-200 px-3 pb-2 pt-1 text-right text-xs font-medium text-gray-500">
                Shear (lb)
              </th>
              <th scope="col" class="px-3 pb-2 pt-1 text-right text-xs font-medium text-gray-500">
                Moment (lb-in)
              </th>
            </template>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          <tr v-for="(row, i) in loadData" :key="i" class="hover:bg-gray-50">
            <td class="num px-3 py-1.5 text-right text-gray-600">
              {{ fmt(row.station_in, 1) }}
            </td>
            <td class="num border-l border-gray-100 px-3 py-1.5 text-right text-gray-700">
              {{ fmt(row.aero_shear_lb, 0) }}
            </td>
            <td class="num px-3 py-1.5 text-right text-gray-700">
              {{ fmt(row.aero_moment_lb_in, 0) }}
            </td>
            <td class="num border-l border-gray-100 px-3 py-1.5 text-right text-gray-700">
              {{ fmt(row.inertia_shear_lb, 0) }}
            </td>
            <td class="num px-3 py-1.5 text-right text-gray-700">
              {{ fmt(row.inertia_moment_lb_in, 0) }}
            </td>
            <td class="num border-l border-gray-100 px-3 py-1.5 text-right text-gray-900">
              {{ fmt(row.total_limit_shear_lb, 0) }}
            </td>
            <td class="num px-3 py-1.5 text-right text-gray-900">
              {{ fmt(row.total_limit_moment_lb_in, 0) }}
            </td>
            <td class="num border-l border-gray-100 bg-gray-50/60 px-3 py-1.5 text-right font-semibold text-gray-900">
              {{ fmt(row.ult_shear_lb, 0) }}
            </td>
            <td class="num bg-gray-50/60 px-3 py-1.5 text-right font-semibold text-gray-900">
              {{ fmt(row.ult_moment_lb_in, 0) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </VPanel>
</template>
