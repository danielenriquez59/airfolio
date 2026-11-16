<script setup lang="ts">
import type { AircraftUsage } from '~/utils/aircraftUsage'

const props = defineProps<{
  aircraft: AircraftUsage[]
}>()

// Collapsed by default; the body uses v-show so the pre-rendered HTML still holds the names.
// The panel is flush (padding lives on the body), so a collapsed card has no empty padding or header border.
const open = ref(false)
const anyModified = computed(() => props.aircraft.some(a => a.modified))
</script>

<template>
  <VPanel v-if="aircraft.length > 0" flush :class="{ '[&>div:first-child]:border-b-0': !open }">
    <template #title>
      <Icon name="lucide:plane" class="mr-1.5 inline-block h-5 w-5 align-text-bottom text-gray-500" aria-hidden="true" />
      Aircraft using this airfoil <span class="num text-xs font-normal text-gray-500">({{ aircraft.length }})</span>
    </template>
    <template #actions>
      <button
        type="button"
        class="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        :aria-expanded="open"
        aria-controls="airfoil-aircraft"
        @click="open = !open"
      >
        <Icon
          name="heroicons:chevron-right"
          class="h-4 w-4 transition-transform"
          :class="{ 'rotate-90': open }"
          aria-hidden="true"
        />
        {{ open ? 'Hide aircraft' : 'Show aircraft' }}
      </button>
    </template>
    <div v-show="open" id="airfoil-aircraft" class="p-4 sm:p-5">
      <ul class="grid max-h-[340px] grid-cols-1 content-start gap-x-6 overflow-y-auto overflow-x-hidden pr-3 text-sm [scrollbar-color:theme(colors.gray.300)_transparent] [scrollbar-width:thin] sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="a in aircraft" :key="a.key" class="flex min-w-0 flex-wrap content-start items-baseline gap-x-2 break-words py-0.5">
          <span class="font-medium text-gray-900">{{ a.name }}{{ a.modified ? '*' : '' }}</span>
          <span class="text-gray-500">{{ a.placements }}</span>
          <span v-if="a.sources.length > 0" class="flex flex-wrap gap-x-2 text-xs">
            <a
              v-for="s in a.sources"
              :key="s.label"
              :href="s.url"
              target="_blank"
              rel="noopener noreferrer"
              class="rounded text-primary-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {{ s.label }}<span class="sr-only"> (opens in a new tab)</span>
            </a>
          </span>
        </li>
      </ul>
      <div class="mt-3 space-y-1 text-xs text-gray-500">
        <p v-if="anyModified">
          * Uses a modified version of this airfoil.
        </p>
        <p>Aircraft data from David Lednicer's Incomplete Guide to Airfoil Usage, Wikipedia and J2mcL.</p>
      </div>
    </div>
  </VPanel>
</template>
