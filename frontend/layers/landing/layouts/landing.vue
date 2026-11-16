<template>
  <div class="isolate flex min-h-screen flex-col bg-gray-50">
    <LandingHeader />
    <!-- Full-bleed: pages render their own sections and use .page-container inside them -->
    <main id="main" class="flex-1">
      <slot />
    </main>
    <LandingFooter />
  </div>
</template>
