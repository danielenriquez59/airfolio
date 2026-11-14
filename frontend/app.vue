<script setup lang="ts">
const appName = 'Airfolio'

useHead({
  titleTemplate: (titleChunk) => {
    if (!titleChunk) return appName
    // many pages already name the app in their own title; don't add it twice
    return titleChunk.includes(appName) ? titleChunk : `${titleChunk} - ${appName}`
  },
  meta: [
    {
      hid: 'description',
      name: 'description',
      content: 'Airfoil search and analysis tool',
    },
  ],
})
</script>

<template>
  <Html lang="en" />
  <NuxtLoadingIndicator />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
