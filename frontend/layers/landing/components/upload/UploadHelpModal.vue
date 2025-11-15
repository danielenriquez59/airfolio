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
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black bg-opacity-50"
          @click="$emit('close')"
        />

        <!-- Modal -->
        <div class="relative bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <!-- Header -->
          <div class="sticky top-0 border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">How to Upload Airfoils</h2>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-600"
              @click="$emit('close')"
            >
              <Icon name="heroicons:x-mark" class="h-6 w-6" />
            </button>
          </div>

          <!-- Content -->
          <div class="px-6 py-6 space-y-6">
            <!-- Method 1 -->
            
            <!-- Method 2 -->
            <div>
              <h3 class="text-base font-semibold text-gray-900 mb-2">Method 1: File Upload (Preferred)</h3>
              <p class="text-sm text-gray-700 mb-3">
                Upload a file (.csv, .txt, or .dat) with the following structure:
              </p>
              <div class="bg-gray-100 p-3 rounded font-mono text-xs text-gray-900 overflow-x-auto mb-3">
                <div>NACA-0012</div>
                <div>1.0,0.0</div>
                <div>0.95,0.002</div>
                <div>0.9,0.00568</div>
                <div>...</div>
                <div class="text-gray-500">(optional blank line)</div>
                <div>0.0,0.0</div>
                <div>0.0025,-0.00583</div>
                <div>0.005,-0.00802</div>
                <div>...</div>
              </div>
              <ul class="list-disc ml-5 text-sm text-gray-700 space-y-1">
                <li>First row: airfoil name (alphanumeric, hyphens allowed, max 12 characters)</li>
                <li>Upper surface coordinates (minimum 10 points, one per row)</li>
                <li>Optional blank line separating surfaces (auto-detected if missing)</li>
                <li>Lower surface coordinates (minimum 10 points)</li>
                <li>Comma or space-separated values</li>
                <li>Supported file formats: .csv, .txt, .dat</li>
              </ul>
            </div>
            
            <div>
              <h3 class="text-base font-semibold text-gray-900 mb-2">Method 2: Manual Entry</h3>
              <ol class="list-decimal ml-5 text-sm text-gray-700 space-y-2">
                <li>Use the <strong>Manual Table</strong> tab</li>
                <li>Enter X and Y values for upper surface (minimum 10 points)</li>
                <li>Continue adding rows for lower surface (minimum 10 points)</li>
                <li>X values must be monotonic (all increasing or all decreasing)</li>
                <li>Click <strong>Add Row</strong> to add more coordinate pairs</li>
              </ol>
            </div>
            <!-- Important Notes -->
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 class="text-sm font-semibold text-yellow-900 mb-2">Important Rules:</h3>
              <ul class="list-disc ml-5 text-sm text-yellow-800 space-y-1">
                <li>X-coordinates must be <strong>monotonic</strong> (strictly increasing OR decreasing)</li>
                <li>Both upper and lower surfaces must have at least <strong>10 coordinate pairs</strong></li>
                <li>Airfoil name must be alphanumeric with hyphens allowed, maximum 12 characters</li>
                <li>All values must be valid numbers</li>
                <li>X and Y values should be within reasonable aerodynamic ranges</li>
                <li>Blank line separator is optional - the system will auto-detect the split point</li>
              </ul>
            </div>

            <!-- What Happens Next -->
            <div>
              <h3 class="text-base font-semibold text-gray-900 mb-2">After Upload:</h3>
              <ol class="list-decimal ml-5 text-sm text-gray-700 space-y-2">
                <li>Your coordinates are validated</li>
                <li>Geometric properties are automatically calculated:
                  <ul class="list-disc ml-5 mt-1">
                    <li>Thickness and thickness location</li>
                    <li>Camber and camber location</li>
                    <li>Leading edge radius</li>
                    <li>Trailing edge thickness and angle</li>
                  </ul>
                </li>
                <li>You'll review the calculated properties on a confirmation page</li>
                <li>After confirmation, your airfoil is added to the database</li>
              </ol>
            </div>
          </div>

          <!-- Footer -->
          <div class="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <button
              type="button"
              class="w-full px-4 py-2 bg-indigo-600 text-white font-medium rounded hover:bg-indigo-700 transition-colors"
              @click="$emit('close')"
            >
              Got it!
            </button>
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

