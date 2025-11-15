<script setup lang="ts">
interface CoordinatePair {
  x: number
  y: number
}

interface Emits {
  (e: 'load', data: { upper: CoordinatePair[]; lower: CoordinatePair[]; airfoilName?: string }): void
  (e: 'error', message: string): void
}

const emit = defineEmits<Emits>()

const { parseCSV } = useAirfoilUpload()

const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref<string>('')
const isLoading = ref(false)

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  isLoading.value = true
  fileName.value = file.name

  try {
    const content = await file.text()
    const result = parseCSV(content)

    if (result.error) {
      emit('error', result.error)
      fileName.value = ''
      fileInput.value!.value = ''
    } else {
      emit('load', { upper: result.upper, lower: result.lower, airfoilName: result.airfoilName })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read file'
    emit('error', message)
    fileName.value = ''
    fileInput.value!.value = ''
  } finally {
    isLoading.value = false
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const clearFile = () => {
  fileName.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const exampleCSV = `NACA-0012
1.0,0.0
0.95,0.002
0.9,0.00568
0.85,0.01027
0.8,0.0154
0.0075,0.00974
0.005,0.00802
0.0025,0.00583
0,0

0,0
0.0025,-0.00583
0.005,-0.00802
0.0075,-0.00974
0.8,-0.0154
0.9,-0.00568
0.95,-0.002
1.0,0.0`

const exampleDAT = `NACA-0012
1.0 0.0
0.95 0.002
0.9 0.00568
0.85 0.01027
0.8 0.0154
0.0075 0.00974
0.005 0.00802
0.0025 0.00583
0 0

0 0
0.0025 -0.00583
0.005 -0.00802
0.0075 -0.00974
0.8 -0.0154
0.9 -0.00568
0.95 -0.002
1.0 0.0`
</script>

<template>
  <div class="space-y-4">
    <div
      class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".csv,.txt,.dat"
        class="hidden"
        @change="handleFileSelect"
      />

      <Icon name="heroicons:document-arrow-up" class="h-8 w-8 mx-auto text-gray-400 mb-2" />
      <p class="text-sm font-medium text-gray-900">
        {{ isLoading ? 'Loading...' : 'Click to upload or drag CSV file' }}
      </p>
      <p class="text-xs text-gray-500 mt-1">
        Supported formats: CSV, TXT, DAT
      </p>

      <div v-if="fileName" class="mt-3 text-sm text-indigo-600 font-medium">
        {{ fileName }}
      </div>
    </div>

    <!-- File controls -->
    <div v-if="fileName" class="flex gap-2">
      <button
        type="button"
        class="flex-1 px-3 py-2 bg-gray-300 text-gray-900 text-sm font-medium rounded hover:bg-gray-400 transition-colors"
        @click="clearFile"
      >
        Clear File
      </button>
    </div>

    <!-- Format help -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
      <h4 class="font-semibold text-blue-900 mb-2">File Format Requirements:</h4>
      <ul class="text-blue-800 space-y-1 text-xs ml-4 list-disc">
        <li>First row: airfoil name (alphanumeric, hyphens, max 12 characters)</li>
        <li>Upper surface coordinates (minimum 10 points)</li>
        <li>Optional blank line separator (auto-detected if missing)</li>
        <li>Lower surface coordinates (minimum 10 points)</li>
        <li>Comma or space-separated values</li>
        <li>Supported formats: .csv, .txt, .dat</li>
        <li>X values must be monotonic (increasing or decreasing)</li>
      </ul>
    </div>

    <!-- Example -->
    <details class="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <summary class="cursor-pointer font-medium text-sm text-gray-900 hover:text-gray-700">
        View Example Files
      </summary>
      <div class="mt-3 space-y-4">
        <div>
          <p class="text-xs font-semibold text-gray-700 mb-1">Comma-separated (.csv):</p>
          <pre class="bg-white p-3 border border-gray-200 rounded text-xs overflow-x-auto text-gray-700">{{ exampleCSV }}</pre>
        </div>
        <div>
          <p class="text-xs font-semibold text-gray-700 mb-1">Space-separated (.dat):</p>
          <pre class="bg-white p-3 border border-gray-200 rounded text-xs overflow-x-auto text-gray-700">{{ exampleDAT }}</pre>
        </div>
      </div>
    </details>
  </div>
</template>

