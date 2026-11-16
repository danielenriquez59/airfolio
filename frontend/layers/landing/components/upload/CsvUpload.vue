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

const isDragging = ref(false)

function triggerFileInput() {
  fileInput.value?.click()
}

function clearFile() {
  fileName.value = ''
  if (fileInput.value)
    fileInput.value.value = ''
}

async function loadFile(file: File) {
  isLoading.value = true
  fileName.value = file.name

  try {
    const content = await file.text()
    const result = parseCSV(content)

    if (result.error) {
      emit('error', result.error)
      clearFile()
    }
    else {
      emit('load', { upper: result.upper, lower: result.lower, airfoilName: result.airfoilName })
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read file'
    emit('error', message)
    clearFile()
  }
  finally {
    isLoading.value = false
  }
}

function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file)
    loadFile(file)
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file)
    loadFile(file)
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
    <div class="grid gap-4 sm:grid-cols-2">
      <button
        type="button"
        class="flex min-h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        :class="isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-300 hover:bg-gray-50'"
        aria-describedby="csv-format"
        @click="triggerFileInput"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
      >
        <Icon name="heroicons:document-arrow-up" class="mb-2 h-8 w-8 text-gray-400" aria-hidden="true" />
        <span class="text-sm font-medium text-gray-900">
          {{ isLoading ? 'Loading...' : 'Drop a file here or click to browse' }}
        </span>
        <span class="mt-1 text-xs text-gray-500">.csv, .txt or .dat</span>
        <span v-if="fileName" class="num mt-3 text-sm font-medium text-primary-700">{{ fileName }}</span>
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".csv,.txt,.dat"
        class="hidden"
        @change="handleFileSelect"
      >

      <div id="csv-format" class="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
        <h4 class="data-label mb-2">
          File format
        </h4>
        <ul class="ml-4 list-disc space-y-1 text-xs text-gray-700">
          <li>First row: airfoil name (letters, numbers, spaces, hyphens, underscores and periods only)</li>
          <li>Upper surface coordinates (minimum 10 points)</li>
          <li>Optional blank line separator (auto-detected if missing)</li>
          <li>Lower surface coordinates (minimum 10 points)</li>
          <li>Comma or space-separated values</li>
          <li>Supported formats: .csv, .txt, .dat</li>
          <li>X values must be monotonic (increasing or decreasing)</li>
        </ul>
      </div>
    </div>

    <VButton v-if="fileName" type="button" color="light" size="sm" @click="clearFile">
      Clear file
    </VButton>

    <details class="rounded-xl border border-gray-200">
      <summary class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
        View example files
      </summary>
      <div class="grid gap-4 border-t border-gray-200 p-4 sm:grid-cols-2">
        <div>
          <p class="data-label mb-1">
            Comma-separated (.csv)
          </p>
          <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700">{{ exampleCSV }}</pre>
        </div>
        <div>
          <p class="data-label mb-1">
            Space-separated (.dat)
          </p>
          <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700">{{ exampleDAT }}</pre>
        </div>
      </div>
    </details>
  </div>
</template>
