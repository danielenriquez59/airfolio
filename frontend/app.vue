<script setup lang="ts">
const appName = 'Airfolio'
const route = useRoute()
// site.url + trailingSlash from nuxt.config; pages can override (airfoil pages do)
const pageUrl = withSiteUrl(computed(() => route.path))

useHead({
  link: [{ rel: 'canonical', href: pageUrl }],
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
    { property: 'og:url', content: pageUrl },
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
