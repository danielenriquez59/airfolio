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
    
    <section id="support" class="py-16 bg-white">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-gray-900 mb-6">"I love this, how can I support?"</h2>
        
        <!-- <p class="text-gray-700 leading-relaxed mb-6">
          Engagement is the best way to support the site. If you are
          interested in helping with development please contact
          <a :href="`mailto:${supportEmail}`" class="font-semibold text-indigo-600 hover:text-indigo-800">
            {{ supportEmail }}
          </a>.
        </p> -->
        
        <p class="text-gray-700 leading-relaxed mb-6">
          To help keep servers running, please consider donating to the project.
          Thanks for being a part of the Airfolio community!
        </p>
        
        <div class="flex justify-center">
          <LandingKofiWidget />
        </div>
      </div>
    </section>
  </div>
</template>
