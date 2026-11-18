<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import type { Database } from '~/types/database.types'
import type { Aircraft, Assignment } from '~/composables/useAircraftAdmin'
import { AIRCRAFT_PAGE_SIZE, useAircraftAdmin } from '~/composables/useAircraftAdmin'
import { AIRCRAFT_CATEGORIES, AIRCRAFT_POSITIONS, AIRCRAFT_SURFACES, aircraftKey, sortAssignments, sourceLinks } from '~/utils/aircraftAdmin'
import SparAirfoilSelector from '~/layers/landing/components/spar/SparAirfoilSelector.vue'

definePageMeta({
  layout: 'detail',
})

useHead({
  title: 'Aircraft Manager - Airfolio',
})

type Airfoil = Database['public']['Tables']['airfoils']['Row']
type Item = { text: string, value: string }
type Status = 'idle' | 'saving' | 'saved' | 'error'

const {
  listAircraft,
  getAircraftByKey,
  createAircraft,
  updateAircraft,
  deleteAircraft,
  listAssignments,
  addAssignment,
  updateAssignment,
  deleteAssignment,
} = useAircraftAdmin()
const route = useRoute()
const router = useRouter()

const toItems = (values: string[]): Item[] => values.map(v => ({ text: v, value: v }))
const CATEGORY_ITEMS: Item[] = [{ text: 'None', value: '' }, ...toItems(AIRCRAFT_CATEGORIES)]
const SURFACE_ITEMS = toItems(AIRCRAFT_SURFACES)
const POSITION_ITEMS = toItems(AIRCRAFT_POSITIONS)
// a surface outside the known list still shows as its own item
const itemFor = (items: Item[], value: string) => items.find(i => i.value === value) ?? (value ? { text: value, value } : undefined)
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))
const labelOf = (a: Aircraft) => a.display_name || a.name

// ---- Aircraft list (server-side search and paging) ----
const searchInput = ref('')
const query = ref('')
const hiddenOnly = ref(false)
const page = ref(1)
const list = ref<Aircraft[]>([])
const total = ref(0)
const listLoading = ref(true)
const listError = ref('')
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / AIRCRAFT_PAGE_SIZE)))

let listRequest = 0
const loadList = async () => {
  const id = ++listRequest
  listLoading.value = true
  listError.value = ''
  try {
    const { rows, count } = await listAircraft(query.value, hiddenOnly.value, page.value)
    if (id !== listRequest) return // a newer search has started
    list.value = rows
    total.value = count
  }
  catch (e) {
    if (id === listRequest) listError.value = messageOf(e)
  }
  finally {
    if (id === listRequest) listLoading.value = false
  }
}

const replaceInList = (a: Aircraft) => {
  list.value = list.value.map(x => (x.id === a.id ? a : x))
}

// ---- Selected aircraft ----
const selected = ref<Aircraft | null>(null)
const form = reactive({ display_name: '', category: '', year: '' as string | number, country: '' })
const aircraftStatus = ref<Status>('idle')
const aircraftError = ref('')
const hiddenRev = ref(0)

const aircraftPatch = () => {
  const year = String(form.year).trim()
  return {
    display_name: form.display_name.trim() || null,
    category: form.category || null,
    year: year === '' ? null : Number(year),
    country: form.country.trim() || null,
  }
}
const aircraftDirty = computed(() => {
  const a = selected.value
  if (!a) return false
  const p = aircraftPatch()
  return p.display_name !== a.display_name || p.category !== a.category || p.year !== a.year || p.country !== a.country
})

const selectAircraft = (a: Aircraft) => {
  selected.value = a
  Object.assign(form, { display_name: a.display_name ?? '', category: a.category ?? '', year: a.year ?? '', country: a.country ?? '' })
  aircraftStatus.value = 'idle'
  aircraftError.value = ''
  loadAssignments(a.id)
}

const runAircraft = async (patch: Database['public']['Tables']['aircraft']['Update']) => {
  const a = selected.value
  if (!a) return
  aircraftStatus.value = 'saving'
  aircraftError.value = ''
  try {
    const saved = await updateAircraft(a.id, patch)
    if (selected.value?.id === saved.id) selected.value = saved
    replaceInList(saved)
    aircraftStatus.value = 'saved'
  }
  catch (e) {
    aircraftStatus.value = 'error'
    aircraftError.value = messageOf(e)
    hiddenRev.value++ // put the Hidden switch back to the stored value
  }
}

