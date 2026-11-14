<script lang="ts" setup>
//
</script>

<template>
  <div class="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4 py-12">
    <div class="w-full max-w-sm">
      <NuxtLink to="/" class="mb-6 flex justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Airfolio home">
        <Logo />
      </NuxtLink>
      <div class="rounded-xl border border-gray-200 bg-white">
        <slot />
      </div>
    </div>
  </div>
</template>
