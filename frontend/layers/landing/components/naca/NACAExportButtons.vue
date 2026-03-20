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
        <VButton
          v-if="onExportParameters"
          color="dark"
          block
          size="sm"
          @click="onExportParameters"
        >
          <Icon name="heroicons:arrow-down-tray-20-solid" class="w-4 h-4" />
          Export NACA Parameters (CSV)
        </VButton>
        <VButton
          v-if="onExportSelig"
          color="dark"
          block
          size="sm"
          @click="onExportSelig"
        >
          <Icon name="heroicons:arrow-down-tray-20-solid" class="w-4 h-4" />
          Export Selig Format (.dat)
        </VButton>
        <VButton
          v-if="onExportLednicer"
          color="dark"
          block
          size="sm"
          @click="onExportLednicer"
        >
          <Icon name="heroicons:arrow-down-tray-20-solid" class="w-4 h-4" />
          Export Lednicer Format (.dat)
        </VButton>
      </div>
    </div>
  </div>
</template>
