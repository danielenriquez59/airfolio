<script setup lang="ts">
import type { Database } from '~/types/database.types'
import type { NACA6Params } from '~/composables/useNACAGenerator'
import SparAirfoilSelector from '~/layers/landing/components/spar/SparAirfoilSelector.vue'
import AirfoilPolarPlots from '~/components/analysis/AirfoilPolarPlots.vue'
import MfoilDistributionPlots from '~/components/analysis/MfoilDistributionPlots.vue'
import { summarizePolar } from '~/composables/useMfoil'
import { type MfoilSlot, useMfoilRuns } from '~/composables/useMfoilRuns'
import { smoothAirfoilCST } from '~/composables/useCSTParameters'
import { sanitizeFilename, triggerDownload } from '~/composables/useAirfoilDownload'
import NACAParameterEditor from '~/layers/landing/components/naca/NACAParameterEditor.vue'
import { type NACASpec, SERIES, canonicalAirfoilName, isGeneratedAirfoil, mfoilRunKey, nacaFileBase, nacaParamText, nacaSpecAirfoil, parseNACASpec } from '~/utils/nacaSpec'
import { navTabButtonClasses, tabButtonClasses, toggleButtonClasses } from '~/layers/ui/utils/buttons'

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

const MAX_ANGLES = 100
const MAX_AIRFOILS = 3

const route = useRoute()
const router = useRouter()
const { fetchAirfoilByName } = useAirfoils()
// A naca4:/naca5:/naca6: name is a generated airfoil, never a library lookup
async function fetchSlotAirfoil(name: string) {
  if (!isGeneratedAirfoil(name))
    return fetchAirfoilByName(name)
  const spec = parseNACASpec(name)
  if (!spec)
    throw new Error('Unknown NACA specification')
  return nacaSpecAirfoil(spec)
}
const { slots, latest, sync, runAll, stopAll } = useMfoilRuns(MAX_AIRFOILS, fetchSlotAirfoil)

// Airfoils: the repeated ?airfoil= query is the source of truth, in list order; the picker and remove write to it
const queryNames = computed(() => [...new Set([route.query.airfoil ?? []].flat().filter((n): n is string => !!n).map(canonicalAirfoilName))])
watch(queryNames, names => sync(names))
onMounted(() => sync(queryNames.value))

function setNames(names: string[]) {
  const { airfoil: _drop, ...rest } = route.query
  router.replace({ query: names.length ? { ...rest, airfoil: names } : rest })
}

const picked = ref<Airfoil | null>(null)
const adding = ref(false)
watch(picked, (a) => {
  if (!a)
    return
  picked.value = null
  adding.value = false
  const names = slots.value.map(s => s.name)
  if (!names.includes(a.name))
    setNames([...names, a.name])
})
const removeSlot = (s: MfoilSlot) => setNames(slots.value.filter(x => x.id !== s.id).map(x => x.name))
const pickerOpen = computed(() => !slots.value.length || (adding.value && slots.value.length < MAX_AIRFOILS))

// Airfoil source: the library picker or a NACA generator; start values are the generator page's
type Source = 'library' | NACASpec['kind']
const SOURCES = [['naca4', 'NACA 4'], ['naca5', 'NACA 5'], ['naca6', 'NACA 6'], ['library', 'Library']] as const
const source = ref<Source>('library')
const naca = reactive({
  naca4: { m: 0.02, p: 0.4, t: 0.12 },
  naca5: { cl: 0.3, p: 0.15, t: 0.12, isReflex: false },
  naca6: { family: '64', t: 0.12, cl: 0.2, a: 1 } as NACA6Params,
})
const draft = computed(() => {
  const s = source.value
  return s === 'library' || !pickerOpen.value ? null : nacaSpecAirfoil({ kind: s, params: naca[s] } as NACASpec)
})
const draftBlocked = computed(() => {
  if (!draft.value)
    return null
  if (slots.value.length >= MAX_AIRFOILS)
    return `Limit of ${MAX_AIRFOILS} airfoils.`
  if (slots.value.some(s => s.name === draft.value!.name))
    return 'This airfoil is already loaded.'
  return null
})
function addDraft() {
  if (!draft.value || draftBlocked.value)
    return
  setNames([...slots.value.map(s => s.name), draft.value.name])
  adding.value = false
}

