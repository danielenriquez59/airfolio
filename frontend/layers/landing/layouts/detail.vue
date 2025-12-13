<template>
  <div class="flex flex-col min-h-screen bg-white">
    <LandingHeader :hide-hero="true" :hide-bg="true" />
    <div class="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </div>
    <LandingFooter />
  </div>
</template>

