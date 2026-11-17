<script setup lang="ts">
import type { Database } from '~/types/database.types'
import { formatCategoryName } from '~/utils/categoryUtils'
import { compactNavTabButtonClasses } from '~/layers/ui/utils/buttons'

type Category = Database['public']['Tables']['categories']['Row']
interface Point { x: number; y: number }

definePageMeta({
  layout: 'default',
})

useHead({
  title: 'Upload Airfoil - Share Your Design | Airfolio',
  meta: [
    {
      name: 'description',
      content: 'Sign in or create a free account to upload custom airfoil coordinates and share them with the community. Paste or edit points with a live preview, or upload a CSV/DAT file.',
    },
  ],
})

const {
  validateCoordinates,
  validateAirfoilName,
  generateDataHash,
  storeTemporaryData,
  retrieveTemporaryData,
  retrieveLatestTemporaryData,
  clearTemporaryData,
  generateNormalizedName,
} = useAirfoilUpload()

const { fitCSTAirfoil } = useCSTParameters()
const { fetchCategories } = useCategories()

const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
// undefined until the session is read on the client; the SSG HTML never has one
const signedIn = ref<boolean>()

const MIN_POINTS_PER_SURFACE = 10
const MAX_POINTS_PER_SURFACE = 200

// Form state
const coordTab = ref<'file' | 'edit'>('file')
const geomTab = ref<'points' | 'cst'>('points')
const airfoilName = ref('')
const description = ref('')
const sourceUrl = ref('')
const selectedCategory = ref<string | undefined>()
// The textareas are the single source of truth for coordinates
const upperText = ref('')
const lowerText = ref('')

const allCategories = ref<Category[]>([])

// UI state
const showHelp = ref(false)
const isSubmitting = ref(false)
const nameError = ref('')
const csvError = ref('')
const submitError = ref('')

/** Parse "x y" / "x, y" lines; returns valid points and 1-based numbers of unparseable lines. */
function parsePoints(text: string) {
  const pts: Point[] = []
  const badLines: number[] = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim())
      return
    const [x, y] = line.trim().split(/[\s,;]+/).map(Number)
    if (Number.isFinite(x) && Number.isFinite(y))
      pts.push({ x, y })
    else
      badLines.push(i + 1)
  })
  return { pts, badLines }
}

const toText = (pts: Point[]) => pts.map(p => `${p.x} ${p.y}`).join('\n')

const upper = computed(() => parsePoints(upperText.value))
const lower = computed(() => parsePoints(lowerText.value))
const upperXs = computed(() => upper.value.pts.map(p => p.x))
const upperYs = computed(() => upper.value.pts.map(p => p.y))
const lowerXs = computed(() => lower.value.pts.map(p => p.x))
const lowerYs = computed(() => lower.value.pts.map(p => p.y))
const hasPoints = computed(() => upper.value.pts.length + lower.value.pts.length >= 2)

const coordErrors = computed(() => {
  const errs: Record<string, string> = {}
  const badLineMsg = (lines: number[]) => `Line${lines.length > 1 ? 's' : ''} ${lines.slice(0, 5).join(', ')}${lines.length > 5 ? '…' : ''} ${lines.length > 1 ? 'are' : 'is'} not a valid "x y" pair`
  if (upper.value.badLines.length)
    errs.upperSurface = badLineMsg(upper.value.badLines)
  if (lower.value.badLines.length)
    errs.lowerSurface = badLineMsg(lower.value.badLines)
  if (Object.keys(errs).length || !hasPoints.value)
    return errs
  for (const e of validateCoordinates(upper.value.pts, lower.value.pts).errors)
    errs[e.field] ??= e.message
  return errs
})

const canSubmit = computed(() =>
  airfoilName.value.trim().length > 0
  && !nameError.value
  && Object.keys(coordErrors.value).length === 0
  && upper.value.pts.length >= MIN_POINTS_PER_SURFACE
  && lower.value.pts.length >= MIN_POINTS_PER_SURFACE,
)