const label = (s: MfoilSlot) => s.airfoil?.display_name || s.airfoil?.name || s.name
// Library names read in capitals; generated designations keep their case (6-series a=0.5 is not the A family)
const caps = (x: { id: number }) => (isGeneratedAirfoil(slots.value.find(s => s.id === x.id)?.name ?? '') ? '' : 'uppercase')
const color = (s: MfoilSlot) => seriesColor(s.colorIndex)
// Names round (m 0.004 is NACA 0012 like m 0): a generated slot sharing its label shows its values
const paramText = (s: MfoilSlot) => (slots.value.some(x => x.id !== s.id && label(x) === label(s)) ? nacaParamText(s.name) : null)
const loaded = computed(() => slots.value.filter(s => s.airfoil))
const geometries = computed(() => [...loaded.value.map(s => ({
  name: label(s),
  color: color(s),
  upperX: s.airfoil!.upper_x_coordinates ?? [],
  upperY: s.airfoil!.upper_y_coordinates ?? [],
  lowerX: s.airfoil!.lower_x_coordinates ?? [],
  lowerY: s.airfoil!.lower_y_coordinates ?? [],
})), ...(draft.value
  ? [{
      name: draft.value.display_name!,
      color: chartColors.tick,
      dashed: true,
      upperX: draft.value.upper_x_coordinates!,
      upperY: draft.value.upper_y_coordinates!,
      lowerX: draft.value.lower_x_coordinates!,
      lowerY: draft.value.lower_y_coordinates!,
    }]
  : [])])

// Flow conditions
const reynolds = ref(1e6)
const mach = ref(0)
const ncrit = ref(9)
const alphaMin = ref(-4)
const alphaMax = ref(14)
const alphaStep = ref(0.5)
const npanel = ref<120 | 199>(120)
const smooth = ref(false)
// Shown unless every loaded airfoil is generated; hiding it clears it so a later library airfoil starts raw
const showSmooth = computed(() => !slots.value.length || slots.value.some(s => !isGeneratedAirfoil(s.name)))
watch(showSmooth, (v) => {
  if (!v)
    smooth.value = false
})

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

const isRunning = computed(() => slots.value.some(s => s.mfoil.status.value === 'running'))
const tab = ref<'polars' | 'op'>('polars')
const followLatest = ref(true) // selected angle follows the latest finished point until the user picks one
// A slot already finished for its key is not rerun
const conditions = computed(() => [reynolds.value, mach.value, ncrit.value, alphas.value, npanel.value])

function geometryFor(a: Airfoil) {
  const geom = { upperX: a.upper_x_coordinates!, upperY: a.upper_y_coordinates ?? [], lowerX: a.lower_x_coordinates!, lowerY: a.lower_y_coordinates ?? [] }
  if (smooth.value && !isGeneratedAirfoil(a.name)) { // generated sections are smooth already
    try {
      const s = smoothAirfoilCST(geom.upperX, geom.upperY, geom.lowerX, geom.lowerY)
      return { upperX: s.upperX, upperY: s.upperY, lowerX: s.lowerX, lowerY: s.lowerY }
    }
    catch {} // fit failed: run the raw coordinates
  }
  return geom
}

function startRun() {
  if (!loaded.value.length || inputError.value)
    return
  followLatest.value = true
  runAll(a => mfoilRunKey(conditions.value, smooth.value, a.name), a => ({
    ...geometryFor(a),
    reynolds: reynolds.value,
    mach: mach.value,
    ncrit: ncrit.value,
    alphas: alphas.value,
    npanel: npanel.value,
  }))
}

const points = (s: MfoilSlot) => s.mfoil.points.value
const pointAt = (s: MfoilSlot, alpha: number | undefined) => points(s).find(p => p.alpha === alpha)
const hasResults = computed(() => slots.value.some(s => points(s).length))
const visibleSlots = computed(() => slots.value.filter(s => s.visible))
const firstError = computed(() => slots.value.map(s => s.mfoil.error.value).find(e => e) ?? undefined)

const polarData = computed(() => visibleSlots.value.map((s) => {
  const c = points(s).filter(p => p.converged)
  return { name: label(s), color: color(s), alpha: c.map(p => p.alpha), CL: c.map(p => p.cl), CD: c.map(p => p.cd), CM: c.map(p => p.cm) }
}).filter(d => d.alpha.length))

