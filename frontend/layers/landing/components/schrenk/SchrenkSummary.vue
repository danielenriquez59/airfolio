<script setup lang="ts">
import type { CalculationResult } from '~/types/schrenk.types'

interface Props {
  summary: CalculationResult['summary']
}

defineProps<Props>()

const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
</script>

<template>
  <div class="bg-blue-900 text-white rounded-xl shadow-lg p-5">
    <h3 class="text-sm font-semibold text-blue-200 uppercase tracking-wider mb-4">Calculated Values</h3>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <div class="text-xs text-blue-300">Wing Lift</div>
        <div class="text-xl font-bold">
          {{ fmt(summary.lift_lb, 0) }} <span class="text-xs font-normal opacity-70">lb</span>
        </div>
      </div>
      <div>
        <div class="text-xs text-blue-300">qCL (L/S)</div>
        <div class="text-xl font-bold">
          {{ fmt(summary.qCL) }} <span class="text-xs font-normal opacity-70">psf</span>
        </div>
      </div>
      <div>
        <div class="text-xs text-blue-300">Root Chord</div>
        <div class="text-lg font-semibold">
          {{ fmt(summary.root_chord) }} <span class="text-xs font-normal opacity-70">ft</span>
        </div>
      </div>
      <div>
        <div class="text-xs text-blue-300">Tip Chord</div>
        <div class="text-lg font-semibold">
          {{ fmt(summary.tip_chord) }} <span class="text-xs font-normal opacity-70">ft</span>
        </div>
      </div>
    </div>
    <div class="mt-4 pt-4 border-t border-blue-800">
      <div class="text-xs text-blue-300 mb-1">Loads at Root (Ult)</div>
      <div class="flex justify-between items-end mb-1">
        <span class="text-sm">Shear:</span>
        <span class="font-bold">{{ fmt(summary.max_shear_root, 0) }} lb</span>
      </div>
      <div class="flex justify-between items-end">
        <span class="text-sm">Moment:</span>
        <span class="font-bold">{{ fmt(summary.max_moment_root, 0) }} lb-in</span>
      </div>
    </div>
  </div>
</template>

