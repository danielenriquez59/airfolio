<script setup lang="ts">
import type { BezierFitResponse, ReparametrizedPoints } from '~/composables/useBezierFit'
import { reparametrizeBezierPoints } from '~/composables/useBezierFit'
import { formatCoord, triggerDownload, sanitizeFilename } from '~/composables/useAirfoilDownload'

interface Props {
  upperX: number[]
  upperY: number[]
  lowerX: number[]
  lowerY: number[]
  airfoilName: string
}

const props = defineProps<Props>()

const { submitBezierFit } = useBezierFit()

// State
const bezierOrder = ref(6)
const isLoading = ref(false)
const error = ref<string | null>(null)
const fitResult = ref<BezierFitResponse | null>(null)
const reparamCount = ref(80)
const reparamPoints = ref<ReparametrizedPoints | null>(null)
const exportFormat = ref<'selig' | 'lednicer' | 'csv'>('selig')

// Run Bezier fit
const runBezierFit = async () => {
  isLoading.value = true
  error.value = null
  reparamPoints.value = null

  try {
    fitResult.value = await submitBezierFit({
      upper_x: props.upperX,
      upper_y: props.upperY,
      lower_x: props.lowerX,
      lower_y: props.lowerY,
      order: bezierOrder.value,
    })
  } catch (err: any) {
    error.value = err.data?.detail || err.message || 'Bezier fitting failed'
    console.error('Bezier fit error:', err)
  } finally {
    isLoading.value = false
  }
}

// Export control points
const exportControlPoints = () => {
  if (!fitResult.value) return

  const lines: string[] = []
  lines.push(`# Bezier Control Points for ${props.airfoilName}`)
  lines.push(`# Order: ${fitResult.value.order}`)
  lines.push(`# Upper SSE: ${fitResult.value.upper_sse.toExponential(4)}`)
  lines.push(`# Lower SSE: ${fitResult.value.lower_sse.toExponential(4)}`)
  lines.push('')
  lines.push('# Upper Surface Control Points')
  lines.push('# X, Y')
  fitResult.value.upper_control_points.x.forEach((x, i) => {
    lines.push(`${x.toFixed(8)}, ${fitResult.value!.upper_control_points.y[i].toFixed(8)}`)
  })
  lines.push('')
  lines.push('# Lower Surface Control Points')
  lines.push('# X, Y')
  fitResult.value.lower_control_points.x.forEach((x, i) => {
    lines.push(`${x.toFixed(8)}, ${fitResult.value!.lower_control_points.y[i].toFixed(8)}`)
  })

  triggerDownload(lines.join('\n'), `${sanitizeFilename(props.airfoilName)}_bezier_cp.txt`)
}

// Reparametrize points
const runReparametrize = () => {
  if (!fitResult.value) return
  reparamPoints.value = reparametrizeBezierPoints(fitResult.value, reparamCount.value)
}

// Export reparametrized points in selected format
const exportReparamPoints = () => {
  if (!reparamPoints.value) return

  const baseName = sanitizeFilename(props.airfoilName)
  const upper = reparamPoints.value.upper
  const lower = reparamPoints.value.lower

  if (exportFormat.value === 'selig') {
    const lines: string[] = [props.airfoilName, '']
    // Upper surface: TE -> LE (reverse)
    for (let i = upper.x.length - 1; i >= 0; i--)
      lines.push(`${formatCoord(upper.x[i])}  ${formatCoord(upper.y[i])}`)
    // Lower surface: LE -> TE
    for (let i = 0; i < lower.x.length; i++)
      lines.push(`${formatCoord(lower.x[i])}  ${formatCoord(lower.y[i])}`)
    triggerDownload(lines.join('\n'), `${baseName}_reparam_selig.dat`)
  }
  else if (exportFormat.value === 'lednicer') {
    const upperCount = (upper.x.length.toString() + '.').padStart(8)
    const lowerCount = (lower.x.length.toString() + '.').padStart(8)
    const lines: string[] = [props.airfoilName, `${upperCount}  ${lowerCount}`, '']
    // Upper surface: LE -> TE (ascending X, already in order)
    for (let i = 0; i < upper.x.length; i++)
      lines.push(`${formatCoord(upper.x[i])}  ${formatCoord(upper.y[i])}`)
    lines.push('')
    // Lower surface: LE -> TE
    for (let i = 0; i < lower.x.length; i++)
      lines.push(`${formatCoord(lower.x[i])}  ${formatCoord(lower.y[i])}`)
    triggerDownload(lines.join('\n'), `${baseName}_reparam_lednicer.dat`)
  }
  else if (exportFormat.value === 'csv') {
    const lines: string[] = ['surface,x,y']
    for (let i = 0; i < upper.x.length; i++)
      lines.push(`upper,${upper.x[i].toFixed(8)},${upper.y[i].toFixed(8)}`)
    for (let i = 0; i < lower.x.length; i++)
      lines.push(`lower,${lower.x[i].toFixed(8)},${lower.y[i].toFixed(8)}`)
    triggerDownload(lines.join('\n'), `${baseName}_reparam.csv`)
  }
}

// Available order options
const orderOptions = [3, 4, 5, 6, 7, 8, 9, 10]
</script>