// One angle selector over every angle any slot has a result for
const angles = computed(() => [...new Set(slots.value.flatMap(s => points(s).map(p => p.alpha)))].sort((x, y) => x - y))
const pickedAlpha = ref<number | null>(null)
const selectedIndex = computed({
  get: () => {
    const i = angles.value.indexOf((followLatest.value ? latest.value?.alpha : pickedAlpha.value) ?? Number.NaN)
    return i >= 0 ? i : angles.value.length - 1
  },
  set: (i: number) => {
    followLatest.value = false
    pickedAlpha.value = angles.value[i] ?? null
  },
})
const selectedAlpha = computed(() => angles.value[selectedIndex.value])
const opSeries = computed(() => visibleSlots.value.flatMap((s) => {
  const point = pointAt(s, selectedAlpha.value)
  return point ? [{ id: s.id, name: label(s), color: color(s), point }] : []
}))
function showAngle(alpha: number) {
  followLatest.value = false
  pickedAlpha.value = alpha
  tab.value = 'op'
}

const lastPoint = computed(() => {
  const l = latest.value
  const s = l ? slots.value.find(x => x.id === l.id) : undefined
  const p = s && l ? pointAt(s, l.alpha) : undefined
  return s && p ? { id: s.id, name: label(s), p } : null
})

const fmt = (v: number | null | undefined, d: number) => ((v == null || !Number.isFinite(v)) ? '—' : v.toFixed(d))
const ld = (p: { cl: number; cd: number }) => (p.cd > 0 ? p.cl / p.cd : Number.NaN)

const summaryRows = computed(() => {
  const sums = loaded.value.map(s => summarizePolar(points(s)))
  const at = (x: { alpha: number } | null) => (x ? `at α = ${x.alpha}°` : undefined)
  return [
    { label: 'CL max', hint: undefined, cells: sums.map(x => ({ value: fmt(x.clMax?.value, 3), hint: at(x.clMax) })) },
    { label: 'Max L/D', hint: undefined, cells: sums.map(x => ({ value: fmt(x.ldMax?.value, 1), hint: at(x.ldMax) })) },
    { label: 'CD min', hint: undefined, cells: sums.map(x => ({ value: fmt(x.cdMin?.value, 5), hint: at(x.cdMin) })) },
    { label: 'Lift slope (/deg)', hint: 'Fit over −5° to 5°', cells: sums.map(x => ({ value: fmt(x.liftSlope, 4), hint: undefined })) },
    { label: 'Zero-lift angle (deg)', hint: undefined, cells: sums.map(x => ({ value: fmt(x.alphaZeroLift, 2), hint: undefined })) },
  ]
})

const progressText = computed(() => {
  const ran = slots.value.map(s => s.mfoil).filter(m => m.status.value !== 'idle')
  const sum = (f: (m: MfoilSlot['mfoil']) => number) => ran.reduce((n, m) => n + f(m), 0)
  const done = sum(m => m.progress.value.done)
  const total = sum(m => m.progress.value.total)
  const status = ran.map(m => m.status.value)
  if (status.includes('running'))
    return `${done} of ${total} angles`
  if (status.includes('stopped'))
    return `Stopped after ${done} of ${total} angles`
  if (status.includes('done'))
    return `Finished: ${sum(m => m.points.value.filter(p => p.converged).length)} of ${total} angles converged`
  return null // nothing run, or every run failed: the rows say why
})

// Results table: its own airfoil filter, separate from the plot show/hide
const tableHidden = ref<number[]>([])
const toggleTable = (id: number) => {
  tableHidden.value = tableHidden.value.includes(id) ? tableHidden.value.filter(x => x !== id) : [...tableHidden.value, id]
}
const withResults = computed(() => slots.value.filter(s => points(s).length))
const tableSlots = computed(() => withResults.value.filter(s => !tableHidden.value.includes(s.id)))
const tableRows = computed(() => tableSlots.value.flatMap(s => points(s).map(p => ({ s, p }))))