async function checkName() {
  const name = airfoilName.value.trim()
  if (!name) {
    nameError.value = 'Airfoil name is required'
    return
  }
  const result = await validateAirfoilName(name)
  // Ignore stale responses if the name changed while the check was in flight
  if (name === airfoilName.value.trim())
    nameError.value = result.valid ? '' : (result.message || 'Invalid name')
}
watch(airfoilName, checkName)

// --- CST fit ---------------------------------------------------------------
const cstWeights = ref(8)
const cstPointsPerSurface = ref(100)

const cstFit = computed(() => {
  if (geomTab.value !== 'cst' || upper.value.badLines.length || lower.value.badLines.length)
    return null
  // Fit needs at least as many points as unknowns (2 * weights + 2)
  if (upper.value.pts.length < 2 || lower.value.pts.length < 2 || upper.value.pts.length + lower.value.pts.length < 2 * cstWeights.value + 2)
    return null
  // fitCSTAirfoil expects upper TE→LE and lower LE→TE (and returns that ordering); flip a surface entered
  // the other way, but don't sort, which would scramble a cambered nose that dips below the LE x
  const u = upper.value.pts[0].x < upper.value.pts.at(-1)!.x ? [...upper.value.pts].reverse() : upper.value.pts
  const l = lower.value.pts[0].x > lower.value.pts.at(-1)!.x ? [...lower.value.pts].reverse() : lower.value.pts
  const n = Math.min(Math.max(Math.round(cstPointsPerSurface.value) || 0, MIN_POINTS_PER_SURFACE), MAX_POINTS_PER_SURFACE)
  return fitCSTAirfoil(u.map(q => q.x), u.map(q => q.y), l.map(q => q.x), l.map(q => q.y), cstWeights.value, n - 1)
})

function applyCstFit() {
  const fit = cstFit.value
  if (!fit)
    return
  const round = (v: number) => Number(v.toFixed(6))
  const upperPts = fit.upperX.map((x, i) => ({ x: round(x), y: round(fit.upperY[i]) }))
  const lowerPts = fit.lowerX.map((x, i) => ({ x: round(x), y: round(fit.lowerY[i]) }))
  upperText.value = toText(upperPts)
  lowerText.value = toText(lowerPts)
  geomTab.value = 'points'
  coordTab.value = 'edit'
}

// --- Loading / drafts ------------------------------------------------------
function restoreFromDraft(data: {
  name: string
  displayName?: string
  description?: string
  upperSurface: Point[]
  lowerSurface: Point[]
  sourceUrl?: string
  categoryId?: string
}) {
  airfoilName.value = data.displayName || data.name
  description.value = data.description || ''
  sourceUrl.value = data.sourceUrl || ''
  selectedCategory.value = data.categoryId
  upperText.value = toText(data.upperSurface)
  lowerText.value = toText(data.lowerSurface)
  coordTab.value = 'edit'
}

onMounted(async () => {
  signedIn.value = !!(await supabase.auth.getSession()).data.session

  try {
    allCategories.value = await fetchCategories()
  }
  catch (err) {
    console.error('Error fetching categories:', err)
  }

  const queryHash = typeof route.query.hash === 'string' ? route.query.hash : null
  const draft = queryHash
    ? (() => {
        const data = retrieveTemporaryData(queryHash)
        return data ? { hash: queryHash, data } : null
      })()
    : retrieveLatestTemporaryData()

  if (draft)
    restoreFromDraft(draft.data)
})

function handleCsvLoad(data: { upper: Point[]; lower: Point[]; airfoilName?: string }) {
  csvError.value = ''
  upperText.value = toText(data.upper)
  lowerText.value = toText(data.lower)
  if (data.airfoilName)
    airfoilName.value = data.airfoilName
  coordTab.value = 'edit'
}

