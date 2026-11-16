<template>
  <div class="isolate flex min-h-screen flex-col bg-gray-50">
    <LandingHeader :hide-hero="true" :hide-bg="true" />
    <main id="main" class="page-container flex-1 py-8">
      <slot />
    </main>
    <LandingFooter />
  </div>
</template>