const csvField = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
function downloadCSV() {
  const head = ['airfoil', 'alpha', 'CL', 'CD', 'CDp', 'CDf', 'CM', 'L/D', 'xtr_upper', 'xtr_lower', 'converged']
  const rows = tableRows.value.map(({ s, p }) => [csvField(label(s)), ...[p.alpha, p.cl, p.cd, p.cdp, p.cdf, p.cm, ld(p), p.xtrUpper, p.xtrLower, p.converged]
    .map(v => ((typeof v === 'number' && !Number.isFinite(v)) ? '' : String(v)))].join(','))
  const one = tableSlots.value.length === 1 ? tableSlots.value[0].name : null
  const spec = one ? parseNACASpec(one) : null
  const base = spec ? nacaFileBase(spec) : one ? sanitizeFilename(one) : 'airfoils'
  triggerDownload([head.join(','), ...rows].join('\n'), `${base}_mfoil_Re${reynolds.value}.csv`)
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Tools"
      title="Numerical Analysis 2D"
    >
      <template #subtitle>
        Run a viscous polar with <a
          href="https://websites.umich.edu/kfid/codes.html"
          target="_blank"
          rel="noopener noreferrer"
          class="font-medium text-primary-600 underline hover:text-primary-700"
        >mfoil</a>, an XFOIL-style panel and boundary-layer solver, entirely in your browser.
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Inputs -->
      <div class="min-w-0 space-y-6">
        <VPanel title="Airfoil">
          <ul v-if="slots.length" class="mb-3 space-y-2" aria-label="Loaded airfoils">
            <li v-for="s in slots" :key="s.id" class="flex items-center gap-2 text-sm">
              <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: color(s) }" aria-hidden="true" />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium text-gray-900" :class="caps(s)">
                  {{ label(s) }}
                </div>
                <p v-if="paramText(s)" class="num truncate text-xs text-gray-500">
                  {{ paramText(s) }}
                </p>
                <p v-if="s.loading" class="flex items-center gap-1 text-xs text-gray-500">
                  <Icon name="heroicons:arrow-path" class="h-3 w-3 animate-spin" aria-hidden="true" />
                  Loading airfoil
                </p>
                <p v-else-if="s.loadError" class="text-xs text-error-700">
                  {{ s.loadError }}
                </p>
                <p v-else-if="s.mfoil.status.value === 'error'" class="text-xs text-error-700" role="alert">
                  {{ s.mfoil.error.value || 'The run failed.' }}
                </p>
              </div>
              <button
                v-if="s.airfoil"
                type="button"
                class="rounded p-1 text-gray-500 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                :aria-pressed="s.visible"
                :aria-label="`Show ${label(s)} on plots`"
                @click="s.visible = !s.visible"
              >
                <Icon :name="s.visible ? 'heroicons:eye' : 'heroicons:eye-slash'" class="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="rounded p-1 text-gray-500 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                :aria-label="`Remove ${label(s)}`"
                @click="removeSlot(s)"
              >
                <Icon name="heroicons:x-mark-20-solid" class="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          </ul>
          <VButton
            v-if="slots.length"
            type="button"
            color="light"
            size="sm"
            :disabled="slots.length >= MAX_AIRFOILS"
            :aria-expanded="adding"
            @click="adding = !adding"
          >
            {{ slots.length >= MAX_AIRFOILS ? `Limit of ${MAX_AIRFOILS} airfoils` : '+ Load another airfoil' }}
          </VButton>
          <div v-if="pickerOpen" :class="slots.length && 'mt-3'">
            <div class="mb-3 grid grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Airfoil source">
              <button
                v-for="opt in SOURCES"
                :key="opt[0]"
                type="button"
                class="justify-center"
                :class="tabButtonClasses(source === opt[0])"
                :aria-pressed="source === opt[0]"
                @click="source = opt[0]"
              >
                {{ opt[1] }}
              </button>
            </div>
            <SparAirfoilSelector v-if="source === 'library'" v-model="picked" :show-selection-summary="false" />
            <template v-else>
              <NACAParameterEditor
                embedded
                :series-type="SERIES[source]"
                :naca4-params="naca.naca4"
                :naca5-params="naca.naca5"
                :naca6-params="naca.naca6"
                :naca-name="draft?.display_name ?? ''"
                @update:naca4-params="naca.naca4 = $event"
                @update:naca5-params="naca.naca5 = $event"
                @update:naca6-params="naca.naca6 = $event"
              />
              <VButton
                type="button"
                color="primary"
                size="sm"
                class="mt-4"
                :disabled="!!draftBlocked"
                :aria-describedby="draftBlocked ? 'mf-add-reason' : undefined"
                @click="addDraft"
              >
                Add to analysis
              </VButton>
              <p v-if="draftBlocked" id="mf-add-reason" class="mt-2 text-xs text-gray-500">
                {{ draftBlocked }}
              </p>
            </template>
          </div>
          <div v-if="showSmooth" class="mt-3 flex items-center gap-1.5">
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
          <div v-if="geometries.length" class="mt-4">
            <AirfoilGeometry :geometries="geometries" :aspect-ratio="3" />
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

          <div class="mt-5 border-t border-gray-200 pt-4">
            <VButton v-if="isRunning" type="button" color="light" block @click="stopAll">
              <Icon name="heroicons:stop" class="h-4 w-4" aria-hidden="true" />
              Stop
            </VButton>
            <VButton
              v-else
              type="button"
              color="primary"
              block
              :disabled="!loaded.length || !!inputError"
              :aria-describedby="inputError ? 'mf-run-reason' : undefined"
              @click="startRun"
            >
              <Icon name="heroicons:play" class="h-4 w-4" aria-hidden="true" />
              Run viscous polar
            </VButton>
            <p v-if="inputError" id="mf-run-reason" class="mt-2 text-xs text-error-700">
              {{ inputError }}
            </p>
            <p v-else-if="!loaded.length" class="mt-2 text-xs text-gray-500">
              Pick an airfoil to run.
            </p>
            <p v-else-if="progressText" class="mt-2 flex items-center gap-1.5 text-xs text-gray-600" role="status">
              <Icon v-if="isRunning" name="heroicons:arrow-path" class="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {{ progressText }}
            </p>
            <p v-else class="mt-2 text-xs text-gray-500">
              {{ alphas.length }} angles
            </p>
            <p
              v-if="isRunning && lastPoint"
              class="mt-1 text-xs"
              :class="lastPoint.p.converged ? 'text-gray-600' : 'text-warning-700'"
              aria-live="polite"
            >
              <span :class="caps(lastPoint)">{{ lastPoint.name }}</span> AoA {{ lastPoint.p.alpha }}° {{ lastPoint.p.converged ? 'converged' : 'not converged' }}
            </p>
          </div>
        </VPanel>
      </div>

      <!-- Results -->
      <div class="min-w-0 space-y-6 lg:col-span-2">
        <VPanel flush>
          <div class="flex gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-gray-200 px-2 sm:px-3" role="tablist">
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
            <div v-if="hasResults" class="mb-4 flex flex-wrap gap-2" aria-label="Show airfoils on plots">
              <button
                v-for="s in withResults"
                :key="s.id"
                type="button"
                :class="toggleButtonClasses(s.visible)"
                :aria-pressed="s.visible"
                @click="s.visible = !s.visible"
              >
                <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: color(s) }" aria-hidden="true" />
                <span :class="caps(s)">{{ label(s) }}</span>
              </button>
            </div>

            <VStateBlock v-if="!loaded.length" icon="heroicons:magnifying-glass" title="Pick an airfoil" description="Search the database on the left, then run the analysis." />
            <VStateBlock v-else-if="!hasResults && isRunning" variant="loading" title="Running mfoil" description="Results fill in as each angle finishes." />
            <VStateBlock v-else-if="!hasResults && firstError" variant="error" title="Analysis failed" :description="firstError" />
            <VStateBlock v-else-if="!hasResults" icon="heroicons:chart-bar" title="No results yet" description="Set the flow conditions, then run the viscous polar." />
            <VStateBlock v-else-if="!withResults.some(s => s.visible)" icon="heroicons:eye-slash" title="All airfoils are hidden" description="Turn an airfoil back on above to plot it." />
            <!-- v-if, not v-show: charts mount when their tab is visible, so canvases never size to zero -->
            <template v-else-if="tab === 'polars'">
              <AirfoilPolarPlots v-if="polarData.length" :performance-data="polarData" :show-explanation="false" :show-legend="false" />
              <VStateBlock v-else icon="heroicons:chart-bar" title="No converged points yet" />
            </template>
            <div v-else-if="selectedAlpha !== undefined" class="space-y-4">
              <div class="flex flex-wrap items-center gap-2">
                <VButton type="button" color="light" size="sm" :disabled="selectedIndex <= 0" aria-label="Previous angle" @click="selectedIndex--">
                  <Icon name="heroicons:chevron-left" class="h-4 w-4" aria-hidden="true" />
                </VButton>
                <span class="num min-w-[4.5rem] text-center text-sm font-medium text-gray-900">
                  α = {{ selectedAlpha }}°
                </span>
                <VButton type="button" color="light" size="sm" :disabled="selectedIndex >= angles.length - 1" aria-label="Next angle" @click="selectedIndex++">
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
                :max="angles.length - 1"
                step="1"
                class="w-full accent-primary-600"
                aria-label="Angle of attack"
              >
              <ul class="space-y-1 text-sm text-gray-600">
                <li v-for="o in opSeries" :key="o.id" class="flex flex-wrap items-center gap-x-5 gap-y-1">
                  <span class="flex min-w-0 items-center gap-1.5 font-medium text-gray-900">
                    <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: o.color }" aria-hidden="true" />
                    <span class="truncate" :class="caps(o)">{{ o.name }}</span>
                  </span>
                  <VBadge v-if="!o.point.converged" tone="warning">
                    Not converged
                  </VBadge>
                  <span>CL <span class="num text-gray-900">{{ fmt(o.point.converged ? o.point.cl : NaN, 4) }}</span></span>
                  <span>CD <span class="num text-gray-900">{{ fmt(o.point.converged ? o.point.cd : NaN, 5) }}</span></span>
                  <span>CM <span class="num text-gray-900">{{ fmt(o.point.converged ? o.point.cm : NaN, 4) }}</span></span>
                </li>
              </ul>
              <MfoilDistributionPlots :series="opSeries" />
            </div>
          </div>
        </VPanel>

        <template v-if="hasResults">
          <VPanel title="Summary" description="From converged points" flush>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-gray-50">
                  <tr class="border-b border-gray-200">
                    <th scope="col" class="data-label px-3 py-2 text-left" />
                    <th v-for="s in loaded" :key="s.id" scope="col" class="data-label whitespace-nowrap px-3 py-2 text-right">
                      <span class="inline-flex items-center gap-1.5">
                        <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: color(s) }" aria-hidden="true" />
                        <span :class="caps(s)">{{ label(s) }}</span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 bg-white">
                  <tr v-for="r in summaryRows" :key="r.label">
                    <th scope="row" class="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-700">
                      {{ r.label }}
                      <div v-if="r.hint" class="text-xs font-normal text-gray-500">
                        {{ r.hint }}
                      </div>
                    </th>
                    <td v-for="(c, j) in r.cells" :key="j" class="whitespace-nowrap px-3 py-2 text-right">
                      <div class="num text-gray-900">
                        {{ c.value }}
                      </div>
                      <div v-if="c.hint" class="text-xs text-gray-500">
                        {{ c.hint }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </VPanel>

          <VPanel title="Results" flush>
            <template #actions>
              <VButton type="button" color="light" size="sm" :disabled="!tableRows.length" @click="downloadCSV">
                <Icon name="heroicons:arrow-down-tray" class="h-4 w-4" aria-hidden="true" />
                Download CSV
              </VButton>
            </template>
            <div class="flex flex-wrap gap-2 border-b border-gray-200 px-3 py-3" aria-label="Show airfoils in the table">
              <button
                v-for="s in withResults"
                :key="s.id"
                type="button"
                :class="toggleButtonClasses(!tableHidden.includes(s.id))"
                :aria-pressed="!tableHidden.includes(s.id)"
                @click="toggleTable(s.id)"
              >
                <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: color(s) }" aria-hidden="true" />
                <span :class="caps(s)">{{ label(s) }}</span>
              </button>
            </div>
            <div class="max-h-[28rem] overflow-auto">
              <table class="min-w-full text-sm">
                <thead class="sticky top-0 z-10 bg-gray-50">
                  <tr class="border-b border-gray-200">
                    <th scope="col" class="data-label whitespace-nowrap px-3 py-2 text-left">
                      Airfoil
                    </th>
                    <th v-for="h in ['Alpha (deg)', 'CL', 'CD', 'CDp', 'CDf', 'CM', 'L/D', 'xtr upper', 'xtr lower']" :key="h" scope="col" class="data-label whitespace-nowrap px-3 py-2 text-right">
                      {{ h }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 bg-white">
                  <tr
                    v-for="{ s, p } in tableRows"
                    :key="`${s.id}-${p.alpha}`"
                    class="cursor-pointer hover:bg-gray-50"
                    :class="[p.converged ? 'text-gray-700' : 'bg-warning-50 text-gray-400', p.alpha === selectedAlpha && 'font-semibold']"
                    :title="p.reason ? `Not converged: ${p.reason}` : undefined"
                    @click="showAngle(p.alpha)"
                  >
                    <td class="whitespace-nowrap px-3 py-1.5">
                      <span class="inline-flex items-center gap-1.5">
                        <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: color(s) }" aria-hidden="true" />
                        <span :class="caps(s)">{{ label(s) }}</span>
                      </span>
                    </td>
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
