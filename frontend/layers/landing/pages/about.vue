<script setup lang="ts">
const config = useRuntimeConfig()
const supportEmail = config.public.supportEmail

definePageMeta({
  layout: 'landing',
})

useHead({
  title: 'About Airfolio - Airfoil Analysis Tool',
  meta: [
    {
      name: 'description',
      content: 'Learn about Airfolio, a comprehensive airfoil analysis and comparison tool powered by NeuralFoil. Search, analyze, and compare airfoil performance data.'
    }
  ]
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">About Airfolio</h1>
        <p class="text-xl text-gray-600">
          A comprehensive airfoil analysis and comparison tool
        </p>
      </div>

      <!-- Overview -->
      <section class="mb-12">
        <h2 class="text-2xl font-semibold text-gray-900 mb-4">What is Airfolio?</h2>
        <p class="text-gray-700 leading-relaxed mb-4">
          Airfolio is a web-based platform for discovering, analyzing, and comparing airfoil performance data. 
          Whether you're designing aircraft, wind turbines, or studying aerodynamics, Airfolio provides the tools 
          you need to make informed design decisions.
        </p>
      </section>

      <!-- Capabilities -->
      <section class="mb-12">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Capabilities</h2>
        
        <div class="space-y-6">
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Search & Filter</h3>
            <p class="text-gray-700">
              Browse a comprehensive database of airfoils with advanced filtering by name, thickness, and camber. 
              Quickly find airfoils that match your design requirements.
            </p>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-2">AI-Powered Performance Analysis</h3>
            <p class="text-gray-700">
              Run aerodynamic analysis powered by <a 
                href="https://github.com/peterdsharpe/NeuralFoil" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-indigo-600 hover:text-indigo-800 underline"
              >NeuralFoil</a>, a neural network-based airfoil analysis tool. 
              Configure Reynolds number, Mach number, and angle of attack ranges to get detailed performance insights.
            </p>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Multi-Airfoil Comparison</h3>
            <p class="text-gray-700">
              Compare multiple airfoils side-by-side with interactive polar plots (CL, CD, CM, L/D vs α) and 
              comprehensive performance summary tables. Filter by performance metrics to find the best airfoils 
              for your application.
            </p>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Custom Airfoil Upload</h3>
            <p class="text-gray-700">
              Upload your own airfoil coordinates via manual entry or CSV upload. Share your designs with the 
              community and analyze them using the same powerful tools.
            </p>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Control Surface Analysis</h3>
            <p class="text-gray-700">
              Analyze airfoil performance with control surface deflections. Compare multiple flap configurations 
              and visualize how geometry changes affect aerodynamic performance.
            </p>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Performance Caching</h3>
            <p class="text-gray-700">
              Results are cached for instant access. Re-run analyses with different parameters without waiting 
              for full recomputation.
            </p>
          </div>
        </div>
      </section>

      <!-- Credits -->
      <section class="mb-12">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Credits & Acknowledgments</h2>
        
        <div class="space-y-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">NeuralFoil and AeroSandbox</h3>
            <p class="text-gray-700 mb-2">
              Airfolio uses <a 
                href="https://github.com/peterdsharpe/NeuralFoil" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-indigo-600 hover:text-indigo-800 underline"
              >NeuralFoil</a> and AeroSandbox by Peter Sharpe for AI-powered airfoil performance analysis. 
              NeuralFoil provides fast, accurate aerodynamic predictions using neural networks trained on 
              high-fidelity CFD data.
            </p>
            <p class="text-sm text-gray-600">
              <a 
                href="https://github.com/peterdsharpe/NeuralFoil/tree/master/studies" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-indigo-600 hover:text-indigo-800 underline"
              >View NeuralFoil studies and documentation</a>
            </p>
          </div>

          <div class="border-t border-gray-200 pt-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Inspiration</h3>
            <p class="text-gray-700">
              Airfolio draws inspiration from excellent airfoil resources including 
              <a 
                href="https://airfoiltools.com" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-indigo-600 hover:text-indigo-800 underline"
              >airfoiltools.com</a> and 
              <a 
                href="https://bigfoil.com" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-indigo-600 hover:text-indigo-800 underline"
              >bigfoil.com</a>, 
              which have served as valuable references for the airfoil analysis community.
            </p>
          </div>
        </div>
      </section>

      <!-- Contact -->
      <section class="text-center">
        <h2 class="text-2xl font-semibold text-gray-900 mb-4">Questions or Feedback?</h2>
        <p class="text-gray-700 mb-4">
          We'd love to hear from you. Reach out with questions, suggestions, or bug reports.
        </p>
        <a 
          :href="`mailto:${supportEmail}`"
          class="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Contact Support
        </a>
      </section>
    </div>
  </div>
</template>

