<script setup lang="ts">
import type { CalculationResult } from '~/types/schrenk.types'

interface Props {
  summary: CalculationResult['summary']
}

defineProps<Props>()

const fmt = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })
</script>

<template>
  <VPanel title="Calculated values">
    <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <VStat label="Wing lift" :value="fmt(summary.lift_lb, 0)" unit="lb" />
      <VStat label="qCL (L/S)" :value="fmt(summary.qCL)" unit="psf" />
      <VStat label="Root chord" :value="fmt(summary.root_chord)" unit="ft" />
      <VStat label="Tip chord" :value="fmt(summary.tip_chord)" unit="ft" />
    </dl>
    <h3 class="mt-5 border-t border-gray-200 pt-4 text-sm font-semibold text-gray-900">
      Loads at root
    </h3>
    <dl class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <VStat label="Limit shear" :value="fmt(summary.limit_shear_root, 0)" unit="lb" />
      <VStat label="Limit moment" :value="fmt(summary.limit_moment_root, 0)" unit="lb-in" />
      <VStat label="Ultimate shear" :value="fmt(summary.max_shear_root, 0)" unit="lb" />
      <VStat label="Ultimate moment" :value="fmt(summary.max_moment_root, 0)" unit="lb-in" />
    </dl>
  </VPanel>
</template>
