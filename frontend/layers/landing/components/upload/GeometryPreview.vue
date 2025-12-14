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
    le_radius?: number
    te_thickness?: number
    te_angle?: number
    upper_surface_nodes: number
    lower_surface_nodes: number
  }
}

defineProps<Props>()

const formatNumber = (value: number | undefined): string => {
  if (value === undefined || value === null) return 'N/A'
  return value.toFixed(4)
}

const formatPercent = (value: number | undefined): string => {
  if (value === undefined || value === null) return 'N/A'
  return `${(value * 100).toFixed(2)}%`
}
</script>

<template>
  <div class="space-y-6">
    <!-- Geometry Visualization -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Airfoil Shape</h3>
      <AirfoilGeometry
        :upper-x="upperX"
        :upper-y="upperY"
        :lower-x="lowerX"
        :lower-y="lowerY"
        :name="name"
        :aspect-ratio="4"
        :show-grid="true"
      />
    </div>

    <!-- Properties Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Thickness -->
      <div class="bg-white rounded-lg shadow p-4">
        <h4 class="text-sm font-semibold text-gray-900 mb-3">Thickness</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">Max Thickness:</span>
            <span class="font-medium text-gray-900">{{ formatPercent(properties.thickness_pct) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Location:</span>
            <span class="font-medium text-gray-900">{{ formatPercent(properties.thickness_loc_pct) }}</span>
          </div>
        </div>
      </div>

      <!-- Camber -->
      <div class="bg-white rounded-lg shadow p-4">
        <h4 class="text-sm font-semibold text-gray-900 mb-3">Camber</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">Max Camber:</span>
            <span class="font-medium text-gray-900">{{ formatPercent(properties.camber_pct) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Location:</span>
            <span class="font-medium text-gray-900">{{ formatPercent(properties.camber_loc_pct) }}</span>
          </div>
        </div>
      </div>

      <!-- Leading Edge -->
      <div class="bg-white rounded-lg shadow p-4">
        <h4 class="text-sm font-semibold text-gray-900 mb-3">Leading Edge</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">Radius:</span>
            <span class="font-medium text-gray-900">{{ formatNumber(properties.le_radius) }}</span>
          </div>
        </div>
      </div>

      <!-- Trailing Edge -->
      <div class="bg-white rounded-lg shadow p-4">
        <h4 class="text-sm font-semibold text-gray-900 mb-3">Trailing Edge</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">Thickness:</span>
            <span class="font-medium text-gray-900">{{ formatNumber(properties.te_thickness) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Angle:</span>
            <span class="font-medium text-gray-900">{{ properties.te_angle?.toFixed(2) }}°</span>
          </div>
        </div>
      </div>

      <!-- Point Counts -->
      <div class="bg-white rounded-lg shadow p-4 md:col-span-2">
        <h4 class="text-sm font-semibold text-gray-900 mb-3">Coordinate Points</h4>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">Upper Surface Points:</span>
            <span class="font-medium text-gray-900">{{ properties.upper_surface_nodes }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Lower Surface Points:</span>
            <span class="font-medium text-gray-900">{{ properties.lower_surface_nodes }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

