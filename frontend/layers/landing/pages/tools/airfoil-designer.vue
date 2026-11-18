<script setup lang="ts">
import { watch } from 'vue'
import type { CSTParameters } from '~/composables/useCSTParameters'
import { fitCSTToGeometry, generateCSTCoordinates } from '~/composables/useCSTParameters'
import { exportCSTParameters } from '~/composables/useCSTExport'
import { exportCoordinates } from '~/composables/useNACAExport'
import type { Database } from '~/types/database.types'
import { AIRFOIL_FAMILIES, defaultCSTWeights } from '~/utils/airfoilFamilies'
import { type Conditions, type DesignSnapshot, MAX_SNAPSHOTS, type Polar, addSnapshot, angleCount, blendCST, cloneParams, isUnsaved, parseSavedDesign, polarStats, runKey } from '~/utils/airfoilDesigner'
import { tabButtonClasses } from '~/layers/ui/utils/buttons'
import AirfoilPolarPlots from '~/components/analysis/AirfoilPolarPlots.vue'
import SparAirfoilSelector from '~/layers/landing/components/spar/SparAirfoilSelector.vue'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

definePageMeta({
  layout: 'detail',
})

useSeoMeta({
  title: 'Airfoil Designer - Perturb CST Weights and Compare Polars',
  description: 'Fit CST weights to an airfoil, change them, and see the effect on lift, drag and moment. Save design snapshots and compare their polars with NeuralFoil or the mfoil panel solver.',
  ogTitle: 'Airfoil Designer - Perturb CST Weights and Compare Polars',
  ogDescription: 'Fit CST weights to an airfoil, change them, and compare the polars of each design snapshot with NeuralFoil or mfoil.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

type Solver = 'neural' | 'mfoil'

const STORAGE_KEY = 'airfolio-airfoil-designer'
const MFOIL_MAX_ANGLES = 100 // same limit as the Numerical Analysis 2D page
const NEURAL_MAX_ANGLES = 200 // TRANSIENT_MAX_ANGLES in backend/main.py
const SOLVERS: { key: Solver; label: string }[] = [{ key: 'neural', label: 'NeuralFoil' }, { key: 'mfoil', label: 'mfoil' }]

const config = useRuntimeConfig()

// The design being edited, and the frozen snapshots it is compared with
const params = ref<CSTParameters>(cloneParams(AIRFOIL_FAMILIES.cst.defaults))
const snapshots = ref<DesignSnapshot[]>([])
const lastConditions = ref<Conditions>() // flow conditions of the last run, restored into the panel

// Saved in this browser only. Loaded after mount so the static page hydrates without a mismatch.
const loaded = ref(false)
onMounted(() => {
  try {
    const saved = parseSavedDesign(localStorage.getItem(STORAGE_KEY))
    if (saved) {
      params.value = saved.params
      snapshots.value = saved.snapshots
      lastConditions.value = saved.conditions
    }
  }
  catch {
    // storage blocked: start from the defaults
  }
  loaded.value = true
})
watch([params, snapshots, lastConditions], () => {
  if (!loaded.value)
    return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ params: params.value, snapshots: snapshots.value, conditions: lastConditions.value }))
  }
  catch {
    // storage full or blocked: the page still works, just without saving
  }
}, { deep: true })

// One confirm modal for Delete, and for Load or Blend when it would replace a design no snapshot holds
const pending = ref<{ action: 'load' | 'delete'; snapshot: DesignSnapshot } | { action: 'blend' }>()

// Blend two catalog airfoils into the current design. The pickers are not saved.
const { fetchAirfoilGeometry } = useAirfoils()
const blendA = ref<Airfoil | null>(null)
const blendB = ref<Airfoil | null>(null)
const blendPct = ref(50)
const blendFits = shallowRef<CSTParameters[]>() // [A, B], fitted with the current weight count
const blendError = ref<string | null>(null)
const isBlendFitting = ref(false)
let blendToken = 0 // drops a fit that lands after the picks or the weight count changed
let requestOnLand = false // new picks: offer the blend once their fits arrive

