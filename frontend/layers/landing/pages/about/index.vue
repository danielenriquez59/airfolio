<script setup lang="ts">
const config = useRuntimeConfig()
const supportEmail = config.public.supportEmail

definePageMeta({
  layout: 'simple',
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
  <div class="page-container py-8">
    <div class="max-w-3xl">
      <PageHeader
        title="About Airfolio"
        subtitle="A comprehensive airfoil analysis and comparison tool"
      />

      <section class="mb-10">
        <h2 class="mb-2 text-base font-semibold text-gray-900">What is Airfolio?</h2>
        <p class="text-sm leading-relaxed text-gray-700">
          Airfolio is a web-based platform for discovering, analyzing, and comparing airfoil performance data.
          Whether you're designing aircraft, wind turbines, or studying aerodynamics, Airfolio provides the tools
          you need to make informed design decisions.
        </p>
      </section>

      <section class="mb-10">
        <h2 class="mb-3 text-base font-semibold text-gray-900">Capabilities</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-gray-200 bg-white p-4">
            <h3 class="text-sm font-semibold text-gray-900">Search &amp; Filter</h3>
            <p class="mt-1 text-sm text-gray-600">
              Browse a comprehensive database of airfoils with advanced filtering by name, thickness, and camber.
              Quickly find airfoils that match your design requirements.
            </p>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-4">
            <h3 class="text-sm font-semibold text-gray-900">AI-Powered Performance Analysis</h3>
            <p class="mt-1 text-sm text-gray-600">
              Run aerodynamic analysis powered by <a
                href="https://github.com/peterdsharpe/NeuralFoil"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-primary-600 underline hover:text-primary-700"
              >NeuralFoil</a>, a neural network-based airfoil analysis tool.
              Configure Reynolds number, Mach number, and angle of attack ranges to get detailed performance insights.
            </p>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-4">
            <h3 class="text-sm font-semibold text-gray-900">Multi-Airfoil Comparison</h3>
            <p class="mt-1 text-sm text-gray-600">
              Compare multiple airfoils side-by-side with interactive polar plots (CL, CD, CM, L/D vs α) and
              comprehensive performance summary tables. Filter by performance metrics to find the best airfoils
              for your application.
            </p>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-4">
            <h3 class="text-sm font-semibold text-gray-900">Custom Airfoil Upload</h3>
            <p class="mt-1 text-sm text-gray-600">
              Upload your own airfoil coordinates via manual entry or CSV upload. Share your designs with the
              community and analyze them using the same powerful tools.
            </p>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-4">
            <h3 class="text-sm font-semibold text-gray-900">Control Surface Analysis</h3>
            <p class="mt-1 text-sm text-gray-600">
              Analyze airfoil performance with control surface deflections. Compare multiple flap configurations
              and visualize how geometry changes affect aerodynamic performance.
            </p>
          </div>

          <div class="rounded-xl border border-gray-200 bg-white p-4">
            <h3 class="text-sm font-semibold text-gray-900">Performance Caching</h3>
            <p class="mt-1 text-sm text-gray-600">
              Results are cached for instant access. Re-run analyses with different parameters without waiting
              for full recomputation.
            </p>
          </div>
        </div>
      </section>

      <section class="mb-10">
        <h2 class="mb-3 text-base font-semibold text-gray-900">Credits &amp; Acknowledgments</h2>

        <div class="space-y-4 text-sm leading-relaxed text-gray-700">
          <div>
            <h3 class="mb-1 font-semibold text-gray-900">NeuralFoil and AeroSandbox</h3>
            <p class="mb-2">
              Airfolio uses <a
                href="https://github.com/peterdsharpe/NeuralFoil"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-primary-600 underline hover:text-primary-700"
              >NeuralFoil</a> and AeroSandbox by Peter Sharpe for AI-powered airfoil performance analysis.
              NeuralFoil provides fast, accurate aerodynamic predictions using neural networks trained on
              high-fidelity CFD data.
            </p>
            <p>
              <a
                href="https://github.com/peterdsharpe/NeuralFoil/tree/master/studies"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-primary-600 underline hover:text-primary-700"
              >View NeuralFoil studies and documentation</a>
            </p>
          </div>

          <div class="border-t border-gray-200 pt-4">
            <h3 class="mb-1 font-semibold text-gray-900">Inspiration</h3>
            <p>
              Airfolio draws inspiration from excellent airfoil resources including
              <a
                href="https://airfoiltools.com"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-primary-600 underline hover:text-primary-700"
              >airfoiltools.com</a> and
              <a
                href="https://bigfoil.com"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-primary-600 underline hover:text-primary-700"
              >bigfoil.com</a>,
              which have served as valuable references for the airfoil analysis community. Thank you.
            </p>
            <p class="mt-3 text-right text-gray-600">
              - Daniel E.
            </p>
          </div>
        </div>
      </section>

      <VPanel title="Questions or Feedback?">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-gray-600">
            We'd love to hear from you. Reach out with questions, suggestions, or bug reports.
          </p>
          <VButton
            color="primary"
            class="flex-shrink-0"
            :href="`mailto:${supportEmail}`"
          >
            Contact Support
          </VButton>
        </div>
      </VPanel>
    </div>
  </div>
</template>