const saveAircraft = () => {
  if (!aircraftDirty.value) return // Enter in a field submits the form
  const patch = aircraftPatch()
  if (patch.year !== null && !Number.isInteger(patch.year)) {
    aircraftStatus.value = 'error'
    aircraftError.value = 'Year must be a whole number.'
    return
  }
  runAircraft(patch)
}

// ---- New aircraft ----
const showNew = ref(false)
const newForm = reactive({ name: '', display_name: '', category: '' })
const newError = ref('')
const creating = ref(false)
const newKey = computed(() => aircraftKey(newForm.name))

const openNew = () => {
  Object.assign(newForm, { name: '', display_name: '', category: '' })
  newError.value = ''
  showNew.value = true
}

const createNew = async () => {
  if (!newForm.name.trim()) return (newError.value = 'Name is required.')
  if (!newKey.value) return (newError.value = 'The name must contain at least one letter or digit.')
  creating.value = true
  newError.value = ''
  try {
    const a = await createAircraft({
      key: newKey.value,
      name: newForm.name.trim(),
      display_name: newForm.display_name.trim() || null,
      category: newForm.category || null,
    })
    showNew.value = false
    selectAircraft(a)
    loadList()
  }
  catch (e) {
    newError.value = messageOf(e)
  }
  finally {
    creating.value = false
  }
}

// ---- Delete aircraft ----
const showDelete = ref(false)
const deleting = ref(false)
const deleteError = ref('')

const openDelete = () => {
  deleteError.value = ''
  showDelete.value = true
}

const confirmDeleteAircraft = async () => {
  const a = selected.value
  if (!a) return
  deleting.value = true
  deleteError.value = ''
  try {
    await deleteAircraft(a.id)
    showDelete.value = false
    selected.value = null
    rows.value = []
    loadList()
  }
  catch (e) {
    deleteError.value = messageOf(e)
  }
  finally {
    deleting.value = false
  }
}

// ---- Assigned airfoils: one editable state per row so saving one never touches the others ----
interface RowState {
  row: Assignment
  draft: { airfoil_name: string, surface: string, position: string, thickness: string | number }
  status: Status
  error: string
  rev: number
}

const rows = ref<RowState[]>([])
const rowsLoading = ref(false)
const rowsError = ref('')
// saved values decide the order, so a row does not jump while it is being edited
const sortedRows = computed(() =>
  sortAssignments(rows.value.map(r => ({ surface: r.row.surface, position: r.row.position, r }))).map(x => x.r))

const toRowState = (row: Assignment): RowState => ({
  row,
  draft: { airfoil_name: row.airfoil_name, surface: row.surface, position: row.position, thickness: row.thickness_pct ?? '' },
  status: 'idle',
  error: '',
  rev: 0,
})

const loadAssignments = async (aircraftId: string) => {
  rows.value = []
  rowsLoading.value = true
  rowsError.value = ''
  try {
    const data = await listAssignments(aircraftId)
    if (selected.value?.id === aircraftId) rows.value = data.map(toRowState)
  }
  catch (e) {
    if (selected.value?.id === aircraftId) rowsError.value = messageOf(e)
  }
  finally {
    if (selected.value?.id === aircraftId) rowsLoading.value = false
  }
}

const rowPatch = (r: RowState) => {
  const t = String(r.draft.thickness).trim()
  return {
    airfoil_name: r.draft.airfoil_name.trim(),
    surface: r.draft.surface,
    position: r.draft.position,
    thickness_pct: t === '' ? null : Number(t),
  }
}
const rowDirty = (r: RowState) => {
  const p = rowPatch(r)
  return p.airfoil_name !== r.row.airfoil_name || p.surface !== r.row.surface || p.position !== r.row.position || p.thickness_pct !== r.row.thickness_pct
}
const rowProblem = (p: ReturnType<typeof rowPatch>) =>
  !p.airfoil_name ? 'Airfoil name is required.'
    : !p.surface || !p.position ? 'Choose a surface and a position.'
      : p.thickness_pct !== null && !Number.isFinite(p.thickness_pct) ? 'Thickness must be a number.'
        : ''