// Active while the design is still exactly what the blend last wrote; any other change makes it inactive
const paramsJson = computed(() => JSON.stringify(params.value))
const blendApplied = ref<string>()
const blendActive = computed(() => paramsJson.value === blendApplied.value)
// Default weights set by a count change made while the blend was active; replaced by the blend when the refit lands
const blendHold = ref<string>()
const blendKeeps = computed(() => blendActive.value || paramsJson.value === blendHold.value)

const pickerName = (f: Airfoil | null) => f ? (f.display_name || f.name).toUpperCase() : '' // as SparAirfoilSelector shows it
// The page default, or the default weights at another count: nothing to lose
const isDefaultDesign = (p: CSTParameters) => JSON.stringify(p) === JSON.stringify({ ...AIRFOIL_FAMILIES.cst.defaults, ...defaultCSTWeights(p.order), order: p.order })

function applyBlend() {
  if (!blendFits.value)
    return
  params.value = blendCST(blendFits.value[0], blendFits.value[1], blendPct.value / 100)
  blendApplied.value = JSON.stringify(params.value)
}
// Asks first when the blend would replace a design no snapshot holds (same check as Load)
function requestBlend() {
  if (!blendActive.value && isUnsaved(params.value, snapshots.value) && !isDefaultDesign(params.value))
    pending.value = { action: 'blend' }
  else
    applyBlend()
}
async function fitBlend() {
  const token = ++blendToken
  const [a, b] = [blendA.value, blendB.value]
  blendFits.value = undefined
  blendError.value = null
  isBlendFitting.value = !!(a && b)
  if (!a || !b) {
    blendHold.value = undefined
    return
  }
  const weights = params.value.order + 1
  try {
    const fits = await Promise.all([a, b].map(async f => fitCSTToGeometry(await fetchAirfoilGeometry(f.id), weights)))
    if (token !== blendToken)
      return
    blendFits.value = fits
    if (paramsJson.value === blendHold.value)
      applyBlend()
    else if (requestOnLand)
      requestBlend()
    requestOnLand = false
  }
  catch (err: any) {
    if (token === blendToken) {
      blendError.value = err?.message || 'Could not fit the airfoils.'
      requestOnLand = false
    }
  }
  finally {
    if (token === blendToken) {
      isBlendFitting.value = false
      blendHold.value = undefined
    }
  }
}
watch([blendA, blendB], () => {
  blendApplied.value = undefined
  requestOnLand = true
  fitBlend()
})
// Moves only while active, so the slider never discards other edits
watch(blendPct, () => {
  if (blendActive.value)
    applyBlend()
})
function setBlendPct(e: Event) {
  const el = e.target as HTMLInputElement
  const v = el.value === '' ? Number.NaN : Math.round(Number(el.value))
  if (Number.isFinite(v))
    blendPct.value = Math.min(100, Math.max(0, v))
  el.value = String(blendPct.value) // shows the clamped value, or the old one for empty input
}

function handleOrderUpdate(order: number) {
  const keep = blendKeeps.value
  params.value = { ...params.value, order, ...defaultCSTWeights(order) }
  blendHold.value = keep ? JSON.stringify(params.value) : undefined
  if (blendA.value && blendB.value)
    fitBlend()
}

function takeSnapshot() {
  const name = blendActive.value ? `${pickerName(blendA.value)} / ${pickerName(blendB.value)} ${blendPct.value}%` : undefined
  snapshots.value = addSnapshot(snapshots.value, params.value, name) ?? snapshots.value
}
function removeSnapshot(id: number) {
  snapshots.value = snapshots.value.filter(s => s.id !== id)
}
function loadSnapshot(s: DesignSnapshot) {
  params.value = cloneParams(s.params)
}

