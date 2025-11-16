<template>
  <div class="flex flex-col min-h-screen">
    <LandingHeader :hide-hero="true" :hide-bg="true" />
    <div class="flex-1">
      <slot />
    </div>
    <LandingFooter />
  </div>
</template>

