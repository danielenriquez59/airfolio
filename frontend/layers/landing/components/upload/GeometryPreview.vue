<script setup lang="ts">
interface Props {
  name: string
  upperX: number[]
  upperY: number[]
  lowerX: number[]
  lowerY: number[]
  properties: {
    thickness_pct?: number
    thickness_loc_pct?: number
    camber_pct?: number
    camber_loc_pct?: number
    area_coefficient?: number
    le_radius?: number
    te_thickness?: number
    te_angle?: number
    upper_surface_nodes: number
    lower_surface_nodes: number
  }
}

defineProps<Props>()

function fixed(value: number | undefined, digits: number): string | null {
  if (value === undefined || value === null || !Number.isFinite(value))
    return null
  return value.toFixed(digits)
}

function pct(value: number | undefined): string | null {
  return typeof value === 'number' ? fixed(value * 100, 2) : null
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-3">
    <VPanel title="Airfoil shape" class="lg:col-span-2">
      <AirfoilGeometry
        :upper-x="upperX"
        :upper-y="upperY"
        :lower-x="lowerX"
        :lower-y="lowerY"
        :name="name"
        :aspect-ratio="4"
        :show-grid="true"
        :show-points-on-hover="true"
      />
    </VPanel>

    <VPanel title="Summary">
      <!-- Page-provided details (name, description, source, category) -->
      <slot />

      <dl class="grid grid-cols-2 gap-x-4 gap-y-5" :class="{ 'mt-5 border-t border-gray-200 pt-5': $slots.default }">
        <VStat label="Max thickness" :value="pct(properties.thickness_pct)" unit="%" :hint="pct(properties.thickness_loc_pct) ? `at ${pct(properties.thickness_loc_pct)}% c` : undefined" />
        <VStat label="Max camber" :value="pct(properties.camber_pct)" unit="%" :hint="pct(properties.camber_loc_pct) ? `at ${pct(properties.camber_loc_pct)}% c` : undefined" />
        <VStat label="LE radius" :value="fixed(properties.le_radius, 4)" />
        <VStat label="TE thickness" :value="fixed(properties.te_thickness, 4)" />
        <VStat label="TE angle" :value="fixed(properties.te_angle, 2)" unit="°" />
        <VStat label="Area A/c²" :value="pct(properties.area_coefficient)" unit="% c²" />
        <VStat label="Upper points" :value="properties.upper_surface_nodes" />
        <VStat label="Lower points" :value="properties.lower_surface_nodes" />
      </dl>

      <div v-if="$slots.actions" class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <slot name="actions" />
      </div>
    </VPanel>
  </div>
</template>