<template>
  <div class="space-y-4">
    <!-- Controls -->
    <div class="flex flex-wrap items-center gap-4">
      <div class="flex items-center gap-2">
        <label for="bezier-order" class="text-sm font-medium text-gray-700">
          Bezier Order:
        </label>
        <select
          id="bezier-order"
          v-model="bezierOrder"
          class="block w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          :disabled="isLoading"
        >
          <option v-for="n in orderOptions" :key="n" :value="n">
            {{ n }}
          </option>
        </select>
      </div>

      <button
        type="button"
        @click="runBezierFit"
        :disabled="isLoading"
        class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        <div v-if="isLoading" class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
        <Icon v-else name="heroicons:play" class="h-4 w-4" />
        {{ isLoading ? 'Fitting...' : 'Run Bezier Fit' }}
      </button>

      <button
        v-if="fitResult"
        type="button"
        @click="exportControlPoints"
        class="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-900 rounded-md font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
      >
        <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
        Export Control Points
      </button>

      <template v-if="fitResult">
        <div class="flex items-center gap-2">
          <input
            v-model.number="reparamCount"
            type="number"
            min="5"
            max="500"
            class="block w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <button
            type="button"
            @click="runReparametrize"
            class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Icon name="heroicons:arrow-path" class="h-4 w-4" />
            Reparametrize Points
          </button>
        </div>

        <div v-if="reparamPoints" class="flex items-center gap-2">
          <select
            v-model="exportFormat"
            class="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="selig">Selig (.dat)</option>
            <option value="lednicer">Lednicer (.dat)</option>
            <option value="csv">CSV (.csv)</option>
          </select>
          <button
            type="button"
            @click="exportReparamPoints"
            class="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-900 rounded-md font-medium hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" />
            Export Points
          </button>
        </div>
      </template>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="p-4 bg-red-50 border border-red-200 rounded-md">
      <div class="flex">
        <Icon name="heroicons:exclamation-triangle" class="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
        <p class="text-sm text-red-800">{{ error }}</p>
      </div>
    </div>

    <!-- Results -->
    <div v-if="fitResult" class="space-y-4">
      <!-- Fit Quality Info -->
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div class="bg-gray-50 p-3 rounded-md">
          <span class="text-gray-500">Upper Surface SSE:</span>
          <span class="ml-2 font-mono font-medium">{{ fitResult.upper_sse.toExponential(4) }}</span>
        </div>
        <div class="bg-gray-50 p-3 rounded-md">
          <span class="text-gray-500">Lower Surface SSE:</span>
          <span class="ml-2 font-mono font-medium">{{ fitResult.lower_sse.toExponential(4) }}</span>
        </div>
      </div>

      <!-- Plot -->
      <div class="border border-gray-200 rounded-lg p-4 bg-white">
        <BezierFitPlot
          :original-upper-x="upperX"
          :original-upper-y="upperY"
          :original-lower-x="lowerX"
          :original-lower-y="lowerY"
          :fitted-upper-x="fitResult.upper_curve.x"
          :fitted-upper-y="fitResult.upper_curve.y"
          :fitted-lower-x="fitResult.lower_curve.x"
          :fitted-lower-y="fitResult.lower_curve.y"
          :upper-control-points="fitResult.upper_control_points"
          :lower-control-points="fitResult.lower_control_points"
          :reparam-upper-x="reparamPoints?.upper.x"
          :reparam-upper-y="reparamPoints?.upper.y"
          :reparam-lower-x="reparamPoints?.lower.x"
          :reparam-lower-y="reparamPoints?.lower.y"
        />
      </div>

      <!-- Control Points Tables -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 class="text-sm font-medium text-gray-700 mb-2">Upper Surface Control Points</h4>
          <div class="max-h-48 overflow-auto border border-gray-200 rounded-md">
            <table class="min-w-full text-xs">
              <thead class="bg-gray-50 sticky top-0">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Index</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">X</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Y</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                <tr v-for="(x, i) in fitResult.upper_control_points.x" :key="i">
                  <td class="px-3 py-2 text-gray-600">P{{ i }}</td>
                  <td class="px-3 py-2 font-mono text-gray-900">{{ x.toFixed(6) }}</td>
                  <td class="px-3 py-2 font-mono text-gray-900">{{ fitResult.upper_control_points.y[i].toFixed(6) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h4 class="text-sm font-medium text-gray-700 mb-2">Lower Surface Control Points</h4>
          <div class="max-h-48 overflow-auto border border-gray-200 rounded-md">
            <table class="min-w-full text-xs">
              <thead class="bg-gray-50 sticky top-0">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Index</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">X</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-500">Y</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                <tr v-for="(x, i) in fitResult.lower_control_points.x" :key="i">
                  <td class="px-3 py-2 text-gray-600">P{{ i }}</td>
                  <td class="px-3 py-2 font-mono text-gray-900">{{ x.toFixed(6) }}</td>
                  <td class="px-3 py-2 font-mono text-gray-900">{{ fitResult.lower_control_points.y[i].toFixed(6) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="isLoading" class="space-y-4">
      <!-- Loading skeleton matching results layout -->
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-gray-100 h-14 rounded-md animate-pulse" />
        <div class="bg-gray-100 h-14 rounded-md animate-pulse" />
      </div>
      <div class="border border-gray-200 rounded-lg p-4 bg-gray-50 h-80 animate-pulse flex items-center justify-center">
        <div class="text-center text-gray-500">
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-indigo-600 mx-auto mb-4" />
          <p class="font-medium">Fitting Bezier curves...</p>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-gray-100 h-56 rounded-md animate-pulse" />
        <div class="bg-gray-100 h-56 rounded-md animate-pulse" />
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12 text-gray-500">
      <Icon name="heroicons:chart-bar" class="h-12 w-12 mx-auto mb-4 text-gray-300" />
      <p class="font-medium">Bezier Curve Fitting</p>
      <p class="text-sm mt-2">Select a Bezier order and click "Run Bezier Fit" to parameterize this airfoil.</p>
    </div>
  </div>
</template>