async function handleSubmit() {
  await checkName()
  if (!canSubmit.value)
    return

  isSubmitting.value = true
  submitError.value = ''

  try {
    const displayName = airfoilName.value.trim()
    const uploadData = {
      name: generateNormalizedName(displayName),
      displayName,
      description: description.value.trim() || undefined,
      upperSurface: upper.value.pts,
      lowerSurface: lower.value.pts,
      sourceUrl: sourceUrl.value.trim() || undefined,
      categoryId: selectedCategory.value || undefined,
    }

    const hash = generateDataHash(uploadData)
    storeTemporaryData(hash, uploadData)
    await router.push(`/upload/confirmation?hash=${hash}`)
  }
  catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Failed to submit'
  }
  finally {
    isSubmitting.value = false
  }
}

function resetForm() {
  const latest = retrieveLatestTemporaryData()
  if (latest)
    clearTemporaryData(latest.hash)

  airfoilName.value = ''
  description.value = ''
  sourceUrl.value = ''
  selectedCategory.value = undefined
  upperText.value = ''
  lowerText.value = ''
  nameError.value = ''
  csvError.value = ''
  submitError.value = ''
  coordTab.value = 'file'
  geomTab.value = 'points'
}

const surfaces = computed(() => [
  { key: 'upperSurface', label: 'Upper surface', short: 'Upper', hint: 'TE → LE', model: upperText, count: upper.value.pts.length },
  { key: 'lowerSurface', label: 'Lower surface', short: 'Lower', hint: 'LE → TE', model: lowerText, count: lower.value.pts.length },
])
</script>