const runRow = async (r: RowState, patch: Database['public']['Tables']['aircraft_airfoils']['Update']) => {
  r.status = 'saving'
  r.error = ''
  try {
    r.row = await updateAssignment(r.row.id, patch)
    r.status = 'saved'
  }
  catch (e) {
    r.status = 'error'
    r.error = messageOf(e)
    r.rev++ // put the switches back to the stored values
  }
}

const saveRow = (r: RowState) => {
  const patch = rowPatch(r)
  const problem = rowProblem(patch)
  if (problem) {
    r.status = 'error'
    r.error = problem
    return
  }
  runRow(r, patch)
}

const confirmProbable = (r: RowState) => runRow(r, { airfoil_id: r.row.probable_airfoil_id, probable_airfoil_id: null })
const unlinkRow = (r: RowState) => runRow(r, { airfoil_id: null, probable_airfoil_id: null })

const removeRow = async (r: RowState) => {
  if (!window.confirm(`Delete the ${r.row.airfoil_name} row (${r.row.surface}, ${r.row.position})?`)) return
  r.status = 'saving'
  r.error = ''
  try {
    await deleteAssignment(r.row.id)
    rows.value = rows.value.filter(x => x !== r)
  }
  catch (e) {
    r.status = 'error'
    r.error = messageOf(e)
  }
}

// Link to a catalog airfoil: one picker in a modal rather than one per row
const linkTarget = ref<RowState | null>(null)
const linkPick = ref<Airfoil | null>(null)
const showLink = ref(false)
const openLink = (r: RowState) => {
  linkTarget.value = r
  linkPick.value = null
  showLink.value = true
}
const applyLink = async () => {
  const r = linkTarget.value
  const pick = linkPick.value
  if (!r || !pick) return
  showLink.value = false
  await runRow(r, { airfoil_id: pick.id, probable_airfoil_id: null })
}

// ---- Add airfoil ----
const addForm = reactive({ airfoil_name: '', surface: 'wing', position: 'all', modified: false })
const addPick = ref<Airfoil | null>(null)
const addRev = ref(0)
const adding = ref(false)
const addError = ref('')

watch(addPick, (a) => {
  if (a) addForm.airfoil_name = a.display_name || a.name
})

const addRow = async () => {
  const a = selected.value
  if (!a) return
  const airfoil_name = addForm.airfoil_name.trim()
  if (!airfoil_name) return (addError.value = 'Airfoil name is required.')
  if (!addForm.surface || !addForm.position) return (addError.value = 'Choose a surface and a position.')
  adding.value = true
  addError.value = ''
  try {
    const row = await addAssignment({
      aircraft_id: a.id,
      airfoil_name,
      airfoil_id: addPick.value?.id ?? null,
      probable_airfoil_id: null,
      surface: addForm.surface,
      position: addForm.position,
      modified: addForm.modified,
      sources: [],
    })
    if (selected.value?.id === a.id) rows.value.push(toRowState(row))
    Object.assign(addForm, { airfoil_name: '', surface: 'wing', position: 'all', modified: false })
    addPick.value = null
    addRev.value++
  }
  catch (e) {
    addError.value = messageOf(e)
  }
  finally {
    adding.value = false
  }
}

// ---- URL: ?q=&page=&aircraft=<key>, applied after mount like the other client-side pages ----
const syncUrl = () => {
  router.replace({ query: {
    q: query.value || undefined,
    page: page.value > 1 ? String(page.value) : undefined,
    aircraft: selected.value?.key,
  } })
}

onMounted(async () => {
  const q = typeof route.query.q === 'string' ? route.query.q : ''
  const p = Number(route.query.page)
  searchInput.value = q
  query.value = q.trim()
  page.value = Number.isInteger(p) && p > 1 ? p : 1

  const applySearch = useDebounceFn((v: string) => { query.value = v.trim() }, 300)
  watch(searchInput, v => applySearch(v))
  watch([query, hiddenOnly], () => {
    if (page.value !== 1) page.value = 1
    else loadList()
  })
  watch(page, loadList)
  watch([query, page, () => selected.value?.key], syncUrl)

  loadList()
  const key = route.query.aircraft
  if (typeof key === 'string' && key) {
    try {
      const a = await getAircraftByKey(key)
      if (a && !selected.value) selectAircraft(a)
    }
    catch (e) {
      listError.value = messageOf(e)
    }
  }
})
</script>

