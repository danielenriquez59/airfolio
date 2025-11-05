<script setup lang="ts">
const searchQuery = ref('')

const handleSearch = () => {
  // TODO: Implement search functionality
  // Navigate to browse page with search query
  if (searchQuery.value.trim()) {
    navigateTo(`/browse?search=${encodeURIComponent(searchQuery.value)}`)
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    handleSearch()
  }
}
</script>

<template>
  <div>
    <div class="relative px-6 lg:px-8">
      <div class="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
        <div class="text-center">
          <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Airfolio
          </h1>
          
          <div class="mt-10 flex items-center justify-center">
            <div class="w-full max-w-lg">
              <VInput
                v-model="searchQuery"
                placeholder="Search for an airfoil..."
                size="lg"
                prepend-icon="heroicons:magnifying-glass"
                wrapper-class="w-full"
                @keydown="handleKeydown"
              >
                <template #append>
                  <button
                    type="button"
                    class="rounded-full bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center justify-center"
                    @click="handleSearch"
                  >
                    <Icon name="heroicons:magnifying-glass" class="h-5 w-5" />
                  </button>
                </template>
              </VInput>
            </div>
          </div>
        </div>
      </div>
      <div class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]">
        <svg class="relative left-[calc(50%+3rem)] h-[21.1875rem] max-w-none -translate-x-1/2 sm:left-[calc(50%+36rem)] sm:h-[42.375rem]" viewBox="0 0 1155 678" xmlns="http://www.w3.org/2000/svg">
          <path fill="url(#ecb5b0c9-546c-4772-8c71-4d3f06d544bc)" fill-opacity=".3" d="M317.219 518.975L203.852 678 0 438.341l317.219 80.634 204.172-286.402c1.307 132.337 45.083 346.658 209.733 145.248C936.936 126.058 882.053-94.234 1031.02 41.331c119.18 108.451 130.68 295.337 121.53 375.223L855 299l21.173 362.054-558.954-142.079z" />
          <defs>
            <linearGradient id="ecb5b0c9-546c-4772-8c71-4d3f06d544bc" x1="1155.49" x2="-78.208" y1=".177" y2="474.645" gradientUnits="userSpaceOnUse">
              <stop stop-color="#9089FC" />
              <stop offset="1" stop-color="#FF80B5" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  </div>
</template>
