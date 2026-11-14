<script setup lang="ts">
useHead({
  title: 'Airfolio',
})

const sidebar = useAdminSidebar()
</script>

<template>
  <main class="flex min-h-screen flex-col bg-gray-50 sm:flex-row">
    <AdminSidebar v-model="sidebar" />

    <div class="w-full min-w-0 flex-grow">
      <AdminHeader @menu:click="sidebar = true" />

      <!-- main content -->
      <div class="px-4 py-6 sm:px-6">
        <slot />
      </div>
    </div>
  </main>
</template>
