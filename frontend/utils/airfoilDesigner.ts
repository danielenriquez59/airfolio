/**
 * Airfoil Designer: design snapshots of CST parameters and the polars compared between them.
 */
import type { CSTParameters } from '../composables/useCSTParameters.ts'
import { summarizePolar } from '../composables/useMfoil.ts'
import { lowestFreeIndex } from '../composables/useMfoilRuns.ts'
import type { MfoilPoint } from './mfoil/index.ts'

export const MAX_SNAPSHOTS = 6

export interface DesignSnapshot {
  id: number
  name: string
  params: CSTParameters
  colorIndex: number
  visible: boolean
}

/** Same shape as AirfoilPolarPlots takes, for both solvers */
export interface Polar {
  alpha: number[]
  CL: number[]
  CD: number[]
  CM: number[]
}

/** Flow conditions as NACAAnalysisPanel emits them; Reynolds in thousands */
export interface Conditions {
  reynolds: number
  mach: number
  alphaStart: number
  alphaEnd: number
  alphaStep: number
  nCrit: number
}

/** Angles of attack from start to end inclusive; same count as the backend's transient limit */
export const angleCount = (c: Conditions) => Math.floor((c.alphaEnd - c.alphaStart) / c.alphaStep + 1e-9) + 1

/** True when loading another design would lose the current one: it matches no snapshot */
export function isUnsaved(params: CSTParameters, snapshots: DesignSnapshot[]) {
  return !snapshots.some(s => JSON.stringify(s.params) === JSON.stringify(params))
}

/** A result belongs to one exact shape, solver and set of flow conditions */
export const runKey = (params: CSTParameters, solver: string, conditions: unknown) => JSON.stringify([params, solver, conditions])

/** Deep copy. JSON, because structuredClone throws on Vue's reactive proxies. */
export const cloneParams = (params: CSTParameters): CSTParameters => JSON.parse(JSON.stringify(params))

/** The list with a frozen copy of params added, or null when the list is full */
export function addSnapshot(list: DesignSnapshot[], params: CSTParameters): DesignSnapshot[] | null {
  if (list.length >= MAX_SNAPSHOTS)
    return null
  const id = Math.max(0, ...list.map(s => s.id)) + 1
  return [...list, {
    id,
    name: `Snapshot ${id}`,
    params: cloneParams(params),
    colorIndex: lowestFreeIndex(list.map(s => s.colorIndex)),
    visible: true,
  }]
}

function finiteList(v: unknown, length: number) {
  return Array.isArray(v) && v.length === length && v.every(n => typeof n === 'number' && Number.isFinite(n))
}

export function isCSTParameters(p: any): p is CSTParameters {
  return !!p && Number.isInteger(p.order) && p.order >= 2 && p.order <= 20
    && finiteList(p.upperWeights, p.order + 1) && finiteList(p.lowerWeights, p.order + 1)
    && Number.isFinite(p.leWeight) && Number.isFinite(p.teThickness)
}

function isConditions(c: any): c is Conditions {
  return !!c && ['reynolds', 'mach', 'alphaStart', 'alphaEnd', 'alphaStep', 'nCrit'].every(k => Number.isFinite(c[k]))
}

/** Saved browser state, or null when it is missing or not in the expected shape. Malformed conditions are dropped. */
export function parseSavedDesign(raw: string | null): { params: CSTParameters; snapshots: DesignSnapshot[]; conditions?: Conditions } | null {
  try {
    const saved = JSON.parse(raw ?? 'null')
    if (!isCSTParameters(saved?.params) || !Array.isArray(saved.snapshots))
      return null
    const snapshots = (saved.snapshots as any[]).filter(s =>
      Number.isInteger(s?.id) && typeof s.name === 'string' && Number.isInteger(s.colorIndex)
      && typeof s.visible === 'boolean' && isCSTParameters(s.params),
    ).slice(0, MAX_SNAPSHOTS)
    return isConditions(saved.conditions)
      ? { params: saved.params, snapshots, conditions: saved.conditions }
      : { params: saved.params, snapshots }
  }
  catch {
    return null
  }
}

/** Max lift, max lift-to-drag and min drag of a polar */
export function polarStats(polar: Polar) {
  const points = polar.alpha.map((alpha, i) => ({ alpha, cl: polar.CL[i], cd: polar.CD[i], converged: true }) as MfoilPoint)
  const { clMax, ldMax, cdMin } = summarizePolar(points)
  return { clMax, ldMax, cdMin }
}
