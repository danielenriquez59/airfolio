<template>
  <div class="flex flex-col min-h-screen bg-gray-50">
    <LandingHeader :hide-hero="true" :hide-bg="true" />
    <LandingSearchBar />
    <div class="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </div>
    <LandingFooter />
  </div>
</template>

