<script setup lang="ts">
interface Props {
  onExportParameters?: () => void
  onExportSelig?: () => void
  onExportLednicer?: () => void
}

defineProps<Props>()
</script>

<template>
  <div class="overflow-hidden">
    <div class="p-4">
      <div class="space-y-2">
        <button
          v-if="onExportParameters"
          type="button"
          class="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2 text-sm"
          @click="onExportParameters"
        >
          <Icon name="heroicons:arrow-down-tray-20-solid" class="w-4 h-4" />
          Export NACA Parameters (CSV)
        </button>
        <button
          v-if="onExportSelig"
          type="button"
          class="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2 text-sm"
          @click="onExportSelig"
        >
          <Icon name="heroicons:arrow-down-tray-20-solid" class="w-4 h-4" />
          Export Selig Format (.dat)
        </button>
        <button
          v-if="onExportLednicer"
          type="button"
          class="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-md transition-colors flex items-center justify-center gap-2 text-sm"
          @click="onExportLednicer"
        >
          <Icon name="heroicons:arrow-down-tray-20-solid" class="w-4 h-4" />
          Export Lednicer Format (.dat)
        </button>
      </div>
    </div>
  </div>
</template>