const CONFIRM = {
  load: { title: 'Load snapshot', color: 'primary' },
  delete: { title: 'Delete snapshot', color: 'error' },
  blend: { title: 'Apply blend', color: 'primary' },
} as const
const confirmKind = computed(() => CONFIRM[pending.value?.action ?? 'delete'])
function requestLoad(s: DesignSnapshot) {
  if (isUnsaved(params.value, snapshots.value))
    pending.value = { action: 'load', snapshot: s }
  else
    loadSnapshot(s)
}
function confirmPending() {
  if (pending.value?.action === 'load')
    loadSnapshot(pending.value.snapshot)
  else if (pending.value?.action === 'delete')
    removeSnapshot(pending.value.snapshot.id)
  else if (pending.value?.action === 'blend')
    applyBlend()
  pending.value = undefined
}

function coordinates(p: CSTParameters, n: number) {
  return generateCSTCoordinates(p.upperWeights, p.lowerWeights, p.leWeight, p.teThickness, p.order, n)
}

// Everything drawn and analysed: the snapshots in order, then the design being edited
const designs = computed(() => [
  ...snapshots.value.map(s => ({ key: `s${s.id}`, name: s.name, params: s.params, color: seriesColor(s.colorIndex + 1), visible: s.visible })),
  { key: 'current', name: 'Current', params: params.value, color: chartColors.primary, visible: true },
])
const shown = computed(() => designs.value.filter(d => d.visible))

const geometries = computed(() => shown.value.map(d => ({
  name: d.name,
  ...coordinates(d.params, 200),
  color: d.color,
  dashed: d.key !== 'current',
})))

// Analysis
const solver = ref<Solver>('neural')
const results = ref<Record<string, Polar>>({}) // by runKey; kept for this visit only
const ranWith = ref<{ solver: Solver; conditions: Conditions }>()
const isRunning = ref(false)
const runningName = ref('')
const error = ref<string | null>(null)
const mfoil = useMfoil()
let cancelled = false

const keyOf = (p: CSTParameters) => ranWith.value ? runKey(p, ranWith.value.solver, ranWith.value.conditions) : ''

async function runNeural(p: CSTParameters, c: Conditions): Promise<Polar> {
  const g = coordinates(p, 150)
  const res = await $fetch<Polar>(`${config.public.backendUrl}/api/analyze-transient`, {
    method: 'POST',
    body: {
      upper_x: g.upperX,
      upper_y: g.upperY,
      lower_x: g.lowerX,
      lower_y: g.lowerY,
      reynolds: c.reynolds * 1000,
      mach: c.mach,
      alpha_start: c.alphaStart,
      alpha_end: c.alphaEnd,
      alpha_step: c.alphaStep,
      n_crit: c.nCrit,
      airfoil_name: 'Airfoil Designer',
    },
  })
  if (![res?.alpha, res?.CL, res?.CD, res?.CM].every(Array.isArray))
    throw new Error('The analysis returned no polar.')
  return { alpha: res.alpha, CL: res.CL, CD: res.CD, CM: res.CM }
}

// Why a solver would refuse these conditions, or '' when it can run them
function refusal(s: Solver, c: Conditions) {
  const n = angleCount(c)
  if (s === 'mfoil' && c.mach >= 0.7)
    return 'mfoil needs a Mach number below 0.7.'
  const max = s === 'mfoil' ? MFOIL_MAX_ANGLES : NEURAL_MAX_ANGLES
  if (n > max)
    return `That is ${n} angles; ${s === 'mfoil' ? 'mfoil' : 'NeuralFoil'} is limited to ${max}.`
  return ''
}

