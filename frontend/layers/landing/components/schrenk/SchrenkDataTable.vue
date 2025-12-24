<script setup lang="ts">
import { ref } from 'vue'
import type { CombinedLoadPoint } from '~/types/schrenk.types'

interface Props {
  loadData: CombinedLoadPoint[]
}

defineProps<Props>()

const showTable = ref(false)

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

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n')

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', 'schrenk_loads.csv')
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    <button
      @click="showTable = !showTable"
      class="w-full px-5 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors text-left"
    >
      <div class="font-semibold text-slate-800">Detailed Load Table</div>
      <Icon
        :name="showTable ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
        class="h-5 w-5 text-slate-500"
      />
    </button>

    <div v-if="showTable" class="p-4 space-y-4">
      <!-- Download Button -->
      <button
        @click="exportToCSV(loadData)"
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
      >
        <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
        Download CSV
      </button>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-3 py-3 text-right font-medium text-slate-500 uppercase">Station (in)</th>
              <th colspan="2" class="px-3 py-3 text-center font-medium text-slate-500 uppercase bg-blue-50">Aero Shear/Moment</th>
              <th colspan="2" class="px-3 py-3 text-center font-medium text-slate-500 uppercase bg-red-50">Inertia Shear/Moment</th>
              <th colspan="2" class="px-3 py-3 text-center font-medium text-slate-900 uppercase bg-amber-50">Limit Total</th>
              <th colspan="2" class="px-3 py-3 text-center font-medium text-slate-900 uppercase bg-slate-100">Ultimate</th>
            </tr>
            <tr>
              <th class="px-3 py-3 text-right font-medium text-slate-500 uppercase"></th>
              <th class="px-3 py-3 text-right font-medium text-slate-500 uppercase text-xs bg-blue-50">Shear (lb)</th>
              <th class="px-3 py-3 text-right font-medium text-slate-500 uppercase text-xs bg-blue-50">Moment (lb-in)</th>
              <th class="px-3 py-3 text-right font-medium text-slate-500 uppercase text-xs bg-red-50">Shear (lb)</th>
              <th class="px-3 py-3 text-right font-medium text-slate-500 uppercase text-xs bg-red-50">Moment (lb-in)</th>
              <th class="px-3 py-3 text-right font-medium text-slate-900 uppercase text-xs bg-amber-50">Shear (lb)</th>
              <th class="px-3 py-3 text-right font-medium text-slate-900 uppercase text-xs bg-amber-50">Moment (lb-in)</th>
              <th class="px-3 py-3 text-right font-medium text-slate-900 uppercase text-xs bg-slate-100">Shear (lb)</th>
              <th class="px-3 py-3 text-right font-medium text-slate-900 uppercase text-xs bg-slate-100">Moment (lb-in)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 bg-white">
            <tr
              v-for="(row, i) in loadData"
              :key="i"
              class="hover:bg-slate-50"
            >
              <td class="px-3 py-2 text-right font-mono text-slate-600">{{ fmt(row.station_in, 1) }}</td>
              <td class="px-3 py-2 text-right font-mono text-blue-600 bg-blue-50/30">{{ fmt(row.aero_shear_lb, 0) }}</td>
              <td class="px-3 py-2 text-right font-mono text-blue-600 bg-blue-50/30">{{ fmt(row.aero_moment_lb_in, 0) }}</td>
              <td class="px-3 py-2 text-right font-mono text-red-600 bg-red-50/30">{{ fmt(row.inertia_shear_lb, 0) }}</td>
              <td class="px-3 py-2 text-right font-mono text-red-600 bg-red-50/30">{{ fmt(row.inertia_moment_lb_in, 0) }}</td>
              <td class="px-3 py-2 text-right font-mono text-amber-900 font-semibold bg-amber-50">{{ fmt(row.total_limit_shear_lb, 0) }}</td>
              <td class="px-3 py-2 text-right font-mono text-amber-900 font-semibold bg-amber-50">{{ fmt(row.total_limit_moment_lb_in, 0) }}</td>
              <td class="px-3 py-2 text-right font-mono font-bold text-slate-900 bg-slate-100">{{ fmt(row.ult_shear_lb, 0) }}</td>
              <td class="px-3 py-2 text-right font-mono font-bold text-slate-900 bg-slate-100">{{ fmt(row.ult_moment_lb_in, 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

