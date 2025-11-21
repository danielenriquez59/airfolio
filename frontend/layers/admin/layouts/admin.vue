<script setup lang="ts">
useHead({
  title: 'Airfolio',
})

const sidebar = useAdminSidebar()
</script>

<template>
  <main class="flex flex-col sm:flex-row">
    <AdminSidebar v-model="sidebar" />

    <div class="w-full flex-grow">
      <AdminHeader @menu:click="sidebar = true" />

      <!-- main content -->
      <div class="px-6 py-6">
        <slot />
      </div>
    </div>
  </main>
</template>