<template>
  <div>
    <PageHeader
      title="Aircraft Manager"
      eyebrow="Admin"
      subtitle="Admin tool — changes are written to the live database immediately."
    >
      <template #actions>
        <VButton type="button" color="primary" size="sm" @click="openNew">
          <Icon name="heroicons:plus" class="h-4 w-4 shrink-0" aria-hidden="true" />
          New aircraft
        </VButton>
      </template>
    </PageHeader>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <!-- Aircraft list -->
      <VPanel title="Aircraft" flush class="min-w-0 self-start">
        <div class="space-y-3 border-b border-gray-200 p-4">
          <VInput
            v-model="searchInput"
            type="search"
            aria-label="Search aircraft by name"
            placeholder="Search by name"
            prepend-icon="heroicons:magnifying-glass"
          />
          <div class="flex items-center gap-2 text-sm text-gray-700">
            <VSwitch v-model="hiddenOnly" name="hidden-only" sr-text="Hidden only" />
            <span aria-hidden="true">Hidden only</span>
          </div>
        </div>

        <VStateBlock v-if="listError" variant="error" title="Could not load aircraft" :description="listError">
          <VButton type="button" size="sm" @click="loadList">
            Retry
          </VButton>
        </VStateBlock>
        <VStateBlock v-else-if="listLoading && list.length === 0" variant="loading" />
        <VStateBlock v-else-if="list.length === 0" title="No aircraft found" description="Try another search." />
        <ul v-else class="max-h-[65vh] divide-y divide-gray-100 overflow-y-auto" :class="{ 'opacity-60': listLoading }">
          <li v-for="a in list" :key="a.id">
            <button
              type="button"
              class="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
              :class="{ 'bg-primary-50 hover:bg-primary-50': selected?.id === a.id }"
              :aria-current="selected?.id === a.id ? 'true' : undefined"
              @click="selectAircraft(a)"
            >
              <span class="min-w-0">
                <span class="block font-medium text-gray-900">{{ labelOf(a) }}</span>
                <span v-if="a.display_name" class="block text-xs text-gray-500">{{ a.name }}</span>
              </span>
              <span class="flex shrink-0 flex-wrap justify-end gap-1">
                <span v-if="a.category" class="text-xs text-gray-500">{{ a.category }}</span>
                <VBadge v-if="a.hidden" tone="warning">Hidden</VBadge>
              </span>
            </button>
          </li>
        </ul>

        <div class="flex items-center justify-between gap-2 border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
          <span class="num">{{ total.toLocaleString('en') }} aircraft · page {{ page }} of {{ totalPages }}</span>
          <span class="flex gap-2">
            <VButton type="button" size="sm" :disabled="page <= 1 || listLoading" aria-label="Previous page" @click="page--">
              <Icon name="heroicons:chevron-left" class="h-4 w-4" aria-hidden="true" />
            </VButton>
            <VButton type="button" size="sm" :disabled="page >= totalPages || listLoading" aria-label="Next page" @click="page++">
              <Icon name="heroicons:chevron-right" class="h-4 w-4" aria-hidden="true" />
            </VButton>
          </span>
        </div>
      </VPanel>

      <!-- Selected aircraft -->
      <div class="min-w-0 space-y-6">
        <VPanel v-if="!selected">
          <VStateBlock icon="lucide:plane" title="No aircraft selected" description="Pick an aircraft from the list, or create a new one." />
        </VPanel>

        <template v-else>
          <VPanel :title="labelOf(selected)" :description="`Key: ${selected.key}`">
            <template #actions>
              <VButton type="button" color="error" size="sm" @click="openDelete">
                <Icon name="heroicons:trash" class="h-4 w-4 shrink-0" aria-hidden="true" />
                Delete aircraft
              </VButton>
            </template>
            <form class="space-y-4" @submit.prevent="saveAircraft">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <VInput v-model="form.display_name" label="Display name" :placeholder="selected.name" />
                <div>
                  <span id="aircraft-category-label" class="mb-0.5 block text-sm font-medium text-gray-700">Category</span>
                  <VSelect
                    :model-value="itemFor(CATEGORY_ITEMS, form.category)"
                    :items="CATEGORY_ITEMS"
                    aria-labelledby="aircraft-category-label"
                    @update:model-value="(v: Item | undefined) => form.category = v?.value ?? ''"
                  />
                </div>
                <VInput v-model="form.year" type="number" step="1" label="Year" />
                <VInput v-model="form.country" label="Country" />
              </div>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2 text-sm text-gray-700">
                  <VSwitch
                    :key="`${selected.id}-${selected.hidden}-${hiddenRev}`"
                    :model-value="selected.hidden"
                    :name="`hidden-${selected.id}`"
                    sr-text="Hidden (saves immediately)"
                    @update:model-value="(v: boolean) => runAircraft({ hidden: v })"
                  />
                  <span aria-hidden="true">Hidden <span class="text-gray-500">(saves immediately)</span></span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-sm" role="status" :class="aircraftStatus === 'error' ? 'text-error-700' : 'text-gray-500'">
                    {{ aircraftStatus === 'saving' ? 'Saving…' : aircraftStatus === 'saved' ? 'Saved' : aircraftStatus === 'error' ? aircraftError : '' }}
                  </span>
                  <VButton type="submit" color="primary" size="sm" :disabled="!aircraftDirty || aircraftStatus === 'saving'">
                    Save
                  </VButton>
                </div>
              </div>
            </form>
          </VPanel>

          <VPanel title="Assigned airfoils" flush>
            <VStateBlock v-if="rowsLoading" variant="loading" />
            <VStateBlock v-else-if="rowsError" variant="error" title="Could not load the assigned airfoils" :description="rowsError">
              <VButton type="button" size="sm" @click="selected && loadAssignments(selected.id)">
                Retry
              </VButton>
            </VStateBlock>
            <VStateBlock v-else-if="rows.length === 0" title="No airfoils assigned" description="Add one below." />
            <ul v-else class="divide-y divide-gray-200">
              <li v-for="r in sortedRows" :key="r.row.id" class="space-y-3 px-4 py-4 sm:px-5">
                <div class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                  <VInput v-model="r.draft.airfoil_name" size="sm" label="Airfoil name (from sources)" />
                  <div>
                    <span class="mb-1.5 block text-sm font-medium text-gray-700">Linked airfoil</span>
                    <div class="flex min-h-8 flex-wrap items-center gap-2 text-sm">
                      <template v-if="r.row.airfoil">
                        <NuxtLink :to="`/airfoils/${r.row.airfoil.name}`" class="font-medium text-primary-700 hover:underline">
                          {{ r.row.airfoil.name }}
                        </NuxtLink>
                        <VBadge tone="success">Linked</VBadge>
                      </template>
                      <template v-else-if="r.row.probable">
                        <NuxtLink :to="`/airfoils/${r.row.probable.name}`" class="font-medium text-primary-700 hover:underline">
                          {{ r.row.probable.name }}
                        </NuxtLink>
                        <VBadge tone="warning">Probable</VBadge>
                        <VButton type="button" size="xs" variant="tertiary" :disabled="r.status === 'saving'" @click="confirmProbable(r)">
                          Confirm
                        </VButton>
                      </template>
                      <span v-else class="text-gray-500">Not linked</span>
                      <VButton type="button" size="xs" variant="tertiary" :disabled="r.status === 'saving'" @click="openLink(r)">
                        {{ r.row.airfoil || r.row.probable ? 'Change' : 'Link' }}
                      </VButton>
                      <VButton v-if="r.row.airfoil || r.row.probable" type="button" size="xs" variant="tertiary" :disabled="r.status === 'saving'" @click="unlinkRow(r)">
                        Unlink
                      </VButton>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto_auto]">
                  <div>
                    <span :id="`surface-${r.row.id}`" class="block text-sm font-medium text-gray-700">Surface</span>
                    <VSelect
                      small
                      :model-value="itemFor(SURFACE_ITEMS, r.draft.surface)"
                      :items="SURFACE_ITEMS"
                      :aria-labelledby="`surface-${r.row.id}`"
                      @update:model-value="(v: Item | undefined) => r.draft.surface = v?.value ?? ''"
                    />
                  </div>
                  <div>
                    <span :id="`position-${r.row.id}`" class="block text-sm font-medium text-gray-700">Position</span>
                    <VSelect
                      small
                      :model-value="itemFor(POSITION_ITEMS, r.draft.position)"
                      :items="POSITION_ITEMS"
                      :aria-labelledby="`position-${r.row.id}`"
                      @update:model-value="(v: Item | undefined) => r.draft.position = v?.value ?? ''"
                    />
                  </div>
                  <VInput v-model="r.draft.thickness" type="number" step="any" size="sm" label="Thickness %" />
                  <div class="flex flex-col items-start gap-1 text-sm text-gray-700">
                    <span aria-hidden="true">Modified</span>
                    <VSwitch
                      :key="`${r.row.id}-m-${r.row.modified}-${r.rev}`"
                      :model-value="r.row.modified"
                      :name="`modified-${r.row.id}`"
                      sr-text="Modified (saves immediately)"
                      @update:model-value="(v: boolean) => runRow(r, { modified: v })"
                    />
                  </div>
                  <div class="flex flex-col items-start gap-1 text-sm text-gray-700">
                    <span aria-hidden="true">Uncertain</span>
                    <VSwitch
                      :key="`${r.row.id}-u-${r.row.uncertain}-${r.rev}`"
                      :model-value="r.row.uncertain"
                      :name="`uncertain-${r.row.id}`"
                      sr-text="Uncertain (saves immediately)"
                      @update:model-value="(v: boolean) => runRow(r, { uncertain: v })"
                    />
                  </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3">
                  <span class="flex flex-wrap gap-x-3 text-xs">
                    <span class="text-gray-500">Sources:</span>
                    <a
                      v-for="s in sourceLinks(r.row.sources)"
                      :key="s.url"
                      :href="s.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="rounded text-primary-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      {{ s.label }}<span class="sr-only"> (opens in a new tab)</span>
                    </a>
                    <span v-if="sourceLinks(r.row.sources).length === 0" class="text-gray-400">none</span>
                  </span>
                  <span class="flex items-center gap-2">
                    <span class="text-sm" role="status" :class="r.status === 'error' ? 'text-error-700' : 'text-gray-500'">
                      {{ r.status === 'saving' ? 'Saving…' : r.status === 'saved' ? 'Saved' : r.status === 'error' ? r.error : '' }}
                    </span>
                    <VButton type="button" size="sm" color="primary" :disabled="!rowDirty(r) || r.status === 'saving'" @click="saveRow(r)">
                      Save
                    </VButton>
                    <VButton type="button" size="sm" variant="ghost" :aria-label="`Delete the ${r.row.airfoil_name} row`" :disabled="r.status === 'saving'" @click="removeRow(r)">
                      <Icon name="heroicons:trash" class="h-4 w-4 text-error-600" aria-hidden="true" />
                    </VButton>
                  </span>
                </div>
              </li>
            </ul>

            <!-- not a form: Enter in the airfoil search must not add a row -->
            <div class="space-y-3 border-t border-gray-200 bg-gray-50 px-4 py-4 sm:px-5">
              <h3 class="text-sm font-semibold text-gray-900">
                Add airfoil
              </h3>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <SparAirfoilSelector :key="addRev" v-model="addPick" :show-selection-summary="false" label="Catalog airfoil (optional)" />
                <VInput v-model="addForm.airfoil_name" label="Airfoil name (required)" />
              </div>
              <div class="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                <div>
                  <span id="add-surface-label" class="block text-sm font-medium text-gray-700">Surface</span>
                  <VSelect
                    :model-value="itemFor(SURFACE_ITEMS, addForm.surface)"
                    :items="SURFACE_ITEMS"
                    aria-labelledby="add-surface-label"
                    @update:model-value="(v: Item | undefined) => addForm.surface = v?.value ?? ''"
                  />
                </div>
                <div>
                  <span id="add-position-label" class="block text-sm font-medium text-gray-700">Position</span>
                  <VSelect
                    :model-value="itemFor(POSITION_ITEMS, addForm.position)"
                    :items="POSITION_ITEMS"
                    aria-labelledby="add-position-label"
                    @update:model-value="(v: Item | undefined) => addForm.position = v?.value ?? ''"
                  />
                </div>
                <div class="flex flex-col items-start gap-1 text-sm text-gray-700">
                  <span aria-hidden="true">Modified</span>
                  <VSwitch :key="addRev" v-model="addForm.modified" name="add-modified" sr-text="Modified" />
                </div>
                <VButton type="button" color="primary" :disabled="adding" @click="addRow">
                  <Icon name="heroicons:plus" class="h-4 w-4 shrink-0" aria-hidden="true" />
                  Add airfoil
                </VButton>
              </div>
              <p v-if="addError" class="text-sm text-error-700" role="alert">
                {{ addError }}
              </p>
            </div>
          </VPanel>
        </template>
      </div>
    </div>

    <!-- New aircraft -->
    <VModal v-model="showNew">
      <form @submit.prevent="createNew">
        <VModalHeader dismissable>
          New aircraft
        </VModalHeader>
        <VModalBody>
          <div class="space-y-4">
            <VInput v-model="newForm.name" label="Name (required)" hint="As recorded in the sources." />
            <VInput v-model="newForm.display_name" label="Display name (optional)" />
            <div>
              <span id="new-category-label" class="mb-0.5 block text-sm font-medium text-gray-700">Category</span>
              <VSelect
                :model-value="itemFor(CATEGORY_ITEMS, newForm.category)"
                :items="CATEGORY_ITEMS"
                aria-labelledby="new-category-label"
                @update:model-value="(v: Item | undefined) => newForm.category = v?.value ?? ''"
              />
            </div>
            <p class="text-xs text-gray-500">
              Key: <span class="font-mono">{{ newKey || '—' }}</span>
            </p>
            <p v-if="newError" class="text-sm text-error-700" role="alert">
              {{ newError }}
            </p>
          </div>
        </VModalBody>
        <VModalFooter>
          <VButton type="button" :disabled="creating" @click="showNew = false">
            Cancel
          </VButton>
          <VButton type="submit" color="primary" :disabled="creating">
            Create
          </VButton>
        </VModalFooter>
      </form>
    </VModal>

    <!-- Delete aircraft -->
    <VModalConfirm v-model="showDelete" title="Delete aircraft" confirm-label="Delete" :busy="deleting" @confirm="confirmDeleteAircraft">
      <p v-if="selected">
        Permanently delete <span class="font-semibold">{{ labelOf(selected) }}</span>
        <template v-if="!rowsLoading && !rowsError">
          and its <span class="font-semibold">{{ rows.length }}</span> airfoil assignment{{ rows.length === 1 ? '' : 's' }}?
        </template>
        <template v-else>
          and all of its airfoil assignments?
        </template>
        This cannot be undone.
      </p>
      <p v-if="deleteError" class="mt-3 text-sm text-error-700" role="alert">
        {{ deleteError }}
      </p>
    </VModalConfirm>

    <!-- Link a row to a catalog airfoil -->
    <VModal v-model="showLink">
      <VModalHeader dismissable>
        Link to a catalog airfoil
      </VModalHeader>
      <VModalBody>
        <!-- tall enough for the suggestion list, which the panel would otherwise clip -->
        <div class="min-h-[18rem]">
          <p v-if="linkTarget" class="mb-3">
            Row: <span class="font-semibold">{{ linkTarget.row.airfoil_name }}</span> ({{ linkTarget.row.surface }}, {{ linkTarget.row.position }})
          </p>
          <SparAirfoilSelector v-model="linkPick" :show-selection-summary="false" label="Catalog airfoil" />
        </div>
      </VModalBody>
      <VModalFooter>
        <VButton type="button" @click="showLink = false">
          Cancel
        </VButton>
        <VButton type="button" color="primary" :disabled="!linkPick" @click="applyLink">
          Link
        </VButton>
      </VModalFooter>
    </VModal>
  </div>
</template>
