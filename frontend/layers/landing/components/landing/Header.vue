<script setup lang="ts">
import type { NavigationItem } from '~~/types'

// hideBg is still accepted so existing layouts keep working; the background blob is gone.
defineProps<{
  hideHero?: boolean
  hideBg?: boolean
}>()

const navigation: NavigationItem[] = [
  { title: 'Home', to: '/' },
  { title: 'Airfoils', to: '/search' },
  {
    title: 'Tools',
    to: '#',
    children: [
      { header: 'Compare' },
      { title: 'Performance Compare', to: '/performance' },
      { title: 'Geometry Compare', to: '/geometry-compare' },
      { divider: true },
      { header: 'Generate' },
      { title: 'Upload', to: '/upload' },
      { title: 'CST Generator', to: '/cst-visualizer' },
      { title: 'NACA Generator', to: '/tools/naca-generator' },
      { title: 'Bezier Fit', to: '/tools/bezier-fit' },
      { divider: true },
      { header: 'Structures' },
      { title: 'Structural Loading Calculator', to: '/tools/schrenk-calculator' },
      { title: 'Spar Inertia Calculator', to: '/tools/spar-inertia-calculator' },
    ],
  },
  { title: 'About', to: '/about' },
]
</script>

<template>
  <a
    href="#main"
    class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-700 focus:ring-2 focus:ring-primary-500"
  >
    Skip to content
  </a>
  <header class="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
    <LandingNav :navigation="navigation" />
  </header>
  <LandingMobileNav :navigation="navigation" />
  <LandingHero v-if="!hideHero" />
</template>
