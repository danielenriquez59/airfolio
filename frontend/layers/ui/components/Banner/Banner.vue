<script setup>
import { MegaphoneIcon, XMarkIcon } from '@heroicons/vue/24/outline'
</script>

<template>
  <div class="bg-primary-600">
    <div class="page-container py-3">
      <div class="flex flex-wrap items-center justify-between">
        <div class="flex w-0 flex-1 items-center">
          <span class="flex rounded-lg bg-primary-800 p-2">
            <MegaphoneIcon class="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <p class="ml-3 truncate font-medium text-white">
            <span class="md:hidden">We announced a new product!</span>
            <span class="hidden md:inline">Big news! We're excited to announce a brand new product.</span>
          </p>
        </div>
        <div class="order-3 mt-2 w-full flex-shrink-0 sm:order-2 sm:mt-0 sm:w-auto">
          <a href="#" class="flex items-center justify-center rounded-lg border border-transparent bg-white px-4 h-9 text-sm font-medium text-primary-700 hover:bg-primary-50">Learn more</a>
        </div>
        <div class="order-2 flex-shrink-0 sm:order-3 sm:ml-3">
          <button type="button" class="-mr-1 flex rounded-md p-2 hover:bg-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:-mr-2">
            <span class="sr-only">Dismiss</span>
            <XMarkIcon class="h-6 w-6 text-white" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