function runMfoil(p: CSTParameters, c: Conditions): Promise<Polar> {
  const n = angleCount(c)
  const g = coordinates(p, 100)
  return new Promise((resolve, reject) => {
    mfoil.run({
      upperX: [...g.upperX].reverse(), // mfoil takes the upper surface TE -> LE
      upperY: [...g.upperY].reverse(),
      lowerX: g.lowerX,
      lowerY: g.lowerY,
      reynolds: c.reynolds * 1000,
      mach: c.mach,
      ncrit: c.nCrit,
      alphas: Array.from({ length: n }, (_, i) => Math.round((c.alphaStart + i * c.alphaStep) * 1e6) / 1e6),
      npanel: 120,
    })
    const stop = watch(mfoil.status, (status) => {
      if (status === 'running')
        return
      stop()
      if (status !== 'done')
        return reject(new Error(mfoil.error.value || 'Stopped'))
      const pts = mfoil.points.value.filter(pt => pt.converged)
      if (!pts.length)
        return reject(new Error('mfoil did not converge at any angle for this shape.'))
      resolve({ alpha: pts.map(pt => pt.alpha), CL: pts.map(pt => pt.cl), CD: pts.map(pt => pt.cd), CM: pts.map(pt => pt.cm) })
    })
  })
}

// Runs every shown design that has no result yet for this solver and these conditions
async function handleAnalyze(conditions: Conditions) {
  // Refuse before ranWith changes, so the results on screen stay
  error.value = refusal(solver.value, conditions) || null
  if (error.value)
    return
  ranWith.value = { solver: solver.value, conditions }
  lastConditions.value = conditions
  isRunning.value = true
  cancelled = false
  try {
    for (const d of shown.value) {
      const key = keyOf(d.params)
      if (cancelled)
        break
      if (results.value[key])
        continue
      runningName.value = d.name
      const polar = await (solver.value === 'neural' ? runNeural(d.params, conditions) : runMfoil(d.params, conditions))
      results.value = { ...results.value, [key]: polar }
    }
  }
  catch (err: any) {
    if (!cancelled)
      error.value = err?.data?.detail || err?.message || 'Analysis failed'
  }
  finally {
    isRunning.value = false
  }
}

function stopRun() {
  cancelled = true
  mfoil.stop()
}
onBeforeUnmount(stopRun)

const analysed = computed(() => shown.value.flatMap((d) => {
  const polar = results.value[keyOf(d.params)]
  return polar ? [{ ...d, polar }] : []
}))
const performanceData = computed(() => analysed.value.map(d => ({ name: d.name, color: d.color, ...d.polar })))
// A shown design with no polar for the last run: edited, added or stopped since
const stale = computed(() => !!ranWith.value && !isRunning.value && analysed.value.length < shown.value.length)
const runCaption = computed(() => ranWith.value && [
  SOLVERS.find(s => s.key === ranWith.value!.solver)!.label,
  `Re ${(ranWith.value.conditions.reynolds * 1000).toLocaleString('en-US')}`,
  `Mach ${ranWith.value.conditions.mach}`,
].join(' · '))
const stretch = ref(false) // off: equal x and y scale, true shape

// Differences are against the first analysed design (the oldest shown snapshot, else the current design)
const stats = computed(() => analysed.value.map(d => ({ key: d.key, name: d.name, color: d.color, ...polarStats(d.polar) })))
const STAT_COLUMNS = [
  { key: 'clMax', label: 'Max CL', digits: 3 },
  { key: 'ldMax', label: 'Max L/D', digits: 1 },
  { key: 'cdMin', label: 'Min CD', digits: 5 },
] as const
function delta(row: (typeof stats.value)[number], key: (typeof STAT_COLUMNS)[number]['key'], digits: number) {
  const base = stats.value[0]?.[key]?.value
  const value = row[key]?.value
  if (row === stats.value[0] || base == null || value == null)
    return ''
  const d = value - base
  return `${d >= 0 ? '+' : ''}${d.toFixed(digits)}`
}

const handleExportParameters = () => exportCSTParameters(params.value, 'CST_Airfoil')
const handleExportSelig = () => exportCoordinates(coordinates(params.value, 400), 'CST_Airfoil', 'CST_Airfoil', 'cst', 'selig')
</script>

