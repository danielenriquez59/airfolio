/**
 * Several mfoil runs side by side, one worker per airfoil slot, under one set of flow conditions.
 */
import type { EffectScope, Raw } from 'vue'
import { effectScope, getCurrentScope, markRaw, onScopeDispose, ref, watch } from 'vue'
import type { Database } from '~/types/database.types'
import type { MfoilInput } from '../utils/mfoil/index.ts'
import { useMfoil } from './useMfoil.ts'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

export interface MfoilSlot {
  id: number
  name: string // the ?airfoil= name this slot was added for
  airfoil: Airfoil | null
  loading: boolean
  loadError: string | null
  mfoil: Raw<ReturnType<typeof useMfoil>> // raw: keep its refs as refs inside the reactive list
  colorIndex: number
  visible: boolean
  ranKey: string | null // conditions of the last run started for this slot
}

/** Lowest colour index not already taken, so removing one airfoil never recolours the others */
export function lowestFreeIndex(used: number[]): number {
  let i = 0
  while (used.includes(i))
    i++
  return i
}

/** A slot needs a run unless it already finished one for these exact conditions */
export const needsRun = (status: string, ranKey: string | null, key: string) => !(status === 'done' && ranKey === key)

export function useMfoilRuns(max: number, fetchAirfoil: (name: string) => Promise<Airfoil | null>) {
  const slots = ref<MfoilSlot[]>([])
  const latest = ref<{ id: number; alpha: number } | null>(null) // most recently finished point of any slot
  const scopes = new Map<number, EffectScope>() // each slot's worker lives in its own scope, stopped on remove
  let nextId = 0

  const find = (id: number) => slots.value.find(s => s.id === id)

  async function load(id: number, name: string) {
    // find(id) is undefined once the slot was removed: a stale load then changes nothing
    try {
      const data = await fetchAirfoil(name)
      const s = find(id)
      if (!s)
        return
      if (!data?.upper_x_coordinates?.length || !data.lower_x_coordinates?.length)
        s.loadError = data ? 'This airfoil has no geometry data' : 'Airfoil not found'
      else
        s.airfoil = data
    }
    catch (err: unknown) {
      const s = find(id)
      if (s)
        s.loadError = err instanceof Error ? err.message : 'Failed to load airfoil'
    }
    finally {
      const s = find(id)
      if (s)
        s.loading = false
    }
  }

  function add(name: string): boolean {
    if (slots.value.length >= max || slots.value.some(s => s.name === name))
      return false
    const id = nextId++
    const scope = effectScope(true)
    const mfoil = scope.run(() => {
      const m = useMfoil() // registers its halt on this scope
      watch(m.latestAlpha, (alpha) => {
        if (alpha != null)
          latest.value = { id, alpha }
      })
      return m
    })!
    scopes.set(id, scope)
    slots.value.push({
      id,
      name,
      airfoil: null,
      loading: true,
      loadError: null,
      mfoil: markRaw(mfoil),
      colorIndex: lowestFreeIndex(slots.value.map(s => s.colorIndex)),
      visible: true,
      ranKey: null,
    })
    load(id, name)
    return true
  }

  function remove(id: number) {
    scopes.get(id)?.stop() // halts the worker
    scopes.delete(id)
    slots.value = slots.value.filter(s => s.id !== id)
    if (latest.value?.id === id)
      latest.value = null
  }

  /** Match the slots to a list of names: drop the missing, add the new, keep the list order */
  function sync(names: string[]) {
    for (const s of [...slots.value]) {
      if (!names.includes(s.name))
        remove(s.id)
    }
    for (const name of names)
      add(name) // refuses duplicates and past the max
    slots.value.sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name))
  }

  // key per airfoil: conditions that do not apply to an airfoil must not rerun it
  function runAll(keyOf: (airfoil: Airfoil) => string, input: (airfoil: Airfoil) => MfoilInput) {
    for (const s of slots.value) {
      const key = s.airfoil ? keyOf(s.airfoil) : null
      if (!s.airfoil || !key || !needsRun(s.mfoil.status.value, s.ranKey, key))
        continue
      s.ranKey = key
      s.mfoil.run(input(s.airfoil))
    }
  }

  const stopAll = () => slots.value.forEach(s => s.mfoil.stop())

  if (getCurrentScope())
    onScopeDispose(() => scopes.forEach(s => s.stop()))

  return { slots, latest, add, remove, sync, runAll, stopAll }
}
