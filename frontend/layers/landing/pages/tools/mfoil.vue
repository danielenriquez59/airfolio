<script setup lang="ts">
import type { Database } from '~/types/database.types'
import SparAirfoilSelector from '~/layers/landing/components/spar/SparAirfoilSelector.vue'
import AirfoilPolarPlots from '~/components/analysis/AirfoilPolarPlots.vue'
import MfoilDistributionPlots from '~/components/analysis/MfoilDistributionPlots.vue'
import { summarizePolar, useMfoil } from '~/composables/useMfoil'
import { smoothAirfoilCST } from '~/composables/useCSTParameters'
import { sanitizeFilename, triggerDownload } from '~/composables/useAirfoilDownload'
import { navTabButtonClasses, tabButtonClasses } from '~/layers/ui/utils/buttons'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

definePageMeta({
  layout: 'detail',
})

useSeoMeta({
  title: 'Numerical Analysis 2D - Airfoil Polars with mfoil',
  description: 'Run a viscous airfoil polar with mfoil, an XFOIL-style panel and boundary-layer solver, directly in your browser. Live polars, pressure and boundary-layer distributions.',
  ogTitle: 'Numerical Analysis 2D - Airfoil Polars with mfoil',
  ogDescription: 'Viscous airfoil polars with mfoil, computed in the browser.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

const MAX_ANGLES = 40

const route = useRoute()
const router = useRouter()
const { fetchAirfoilByName } = useAirfoils()
const { points: results, status, progress, error: runError, latestAlpha, run, stop, reset } = useMfoil()

// Airfoil: the ?airfoil= query is the source of truth; the picker writes to it
const selected = ref<Airfoil | null>(null)
const airfoil = ref<Airfoil | null>(null)
const loading = ref(false)
const loadError = ref<string | null>(null)

async function loadAirfoil(name: string | undefined) {
  reset() // results belong to the airfoil they were run for
  loadError.value = null
  loading.value = !!name
  if (!name) {
    airfoil.value = null
    selected.value = null
    return
  }
  const stale = () => name !== route.query.airfoil // a newer pick superseded this load
  try {
    const data = await fetchAirfoilByName(name)
    if (stale())
      return
    if (!data?.upper_x_coordinates?.length || !data.lower_x_coordinates?.length) {
      airfoil.value = null
      loadError.value = data ? 'This airfoil has no geometry data' : 'Airfoil not found'
      return
    }
    airfoil.value = data
    selected.value = data
  }
  catch (err: unknown) {
    if (stale())
      return
    airfoil.value = null
    loadError.value = err instanceof Error ? err.message : 'Failed to load airfoil'
  }
  finally {
    if (!stale())
      loading.value = false
  }
}

watch(selected, (a) => {
  if ((a?.name ?? undefined) === (route.query.airfoil || undefined))
    return
  const { airfoil: _drop, ...rest } = route.query
  router.replace({ query: a ? { ...rest, airfoil: a.name } : rest })
})
watch(() => route.query.airfoil as string | undefined, name => loadAirfoil(name))
onMounted(() => loadAirfoil(route.query.airfoil as string | undefined))

// Flow conditions
const reynolds = ref(1e6)
const mach = ref(0)
const ncrit = ref(9)
const alphaMin = ref(-4)
const alphaMax = ref(14)
const alphaStep = ref(1)
const npanel = ref<120 | 199>(120)
const smooth = ref(false)

const alphas = computed(() => {
  const n = Math.floor((alphaMax.value - alphaMin.value) / alphaStep.value + 1e-9) + 1
  return Array.from({ length: n }, (_, i) => Math.round((alphaMin.value + i * alphaStep.value) * 1e6) / 1e6)
})

const inputError = computed(() => {
  const nums = [reynolds.value, mach.value, ncrit.value, alphaMin.value, alphaMax.value, alphaStep.value]
  if (nums.some(v => typeof v !== 'number' || !Number.isFinite(v)))
    return 'Fill in every flow condition.'
  if (reynolds.value <= 0)
    return 'Reynolds number must be positive.'
  if (mach.value < 0 || mach.value >= 0.7)
    return 'Mach must be between 0 and 0.7.'
  if (ncrit.value <= 0)
    return 'N-crit must be positive.'
  if (alphaMin.value >= alphaMax.value)
    return 'α min must be less than α max.'
  if (alphaStep.value <= 0)
    return 'α step must be positive.'
  if (alphas.value.length > MAX_ANGLES)
    return `That is ${alphas.value.length} angles; the limit is ${MAX_ANGLES}.`
  return null
})

const isRunning = computed(() => status.value === 'running')
const tab = ref<'polars' | 'op'>('polars')
const followLatest = ref(true) // selected angle follows the latest finished point until the user picks one

function startRun() {
  const a = airfoil.value
  if (!a || inputError.value)
    return
  followLatest.value = true
  let geom = { upperX: a.upper_x_coordinates!, upperY: a.upper_y_coordinates ?? [], lowerX: a.lower_x_coordinates!, lowerY: a.lower_y_coordinates ?? [] }
  if (smooth.value) {
    try {
      const s = smoothAirfoilCST(geom.upperX, geom.upperY, geom.lowerX, geom.lowerY)
      geom = { upperX: s.upperX, upperY: s.upperY, lowerX: s.lowerX, lowerY: s.lowerY }
    }
    catch {} // fit failed: run the raw coordinates
  }
  run({
    ...geom,
    reynolds: reynolds.value,
    mach: mach.value,
    ncrit: ncrit.value,
    alphas: alphas.value,
    npanel: npanel.value,
  })
}

const converged = computed(() => results.value.filter(p => p.converged))
const airfoilLabel = computed(() => airfoil.value?.display_name || airfoil.value?.name || '')

const polarData = computed(() => [{
  name: airfoilLabel.value,
  alpha: converged.value.map(p => p.alpha),
  CL: converged.value.map(p => p.cl),
  CD: converged.value.map(p => p.cd),
  CM: converged.value.map(p => p.cm),
}])

const summary = computed(() => summarizePolar(results.value))

const pickedAlpha = ref<number | null>(null)
const selectedIndex = computed({
  get: () => {
    const target = followLatest.value ? latestAlpha.value : pickedAlpha.value
    const i = results.value.findIndex(p => p.alpha === target)
    return i >= 0 ? i : results.value.length - 1
  },
  set: (i: number) => {
    followLatest.value = false
    pickedAlpha.value = results.value[i]?.alpha ?? null
  },
})
const selectedPoint = computed(() => results.value[selectedIndex.value] ?? null)

const fmt = (v: number | null | undefined, d: number) => ((v == null || !Number.isFinite(v)) ? '—' : v.toFixed(d))
const ld = (p: { cl: number; cd: number }) => (p.cd > 0 ? p.cl / p.cd : NaN)

const progressText = computed(() => {
  const { done, total } = progress.value
  if (status.value === 'running')
    return `${done} of ${total} angles`
  if (status.value === 'done')
    return `Finished: ${converged.value.length} of ${total} angles converged`
  if (status.value === 'stopped')
    return `Stopped after ${done} of ${total} angles`
  return null
})

function downloadCSV() {
  const head = ['alpha', 'CL', 'CD', 'CDp', 'CDf', 'CM', 'L/D', 'xtr_upper', 'xtr_lower', 'converged']
  const rows = results.value.map(p => [p.alpha, p.cl, p.cd, p.cdp, p.cdf, p.cm, ld(p), p.xtrUpper, p.xtrLower, p.converged]
    .map(v => ((typeof v === 'number' && !Number.isFinite(v)) ? '' : String(v))).join(','))
  triggerDownload([head.join(','), ...rows].join('\n'), `${sanitizeFilename(airfoil.value?.name ?? 'airfoil')}_mfoil_Re${reynolds.value}.csv`)
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Tools"
      title="Numerical Analysis 2D"
      subtitle="Run a viscous polar with mfoil, an XFOIL-style panel and boundary-layer solver, entirely in your browser. Nothing is sent to a server."
    />

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Inputs -->
      <div class="min-w-0 space-y-6">
        <VPanel title="Airfoil">
          <SparAirfoilSelector v-model="selected" />
          <div class="mt-4">
            <VStateBlock v-if="loading" variant="loading" title="Loading airfoil" />
            <VStateBlock v-else-if="loadError" variant="error" title="Could not load airfoil" :description="loadError" />
            <AirfoilGeometry
              v-else-if="airfoil"
              :upper-x="airfoil.upper_x_coordinates ?? []"
              :upper-y="airfoil.upper_y_coordinates ?? []"
              :lower-x="airfoil.lower_x_coordinates ?? []"
              :lower-y="airfoil.lower_y_coordinates ?? []"
              :aspect-ratio="3"
            />
          </div>
        </VPanel>

        <VPanel title="Flow conditions">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="mf-re" class="mb-1.5 block text-sm font-medium text-gray-700">Reynolds number</label>
              <VInput id="mf-re" v-model.number="reynolds" type="number" step="100000" min="1" class="num" />
            </div>
            <div>
              <label for="mf-mach" class="mb-1.5 block text-sm font-medium text-gray-700">Mach</label>
              <VInput id="mf-mach" v-model.number="mach" type="number" step="0.05" min="0" max="0.69" class="num" />
            </div>
            <div>
              <label for="mf-ncrit" class="mb-1.5 block text-sm font-medium text-gray-700">N-crit</label>
              <VInput id="mf-ncrit" v-model.number="ncrit" type="number" step="0.5" min="0.5" class="num" />
            </div>
            <div>
              <label for="mf-astep" class="mb-1.5 block text-sm font-medium text-gray-700">α step (deg)</label>
              <VInput id="mf-astep" v-model.number="alphaStep" type="number" step="0.5" min="0.1" class="num" />
            </div>
            <div>
              <label for="mf-amin" class="mb-1.5 block text-sm font-medium text-gray-700">α min (deg)</label>
              <VInput id="mf-amin" v-model.number="alphaMin" type="number" step="1" class="num" />
            </div>
            <div>
              <label for="mf-amax" class="mb-1.5 block text-sm font-medium text-gray-700">α max (deg)</label>
              <VInput id="mf-amax" v-model.number="alphaMax" type="number" step="1" class="num" />
            </div>
          </div>

          <div class="mt-4">
            <span id="mf-panels" class="mb-1.5 block text-sm font-medium text-gray-700">Panels</span>
            <div class="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1" role="radiogroup" aria-labelledby="mf-panels">
              <button
                v-for="opt in ([[120, 'fast'], [199, 'fine']] as const)"
                :key="opt[0]"
                type="button"
                role="radio"
                :aria-checked="npanel === opt[0]"
                class="justify-center"
                :class="tabButtonClasses(npanel === opt[0])"
                @click="npanel = opt[0]"
              >
                {{ opt[0] }} <span class="text-gray-500">{{ opt[1] }}</span>
              </button>
            </div>
          </div>

          <div class="mt-4 flex items-center gap-1.5">
            <label class="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
              <input v-model="smooth" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500">
              Smooth airfoil
            </label>
            <div class="group relative">
              <button
                type="button"
                class="flex rounded-full text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="About Smooth airfoil"
                aria-describedby="mf-smooth-tip"
              >
                <Icon name="heroicons:information-circle" class="h-4 w-4" aria-hidden="true" />
              </button>
              <div
                id="mf-smooth-tip"
                role="tooltip"
                class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
              >
                CST fit airfoil
                <div class="absolute left-1/2 top-full -mt-1 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>

          <div class="mt-5 border-t border-gray-200 pt-4">
            <VButton v-if="isRunning" type="button" color="light" block @click="stop">
              <Icon name="heroicons:stop" class="h-4 w-4" aria-hidden="true" />
              Stop
            </VButton>
            <VButton
              v-else
              type="button"
              color="primary"
              block
              :disabled="!airfoil || !!inputError"
              :aria-describedby="inputError ? 'mf-run-reason' : undefined"
              @click="startRun"
            >
              <Icon name="heroicons:play" class="h-4 w-4" aria-hidden="true" />
              Run viscous polar
            </VButton>
            <p v-if="inputError" id="mf-run-reason" class="mt-2 text-xs text-error-700">
              {{ inputError }}
            </p>
            <p v-else-if="!airfoil" class="mt-2 text-xs text-gray-500">
              Pick an airfoil to run.
            </p>
            <p v-else-if="progressText" class="mt-2 flex items-center gap-1.5 text-xs text-gray-600" role="status">
              <Icon v-if="isRunning" name="heroicons:arrow-path" class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {{ progressText }}
            </p>
            <p v-else class="mt-2 text-xs text-gray-500">
              {{ alphas.length }} angles
            </p>
            <p v-if="status === 'error'" class="mt-2 text-xs text-error-700" role="alert">
              {{ runError || 'The run failed.' }}
            </p>
          </div>
        </VPanel>
      </div>

      <!-- Results -->
      <div class="min-w-0 space-y-6 lg:col-span-2">
        <VPanel flush>
          <div class="flex gap-2 overflow-x-auto whitespace-nowrap border-b border-gray-200 px-2 sm:px-3" role="tablist">
            <button
              v-for="t in ([['polars', 'Polars'], ['op', 'Op. Point']] as const)"
              :key="t[0]"
              type="button"
              role="tab"
              :aria-selected="tab === t[0]"
              :class="navTabButtonClasses(tab === t[0])"
              @click="tab = t[0]"
            >
              {{ t[1] }}
            </button>
          </div>

          <div class="p-4 sm:p-5">
            <VStateBlock v-if="!airfoil" icon="heroicons:magnifying-glass" title="Pick an airfoil" description="Search the database on the left, then run the analysis." />
            <VStateBlock v-else-if="!results.length && isRunning" variant="loading" title="Running mfoil" description="Results fill in as each angle finishes." />
            <VStateBlock v-else-if="!results.length && status === 'error'" variant="error" title="Analysis failed" :description="runError || undefined" />
            <VStateBlock v-else-if="!results.length" icon="heroicons:chart-bar" title="No results yet" description="Set the flow conditions, then run the viscous polar." />
            <!-- v-if, not v-show: charts mount when their tab is visible, so canvases never size to zero -->
            <template v-else-if="tab === 'polars'">
              <p class="mb-3 text-xs text-gray-500">
                Converged points only
              </p>
              <AirfoilPolarPlots v-if="converged.length" :performance-data="polarData" />
              <VStateBlock v-else icon="heroicons:chart-bar" title="No converged points yet" />
            </template>
            <div v-else-if="selectedPoint" class="space-y-4">
              <div class="flex flex-wrap items-center gap-2">
                <VButton type="button" color="light" size="sm" :disabled="selectedIndex <= 0" aria-label="Previous angle" @click="selectedIndex--">
                  <Icon name="heroicons:chevron-left" class="h-4 w-4" aria-hidden="true" />
                </VButton>
                <span class="num min-w-[4.5rem] text-center text-sm font-medium text-gray-900">
                  α = {{ selectedPoint.alpha }}°
                </span>
                <VButton type="button" color="light" size="sm" :disabled="selectedIndex >= results.length - 1" aria-label="Next angle" @click="selectedIndex++">
                  <Icon name="heroicons:chevron-right" class="h-4 w-4" aria-hidden="true" />
                </VButton>
                <VButton v-if="!followLatest && isRunning" type="button" color="light" size="sm" @click="followLatest = true">
                  Follow latest
                </VButton>
              </div>
              <input
                v-model.number="selectedIndex"
                type="range"
                min="0"
                :max="results.length - 1"
                step="1"
                class="w-full accent-primary-600"
                aria-label="Angle of attack"
              >
              <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-600">
                <VBadge v-if="!selectedPoint.converged" tone="warning">
                  Not converged
                </VBadge>
                <span>CL <span class="num text-gray-900">{{ fmt(selectedPoint.converged ? selectedPoint.cl : NaN, 4) }}</span></span>
                <span>CD <span class="num text-gray-900">{{ fmt(selectedPoint.converged ? selectedPoint.cd : NaN, 5) }}</span></span>
                <span>CM <span class="num text-gray-900">{{ fmt(selectedPoint.converged ? selectedPoint.cm : NaN, 4) }}</span></span>
              </div>
              <MfoilDistributionPlots :point="selectedPoint" />
            </div>
          </div>
        </VPanel>

        <template v-if="results.length">
          <VPanel title="Summary" description="From converged points">
            <dl class="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <VStat label="CL max" :value="fmt(summary.clMax?.value, 3)" :hint="summary.clMax ? `at α = ${summary.clMax.alpha}°` : undefined" />
              <VStat label="Max L/D" :value="fmt(summary.ldMax?.value, 1)" :hint="summary.ldMax ? `at α = ${summary.ldMax.alpha}°` : undefined" />
              <VStat label="CD min" :value="fmt(summary.cdMin?.value, 5)" :hint="summary.cdMin ? `at α = ${summary.cdMin.alpha}°` : undefined" />
              <VStat label="Lift slope" :value="fmt(summary.liftSlope, 4)" unit="/deg" hint="Fit over −5° to 5°" />
              <VStat label="Zero-lift angle" :value="fmt(summary.alphaZeroLift, 2)" unit="deg" />
            </dl>
          </VPanel>

          <VPanel title="Results" flush>
            <template #actions>
              <VButton type="button" color="light" size="sm" :disabled="!results.length" @click="downloadCSV">
                <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" aria-hidden="true" />
                Download CSV
              </VButton>
            </template>
            <div class="max-h-[28rem] overflow-auto">
              <table class="min-w-full text-sm">
                <thead class="sticky top-0 z-10 bg-gray-50">
                  <tr class="border-b border-gray-200">
                    <th v-for="h in ['Alpha (deg)', 'CL', 'CD', 'CDp', 'CDf', 'CM', 'L/D', 'xtr upper', 'xtr lower']" :key="h" scope="col" class="data-label whitespace-nowrap px-3 py-2 text-right">
                      {{ h }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 bg-white">
                  <tr
                    v-for="(p, i) in results"
                    :key="p.alpha"
                    class="cursor-pointer hover:bg-gray-50"
                    :class="[p.converged ? 'text-gray-700' : 'bg-warning-50 text-gray-400', i === selectedIndex && 'font-semibold']"
                    :title="p.reason ? `Not converged: ${p.reason}` : undefined"
                    @click="selectedIndex = i; tab = 'op'"
                  >
                    <td class="num whitespace-nowrap px-3 py-1.5 text-right">
                      <Icon v-if="!p.converged" name="heroicons:exclamation-triangle" class="mr-1 h-3.5 w-3.5 text-warning-600" aria-label="Not converged" />
                      {{ p.alpha }}
                    </td>
                    <td v-for="([v, d], j) in ([[p.cl, 4], [p.cd, 5], [p.cdp, 5], [p.cdf, 5], [p.cm, 4], [ld(p), 1], [p.xtrUpper, 3], [p.xtrLower, 3]] as const)" :key="j" class="num px-3 py-1.5 text-right">
                      {{ fmt(p.converged ? v : NaN, d) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </VPanel>
        </template>
      </div>
    </div>
  </div>
</template>