<template>
  <div>
    <PageHeader
      title="Airfoil Designer"
      subtitle="Change the CST weights of an airfoil and compare the polars of each design"
      eyebrow="Tools"
    >
      <template #actions>
        <VButton color="light" size="sm" @click="handleExportParameters">
          <Icon name="heroicons:arrow-down-tray-20-solid" class="h-4 w-4 shrink-0" aria-hidden="true" />
          Parameters (CSV)
        </VButton>
        <VButton color="light" size="sm" @click="handleExportSelig">
          <Icon name="heroicons:arrow-down-tray-20-solid" class="h-4 w-4 shrink-0" aria-hidden="true" />
          Selig (.dat)
        </VButton>
      </template>
    </PageHeader>

    <!-- Small screens: Geometry first, so the shape stays in view above the sliders. Large: inputs left, results right. -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:grid-rows-[auto_1fr]">
      <!-- Inputs -->
      <div class="min-w-0 space-y-6 lg:row-span-2">
        <CSTParameterEditor
          :parameters="params"
          :refit-on-order-change="!blendKeeps"
          @update:parameters="params = $event"
          @update-order="handleOrderUpdate"
        >
          <VPanel title="Blend two airfoils" description="Mix two catalog airfoils into a new design.">
            <div class="space-y-3">
              <p class="text-xs text-gray-500">
                Blends the CST fits of both airfoils. Raise the weight count for a closer match.
              </p>
              <SparAirfoilSelector v-model="blendA" input-id="blend-airfoil-a" label="Airfoil A" :show-selection-summary="false" />
              <SparAirfoilSelector v-model="blendB" input-id="blend-airfoil-b" label="Airfoil B" :show-selection-summary="false" />
              <div>
                <div class="mb-1 flex items-center justify-between gap-3">
                  <label for="blend-mix" class="text-sm font-medium text-gray-700">Mix</label>
                  <span class="flex items-center gap-1 text-xs text-gray-500">
                    <input
                      id="blend-mix-pct"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      :value="blendPct"
                      :disabled="!blendFits || !blendActive"
                      aria-label="Mix percentage toward airfoil B"
                      class="num h-8 w-16 rounded-lg border border-gray-300 px-2 text-right text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                      @change="setBlendPct"
                    >
                    %
                  </span>
                </div>
                <input
                  id="blend-mix"
                  v-model.number="blendPct"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  :disabled="!blendFits || !blendActive"
                  :aria-valuetext="`${blendPct}% toward ${pickerName(blendB) || 'airfoil B'}`"
                  class="w-full cursor-pointer accent-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                <div class="mt-1 flex justify-between gap-3 text-xs text-gray-500" aria-hidden="true">
                  <span class="min-w-0 truncate" :title="pickerName(blendA)">{{ pickerName(blendA) || 'Airfoil A' }}</span>
                  <span class="min-w-0 truncate text-right" :title="pickerName(blendB)">{{ pickerName(blendB) || 'Airfoil B' }}</span>
                </div>
              </div>
              <p v-if="blendA && blendB && blendA.id === blendB.id" class="text-xs text-gray-500">
                Both picks are the same airfoil, so the mix has no effect.
              </p>
              <p v-if="isBlendFitting" class="text-xs text-gray-500" role="status">
                Fitting both airfoils…
              </p>
              <div v-else-if="blendFits && !blendActive" class="flex items-center justify-between gap-3">
                <p class="text-xs text-warning-700" role="status">
                  The design has changed since this blend.
                </p>
                <VButton type="button" color="light" size="sm" @click="requestBlend">
                  Reapply blend
                </VButton>
              </div>
              <VStateBlock v-if="blendError" variant="error" title="Could not fit the airfoils" :description="blendError" />
            </div>
          </VPanel>
        </CSTParameterEditor>

        <NACAAnalysisPanel
          :is-loading="isRunning"
          :initial-conditions="lastConditions"
          description="Runs every shown design under the same flow conditions. Designs already run are not repeated."
          @analyze="handleAnalyze"
        >
          <div class="mb-4 flex items-center justify-between gap-3">
            <span id="designer-solver" class="text-sm font-medium text-gray-700">Solver</span>
            <div class="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-labelledby="designer-solver">
              <button
                v-for="s in SOLVERS"
                :key="s.key"
                type="button"
                :class="tabButtonClasses(solver === s.key)"
                :aria-pressed="solver === s.key"
                :disabled="isRunning"
                @click="solver = s.key"
              >
                {{ s.label }}
              </button>
            </div>
          </div>
          <p class="mb-4 text-xs text-gray-500">
            {{ solver === 'neural' ? 'NeuralFoil: a neural-network model, run on our server. Fast.' : 'mfoil: a viscous panel solver, run in your browser. Slower, Mach below 0.7.' }}
          </p>
        </NACAAnalysisPanel>
      </div>

      <!-- Results -->
      <VPanel title="Geometry" class="order-first min-w-0 lg:order-none lg:col-span-2">
        <template #actions>
          <label class="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input v-model="stretch" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500">
            Stretch thickness
          </label>
        </template>
        <AirfoilGeometry
          :geometries="geometries"
          :show-legend="false"
          :aspect-ratio="4"
          :equal-scale="!stretch"
          :zoomable="true"
        />
      </VPanel>

      <div class="min-w-0 space-y-6 lg:col-span-2">
        <VPanel title="Design snapshots" description="A snapshot freezes the current weights so you can compare later changes against it. Saved in this browser only.">
          <ul v-if="snapshots.length" class="mb-4 divide-y divide-gray-200">
            <li v-for="s in snapshots" :key="s.id" class="flex items-center gap-2 py-2">
              <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: seriesColor(s.colorIndex + 1) }" aria-hidden="true" />
              <input
                v-model="s.name"
                type="text"
                maxlength="40"
                :aria-label="`Name of ${s.name}`"
                class="h-8 min-w-0 flex-1 rounded-lg border border-gray-300 px-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
              <VButton type="button" color="light" size="sm" :aria-pressed="s.visible" @click="s.visible = !s.visible">
                <Icon :name="s.visible ? 'heroicons:eye' : 'heroicons:eye-slash'" class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only sm:not-sr-only">{{ s.visible ? 'Shown' : 'Hidden' }}</span>
              </VButton>
              <VButton type="button" color="light" size="sm" title="Copy this snapshot's weights into the editor" @click="requestLoad(s)">
                <Icon name="heroicons:arrow-uturn-left" class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only sm:not-sr-only">Load</span>
              </VButton>
              <button
                type="button"
                class="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-error-500"
                :aria-label="`Delete ${s.name}`"
                @click="pending = { action: 'delete', snapshot: s }"
              >
                <Icon name="heroicons:trash" class="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          </ul>
          <div class="flex flex-wrap items-center gap-3">
            <VButton type="button" color="primary" size="sm" :disabled="snapshots.length >= MAX_SNAPSHOTS" @click="takeSnapshot">
              <Icon name="heroicons:camera" class="h-4 w-4" aria-hidden="true" />
              Take snapshot
            </VButton>
            <span class="text-xs text-gray-500"><span class="num">{{ snapshots.length }}</span> of {{ MAX_SNAPSHOTS }} used</span>
          </div>
        </VPanel>

        <VPanel title="Analysis results">
          <div v-if="isRunning" class="mb-4 flex items-center justify-between gap-3 text-sm text-gray-700" role="status">
            <span>
              Running {{ runningName }}<template v-if="solver === 'mfoil' && mfoil.progress.value.total">
                · angle <span class="num">{{ mfoil.progress.value.done }}</span> of <span class="num">{{ mfoil.progress.value.total }}</span>
              </template>…
            </span>
            <VButton type="button" color="light" size="sm" @click="stopRun">
              Stop
            </VButton>
          </div>
          <VStateBlock v-if="error" class="mb-4" variant="error" title="Analysis failed" :description="error" />
          <p v-else-if="stale" class="mb-4 text-xs text-warning-700" role="status">
            Some shown designs have no result for these conditions. Run the analysis to include them.
          </p>

          <template v-if="analysed.length">
            <p class="mb-3 text-xs text-gray-500">
              {{ runCaption }}
            </p>
            <AirfoilPolarPlots :performance-data="performanceData" :show-controls="true" />

            <div class="mt-6 overflow-x-auto">
              <table class="w-full text-sm">
                <caption class="sr-only">
                  Polar summary of each design, with the difference against {{ stats[0].name }}
                </caption>
                <thead>
                  <tr class="border-b border-gray-200 text-left">
                    <th scope="col" class="data-label py-2 pr-3">
                      Design
                    </th>
                    <th v-for="col in STAT_COLUMNS" :key="col.key" scope="col" class="data-label py-2 pl-3 text-right">
                      {{ col.label }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="row in stats" :key="row.key">
                    <th scope="row" class="py-2 pr-3 text-left font-medium text-gray-900">
                      <span class="mr-2 inline-block h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: row.color }" aria-hidden="true" />{{ row.name }}
                    </th>
                    <td v-for="col in STAT_COLUMNS" :key="col.key" class="num whitespace-nowrap py-2 pl-3 text-right text-gray-700">
                      <template v-if="row[col.key]">
                        {{ row[col.key]!.value.toFixed(col.digits) }}
                        <span class="text-xs text-gray-500">@ {{ row[col.key]!.alpha }}°</span>
                        <span v-if="delta(row, col.key, col.digits)" class="ml-1 text-xs font-medium text-primary-700">{{ delta(row, col.key, col.digits) }}</span>
                      </template>
                      <template v-else>
                        –
                      </template>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-if="stats.length > 1" class="mt-2 text-xs text-gray-500">
                Differences are against {{ stats[0].name }}.
              </p>
            </div>
          </template>
          <VStateBlock
            v-else-if="!isRunning && !error && !stale"
            icon="heroicons:chart-bar"
            title="No analysis yet"
            description="Take a snapshot, change the weights, then run an analysis to compare the polars."
          />
        </VPanel>
      </div>
    </div>

    <VModalConfirm
      :model-value="!!pending"
      :title="confirmKind.title"
      :confirm-label="confirmKind.title"
      :confirm-color="confirmKind.color"
      @update:model-value="pending = undefined"
      @confirm="confirmPending"
    >
      <p class="text-sm text-gray-700">
        <template v-if="pending?.action === 'load'">
          Load <span class="font-semibold">{{ pending.snapshot.name }}</span> into the editor? The current design is not in any snapshot and will be lost.
        </template>
        <template v-else-if="pending?.action === 'blend'">
          Replace the current design with the blend? The current design is not in any snapshot and will be lost.
        </template>
        <template v-else-if="pending">
          Delete <span class="font-semibold">{{ pending.snapshot.name }}</span>? This cannot be undone.
        </template>
      </p>
    </VModalConfirm>

    <VPanel title="About the Airfoil Designer" class="mt-6">
      <div class="max-w-3xl space-y-3 text-sm leading-relaxed text-gray-700">
        <p>
          The Airfoil Designer shows how a change in shape changes the flow results. Fit CST (Class Shape Transformation)
          weights to an airfoil from the catalog, take a snapshot, then move a weight and run the analysis again. The
          geometry, the lift, drag and moment polars, and a summary table are drawn for every design together.
        </p>
        <p>
          Two solvers are available: NeuralFoil, a neural-network model, and mfoil, a viscous panel method that runs in
          your browser. For more airfoil families see the
          <NuxtLink to="/tools/airfoil-generator" class="font-medium text-primary-600 hover:underline">
            Airfoil Generator
          </NuxtLink>;
          for boundary-layer detail see
          <NuxtLink to="/tools/numerical-analysis-2d" class="font-medium text-primary-600 hover:underline">
            Numerical Analysis 2D
          </NuxtLink>.
        </p>
      </div>
    </VPanel>
  </div>
</template>
