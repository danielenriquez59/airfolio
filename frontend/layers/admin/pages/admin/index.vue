<script lang="ts" setup>
definePageMeta({
  layout: 'admin',
  middleware: 'auth',
})

const stats = ref([
  {
    text: 'Users',
    count: '100',
    icon: 'ri:user-line',
    color: 'bg-primary-50 text-primary-600',
  },
  {
    text: 'Posts',
    count: '20',
    icon: 'ri:book-2-line',
    color: 'bg-primary-50 text-primary-600',
  },
  {
    text: 'Comments',
    count: '500',
    icon: 'ri:message-line',
    color: 'bg-primary-50 text-primary-600',
  },
  {
    text: 'Views',
    count: '12000',
    icon: 'ri:line-chart-line',
    color: 'bg-primary-50 text-primary-600',
  },
])
</script>

<template>
  <div>
    <PageHeader title="Dashboard" subtitle="Overview & summary" />

    <!-- stats -->
    <div class="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <AdminMetricItem
        v-for="stat in stats"
        :key="stat.text"
        v-bind="stat"
      />
    </div>

    <!-- panel -->
    <VPanel title="Hello">
      <p class="text-sm text-gray-600">
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Expedita sit esse
      voluptatem et deserunt earum explicabo aut quis laboriosam nostrum
      quisquam sequi maxime est vitae, vero reiciendis veniam repudiandae fugit!
      </p>
    </VPanel>
  </div>
</template>