<template>
  <div>
    <PageHeader title="Upload Airfoil" subtitle="Share your airfoil design with the community. Sign in to upload.">
      <template #actions>
        <VButton type="button" color="light" @click="showHelp = true">
          <Icon name="heroicons:question-mark-circle" class="h-5 w-5" aria-hidden="true" />
          How to Upload
        </VButton>
      </template>
    </PageHeader>

    <UploadSteps :current="1" />

    <VPanel v-if="signedIn === undefined">
      <VStateBlock variant="loading" title="Checking sign-in..." />
    </VPanel>

    <VPanel v-else-if="!signedIn">
      <VStateBlock icon="heroicons:lock-closed" title="Sign in to upload" description="Sign in or create a free account to share airfoils with the community.">
        <VButton color="primary" to="/login?redirect=/upload">
          Sign in
        </VButton>
      </VStateBlock>
    </VPanel>

    <form v-else novalidate @submit.prevent>
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Coordinates -->
        <VPanel title="Coordinates" description="Load a file, then fine-tune the points by hand.">
          <div class="mb-4 flex gap-2 border-b border-gray-200" role="tablist" aria-label="Coordinate input method">
            <button
              type="button"
              role="tab"
              :aria-selected="coordTab === 'file'"
              :class="compactNavTabButtonClasses(coordTab === 'file')"
              @click="coordTab = 'file'"
            >
              Upload file
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="coordTab === 'edit'"
              :class="compactNavTabButtonClasses(coordTab === 'edit')"
              @click="coordTab = 'edit'"
            >
              Edit points
            </button>
          </div>

          <div v-show="coordTab === 'file'" class="space-y-3">
            <UploadCsvUpload @load="handleCsvLoad" @error="csvError = $event" />
            <p v-if="csvError" class="text-sm text-error-600" role="alert">
              {{ csvError }}
            </p>
          </div>

          <div v-show="coordTab === 'edit'">
            <p class="mb-3 text-xs text-gray-500">
              One point per line as <code class="num">x y</code> or <code class="num">x, y</code>. Paste straight from a spreadsheet; the plot updates as you type.
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <div v-for="s in surfaces" :key="s.key">
                <label :for="s.key" class="mb-1.5 flex items-baseline justify-between text-sm font-medium text-gray-700">
                  <span>{{ s.label }} <span class="font-normal text-gray-500">({{ s.hint }})</span></span>
                  <span class="num text-xs" :class="s.count >= MIN_POINTS_PER_SURFACE ? 'text-success-600' : 'text-gray-500'">
                    {{ s.count }} pts
                  </span>
                </label>
                <textarea
                  :id="s.key"
                  v-model="s.model.value"
                  rows="14"
                  spellcheck="false"
                  wrap="off"
                  placeholder="1.0 0.0&#10;0.95 0.0062&#10;..."
                  class="num w-full resize-y rounded-lg border px-3 py-2 font-mono text-xs leading-5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1"
                  :class="coordErrors[s.key] ? 'border-error-400 focus:border-error-500 focus:ring-error-500' : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'"
                  :aria-invalid="coordErrors[s.key] ? 'true' : undefined"
                  :aria-describedby="coordErrors[s.key] ? `${s.key}-error` : undefined"
                />
                <p v-if="coordErrors[s.key]" :id="`${s.key}-error`" class="mt-1 text-xs text-error-600" role="alert">
                  {{ coordErrors[s.key] }}
                </p>
              </div>
            </div>
          </div>
        </VPanel>

        <!-- Geometry -->
        <div>
          <VPanel title="Geometry" class="lg:sticky lg:top-20">
            <div class="mb-4 flex gap-2 border-b border-gray-200" role="tablist" aria-label="Geometry view">
              <button
                type="button"
                role="tab"
                :aria-selected="geomTab === 'points'"
                :class="compactNavTabButtonClasses(geomTab === 'points')"
                @click="geomTab = 'points'"
              >
                Points
              </button>
              <button
                type="button"
                role="tab"
                :aria-selected="geomTab === 'cst'"
                :class="compactNavTabButtonClasses(geomTab === 'cst')"
                @click="geomTab = 'cst'"
              >
                CST fit
              </button>
            </div>

            <div v-if="geomTab === 'cst'" class="mb-4 space-y-3">
              <p class="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900">
                If you digitized these points from a paper or plot, it is recommended you use a CST fit to smooth them before upload.
                The fit is shown over your points; apply it to replace them with evenly spaced (cosine) points.
              </p>
              <div class="flex flex-wrap items-end gap-4">
                <div>
                  <label for="cst-weights" class="mb-1 block text-xs font-medium text-gray-700">Weights per surface</label>
                  <select
                    id="cst-weights"
                    v-model.number="cstWeights"
                    class="h-9 w-20 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option v-for="n in 9" :key="n" :value="n + 3">
                      {{ n + 3 }}
                    </option>
                  </select>
                </div>
                <div>
                  <label for="cst-points" class="mb-1 block text-xs font-medium text-gray-700">Points per surface</label>
                  <VInput
                    id="cst-points"
                    v-model.number="cstPointsPerSurface"
                    type="number"
                    :min="MIN_POINTS_PER_SURFACE"
                    :max="MAX_POINTS_PER_SURFACE"
                    wrapper-class="w-28"
                  />
                </div>
                <VButton type="button" color="primary" size="sm" class="ml-auto" :disabled="!cstFit" @click="applyCstFit">
                  <Icon name="heroicons:sparkles-20-solid" class="h-4 w-4" aria-hidden="true" />
                  Replace points with CST fit
                </VButton>
              </div>
              <p class="text-xs text-gray-500">
                Fewer weights give a smoother curve; more weights follow the points more closely (and their noise).
              </p>
            </div>

            <BezierFitPlot
              v-if="hasPoints"
              :original-upper-x="upperXs"
              :original-upper-y="upperYs"
              :original-lower-x="lowerXs"
              :original-lower-y="lowerYs"
              :fitted-upper-x="cstFit?.upperX"
              :fitted-upper-y="cstFit?.upperY"
              :fitted-lower-x="cstFit?.lowerX"
              :fitted-lower-y="cstFit?.lowerY"
            />
            <VStateBlock
              v-else
              icon="heroicons:pencil-square"
              title="No points yet"
              description="Upload a file or paste coordinates to see the airfoil."
            />

            <dl class="mt-4 grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
              <VStat v-for="s in surfaces" :key="s.key" :label="`${s.short} points`">
                <span class="inline-flex items-center gap-1.5">
                  {{ s.count }}
                  <Icon
                    :name="s.count >= MIN_POINTS_PER_SURFACE ? 'heroicons:check-circle-20-solid' : 'heroicons:x-circle-20-solid'"
                    class="h-4 w-4"
                    :class="s.count >= MIN_POINTS_PER_SURFACE ? 'text-success-600' : 'text-gray-400'"
                    aria-hidden="true"
                  />
                  <span class="sr-only">{{ s.count >= MIN_POINTS_PER_SURFACE ? '(meets minimum)' : '(below minimum)' }}</span>
                </span>
              </VStat>
            </dl>
            <p class="mt-2 text-xs text-gray-500">
              <span class="num">{{ MIN_POINTS_PER_SURFACE }}</span>–<span class="num">{{ MAX_POINTS_PER_SURFACE }}</span> points per surface.
            </p>
          </VPanel>
        </div>

        <!-- Details -->
        <VPanel title="Details" class="lg:col-span-2">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="name" class="mb-1.5 block text-sm font-medium text-gray-700">
                Airfoil name <span class="text-error-600" aria-hidden="true">*</span>
              </label>
              <VInput
                id="name"
                v-model="airfoilName"
                type="text"
                placeholder="e.g., NACA-2412"
                wrapper-class="w-full"
                required
                :error="!!nameError"
                :aria-invalid="nameError ? 'true' : undefined"
                :aria-describedby="nameError ? 'name-error' : undefined"
              />
              <p v-if="nameError" id="name-error" class="mt-1 text-sm text-error-600">
                {{ nameError }}
              </p>
            </div>

            <div>
              <label for="category" class="mb-1.5 block text-sm font-medium text-gray-700">
                Category <span class="font-normal text-gray-500">(optional)</span>
              </label>
              <select
                id="category"
                v-model="selectedCategory"
                class="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">
                  No category
                </option>
                <option v-for="category in allCategories" :key="category.id" :value="category.id">
                  {{ formatCategoryName(category.name) }}
                </option>
              </select>
            </div>

            <div class="sm:col-span-2">
              <label for="sourceUrl" class="mb-1.5 block text-sm font-medium text-gray-700">
                Source URL <span class="font-normal text-gray-500">(optional)</span>
              </label>
              <VInput
                id="sourceUrl"
                v-model="sourceUrl"
                type="url"
                placeholder="https://example.com/airfoil"
                wrapper-class="w-full"
              />
            </div>

            <div class="sm:col-span-2">
              <label for="description" class="mb-1.5 block text-sm font-medium text-gray-700">
                Description <span class="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                id="description"
                v-model="description"
                placeholder="Brief description of your airfoil..."
                class="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                rows="3"
              />
            </div>
          </div>
        </VPanel>
      </div>

      <!-- Sticky action bar -->
      <div class="sticky bottom-0 z-20 mt-6 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
        <div v-if="submitError" class="mb-3 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-800" role="alert">
          {{ submitError }}
        </div>
        <div class="flex items-center justify-between gap-3">
          <VButton type="button" color="light" @click="resetForm">
            Reset
          </VButton>
          <VButton
            type="button"
            color="primary"
            :disabled="!canSubmit || isSubmitting"
            @click="handleSubmit"
          >
            {{ isSubmitting ? 'Processing...' : 'Continue to review' }}
            <Icon v-if="!isSubmitting" name="heroicons:arrow-right-20-solid" class="h-4 w-4" aria-hidden="true" />
          </VButton>
        </div>
      </div>
    </form>

    <UploadHelpModal :is-open="showHelp" @close="showHelp = false" />
  </div>
</template>
