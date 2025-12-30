<template>
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    :width="size" 
    :height="size" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2" 
    stroke-linecap="round" 
    stroke-linejoin="round"
    :class="colorClass"
  >
    <!-- Body -->
    <rect x="8" y="9" width="8" height="10" rx="3" />
    <!-- Head -->
    <path d="M10 9V7a2 2 0 0 1 4 0v2" />
    <!-- Legs -->
    <path d="M8 11H5" />
    <path d="M19 11h-3" />
    <path d="M8 14H5" />
    <path d="M19 14h-3" />
    <path d="M8 17H5" />
    <path d="M19 17h-3" />
    <!-- Antennae -->
    <path d="M10 5L9 3" />
    <path d="M14 5l1-2" />
  </svg>
</template>

<script setup lang="ts">
interface Props {
  size?: string | number
  colorClass?: string
}

withDefaults(defineProps<Props>(), {
  size: 20,
  colorClass: 'text-gray-600'
})
</script>


