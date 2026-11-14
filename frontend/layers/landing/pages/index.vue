<script setup lang="ts">
definePageMeta({
  layout: 'landing',
})

useHead({
  title: 'Airfolio - Airfoil Analysis and Comparison Tool',
  meta: [
    {
      name: 'description',
      content: 'Search, analyze, and compare airfoil performance with AI-powered NeuralFoil analysis. Access a comprehensive database of airfoils with advanced filtering and visualization.'
    }
  ]
})

</script>

<template>
  <div>
    <LandingFeaturedAirfoils />

    <section id="support" class="border-t border-gray-200 bg-white py-12 sm:py-16" aria-labelledby="support-title">
      <div class="page-container">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="max-w-2xl">
            <h2 id="support-title" class="text-xl font-semibold tracking-tight text-gray-900">
              "I love this, how can I support?"
            </h2>
            <p class="mt-1 text-sm text-gray-600">
              To help keep servers running, please consider donating to the project.
              Thanks for being a part of the Airfolio community!
            </p>
          </div>
          <div class="flex-shrink-0">
            <LandingKofiWidget />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
