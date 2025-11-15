<template>
  <div class="relative inline-flex items-center">
    <!-- Paper plane icon positioned behind the text -->
    <img
      src="/paper-plane.svg"
      alt="Paper plane"
      class="absolute z-0 opacity-60 transform -translate-x-1/2 -translate-y-1/4"
      :class="iconClass"
    />
    <!-- Airfolio text -->
    <span class="relative z-10 font-bold tracking-tight text-gray-900" :class="textClass">
      Airfolio
    </span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const sizeClasses = {
  sm: {
    text: 'text-xl sm:text-2xl',
    icon: 'w-4 h-4 -left-1 -top-1',
  },
  md: {
    text: 'text-2xl sm:text-3xl',
    icon: 'w-4 h-4 -left-1.5 -top-1.5',
  },
  lg: {
    text: 'text-3xl sm:text-4xl',
    icon: 'w-9 h-9 -left-2.5 -top-2.5',
  },
  xl: {
    text: 'text-4xl sm:text-6xl',
    icon: 'w-10 h-10 -left-3 -top-3',
  },
}

const textClass = computed(() => sizeClasses[props.size].text)
const iconClass = computed(() => sizeClasses[props.size].icon)
</script>

