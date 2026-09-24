<script setup lang="ts">
interface Props {
  onExportParameters?: () => void
  onExportSelig?: () => void
  onExportLednicer?: () => void
}

defineProps<Props>()
</script>

<template>
  <div class="space-y-2 lg:w-72 shrink-0">
    <VButton
      v-if="onExportParameters"
      color="dark"
      block
      size="sm"
      @click="onExportParameters"
    >
      <Icon name="heroicons:arrow-down-tray-20-solid" class="w-4 h-4 shrink-0" />
      <span class="whitespace-nowrap">Export NACA Parameters (CSV)</span>
    </VButton>
    <VButton
      v-if="onExportSelig"
      color="dark"
      block
      size="sm"
      @click="onExportSelig"
    >
      <Icon name="heroicons:arrow-down-tray-20-solid" class="w-4 h-4 shrink-0" />
      <span class="whitespace-nowrap">Export Selig Format (.dat)</span>
    </VButton>
    <VButton
      v-if="onExportLednicer"
      color="dark"
      block
      size="sm"
      @click="onExportLednicer"
    >
      <Icon name="heroicons:arrow-down-tray-20-solid" class="w-4 h-4 shrink-0" />
      <span class="whitespace-nowrap">Export Lednicer Format (.dat)</span>
    </VButton>
  </div>
</template>
