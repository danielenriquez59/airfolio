<script setup lang="ts">
defineProps<{
  isOpen: boolean
}>()

defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-gray-900/40" @click="$emit('close')" />

        <div
          class="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-help-title"
          @keydown.esc="$emit('close')"
        >
          <div class="flex items-center justify-between gap-2 border-b border-gray-200 px-5 py-3">
            <h2 id="upload-help-title" class="text-base font-semibold text-gray-900">
              How to Upload Airfoils
            </h2>
            <button
              type="button"
              aria-label="Close"
              class="-mr-2 inline-flex items-center justify-center rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              @click="$emit('close')"
            >
              <Icon name="heroicons:x-mark-20-solid" class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div class="space-y-6 overflow-y-auto px-5 py-5 text-sm text-gray-700">
            <section>
              <h3 class="mb-2 text-sm font-semibold text-gray-900">
                Method 1: File upload (preferred)
              </h3>
              <p class="mb-3">
                Upload a file (.csv, .txt, or .dat) with the following structure:
              </p>
              <pre class="mb-3 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-900">NACA-0012
1.0,0.0
0.95,0.002
0.9,0.00568
...
<span class="text-gray-500">(optional blank line)</span>
0.0,0.0
0.0025,-0.00583
0.005,-0.00802
...</pre>
              <ul class="ml-5 list-disc space-y-1">
                <li>First row: airfoil name (letters, numbers, spaces, hyphens, underscores and periods only)</li>
                <li>Upper surface coordinates (minimum 10 points, one per row)</li>
                <li>Optional blank line separating surfaces (auto-detected if missing)</li>
                <li>Lower surface coordinates (minimum 10 points)</li>
                <li>Comma or space-separated values</li>
                <li>Supported file formats: .csv, .txt, .dat</li>
              </ul>
            </section>

            <section>
              <h3 class="mb-2 text-sm font-semibold text-gray-900">
                Method 2: Edit points
              </h3>
              <ol class="ml-5 list-decimal space-y-1">
                <li>Use the <strong>Edit points</strong> tab (a loaded file lands here too)</li>
                <li>Type or paste one point per line as <code>x y</code> or <code>x, y</code></li>
                <li>Enter at least 10 points for each surface</li>
                <li>X values must be monotonic (all increasing or all decreasing)</li>
                <li>The plot updates as you type</li>
              </ol>
            </section>

            <section>
              <h3 class="mb-2 text-sm font-semibold text-gray-900">
                Smoothing with a CST fit
              </h3>
              <p>
                Digitized points from a paper are often noisy. Open the <strong>CST fit</strong> tab on the
                geometry view to fit a smooth CST curve and replace your points with it before uploading.
              </p>
            </section>

            <section class="rounded-lg border border-warning-200 bg-warning-50 p-4">
              <h3 class="mb-2 text-sm font-semibold text-warning-900">
                Important rules
              </h3>
              <ul class="ml-5 list-disc space-y-1 text-warning-800">
                <li>X-coordinates must be <strong>monotonic</strong> (strictly increasing OR decreasing)</li>
                <li>Both upper and lower surfaces must have at least <strong>10 coordinate pairs</strong></li>
                <li>Airfoil name (letters, numbers, spaces, hyphens, underscores and periods only)</li>
                <li>All values must be valid numbers</li>
                <li>X and Y values should be within reasonable aerodynamic ranges</li>
                <li>Blank line separator is optional - the system will auto-detect the split point</li>
              </ul>
            </section>

            <section>
              <h3 class="mb-2 text-sm font-semibold text-gray-900">
                After upload
              </h3>
              <ol class="ml-5 list-decimal space-y-1">
                <li>Your coordinates are validated</li>
                <li>
                  Geometric properties are automatically calculated:
                  <ul class="ml-5 mt-1 list-disc">
                    <li>Thickness and thickness location</li>
                    <li>Camber and camber location</li>
                    <li>Leading edge radius</li>
                    <li>Trailing edge thickness and angle</li>
                  </ul>
                </li>
                <li>You'll review the calculated properties on a confirmation page</li>
                <li>After confirmation, your airfoil is added to the database</li>
              </ol>
            </section>
          </div>

          <div class="flex justify-end border-t border-gray-200 bg-gray-50 px-5 py-3">
            <VButton type="button" color="primary" @click="$emit('close')">
              Got it
            </VButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
