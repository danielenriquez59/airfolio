<script setup lang="ts">
interface Props {
  /** Show thumbnail variant */
  thumbnail?: boolean
}

withDefaults(defineProps<Props>(), {
  thumbnail: false,
})

// Match the aspect ratio from AirfoilCard
const aspectRatio = 3.5
</script>

<template>
  <VCard class="pt-3">
    <template #header>
      <div class="px-2 md:px-4">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            <!-- Title skeleton -->
            <div class="h-6 bg-gray-200 rounded animate-pulse mb-2 w-3/4"></div>
            <!-- Description skeleton (optional) -->
            <div class="h-4 bg-gray-200 rounded animate-pulse w-full mt-2"></div>
            <div class="h-4 bg-gray-200 rounded animate-pulse w-2/3 mt-1"></div>
          </div>
          <!-- Badge skeleton -->
          <div class="ml-2">
            <div class="h-6 w-16 bg-gray-300 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </template>

    <VCardBody class="px-2 md:px-4">
      <div class="space-y-4">
        <!-- Metadata Grid -->
        <div class="grid grid-cols-2 gap-4 text-sm">
          <!-- Thickness -->
          <div>
            <div class="h-4 bg-gray-200 rounded animate-pulse mb-1 w-16"></div>
            <div class="h-5 bg-gray-300 rounded animate-pulse w-20"></div>
          </div>

          <!-- Camber -->
          <div>
            <div class="h-4 bg-gray-200 rounded animate-pulse mb-1 w-16"></div>
            <div class="h-5 bg-gray-300 rounded animate-pulse w-20"></div>
          </div>

          <!-- LE Radius -->
          <div>
            <div class="h-4 bg-gray-200 rounded animate-pulse mb-1 w-20"></div>
            <div class="h-5 bg-gray-300 rounded animate-pulse w-12"></div>
          </div>

          <!-- TE Thickness -->
          <div>
            <div class="h-4 bg-gray-200 rounded animate-pulse mb-1 w-24"></div>
            <div class="h-5 bg-gray-300 rounded animate-pulse w-12"></div>
          </div>
        </div>

        <!-- Geometry Visualization -->
        <div class="mt-4 -mx-2 md:mx-0">
          <div
            class="bg-gray-200 rounded animate-pulse"
            :style="{ aspectRatio: `${aspectRatio} / 1`, width: '100%' }"
          ></div>
        </div>
      </div>
    </VCardBody>
  </VCard>
</template>
