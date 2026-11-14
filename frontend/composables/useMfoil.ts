/**
 * In-browser viscous polar with mfoil. Results stream in one angle at a time.
 */
import type { Ref } from 'vue'
import { getCurrentScope, onScopeDispose, ref } from 'vue'
import type { MfoilInput, MfoilPoint } from '../utils/mfoil/index.ts'
import type { MfoilWorkerMessage } from '../utils/mfoil/mfoil.worker.ts'

export interface MfoilSummary {
  clMax: { value: number; alpha: number } | null
  ldMax: { value: number; alpha: number } | null
  cdMin: { value: number; alpha: number } | null
  liftSlope: number | null // per degree
  alphaZeroLift: number | null // degrees
}

// Lift-curve fit window: the linear range of most airfoils at typical Re
const FIT_ALPHA_MIN = -5
const FIT_ALPHA_MAX = 5

/** Polar summary over converged points; null where there is not enough data */
export function summarizePolar(points: MfoilPoint[]): MfoilSummary {
  const pts = points.filter(p => p.converged)
  const best = (value: (p: MfoilPoint) => number, sign: 1 | -1) => {
    let found: { value: number; alpha: number } | null = null
    for (const p of pts) {
      const v = value(p)
      if (Number.isFinite(v) && (!found || sign * v > sign * found.value))
        found = { value: v, alpha: p.alpha }
    }
    return found
  }

  const fit = pts.filter(p => p.alpha >= FIT_ALPHA_MIN && p.alpha <= FIT_ALPHA_MAX)
  let liftSlope: number | null = null
  let alphaZeroLift: number | null = null
  if (fit.length >= 3) {
    const n = fit.length
    const ma = fit.reduce((s, p) => s + p.alpha, 0) / n
    const mc = fit.reduce((s, p) => s + p.cl, 0) / n
    const saa = fit.reduce((s, p) => s + (p.alpha - ma) ** 2, 0)
    const sac = fit.reduce((s, p) => s + (p.alpha - ma) * (p.cl - mc), 0)
    if (saa > 0 && sac !== 0) {
      liftSlope = sac / saa
      alphaZeroLift = ma - mc / liftSlope
    }
  }

  return {
    clMax: best(p => p.cl, 1),
    ldMax: best(p => (p.cd > 0 ? p.cl / p.cd : NaN), 1),
    cdMin: best(p => p.cd, -1),
    liftSlope,
    alphaZeroLift,
  }
}

export function useMfoil() {
  const points: Ref<MfoilPoint[]> = ref([])
  const status = ref<'idle' | 'running' | 'done' | 'stopped' | 'error'>('idle')
  const progress = ref({ done: 0, total: 0 })
  const error = ref<string | null>(null)
  const latestAlpha = ref<number | null>(null) // alpha of the most recently finished point
  let worker: Worker | null = null

  const halt = () => {
    worker?.terminate()
    worker = null
  }

  const fail = (message: string) => {
    halt()
    error.value = message
    status.value = 'error'
  }

  const reset = () => {
    halt()
    points.value = []
    status.value = 'idle'
    progress.value = { done: 0, total: 0 }
    error.value = null
    latestAlpha.value = null
  }

  const run = (input: MfoilInput) => {
    reset()
    progress.value = { done: 0, total: new Set(input.alphas).size }
    status.value = 'running'
    worker = new Worker(new URL('../utils/mfoil/mfoil.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }: MessageEvent<MfoilWorkerMessage>) => {
      if (data.type === 'point') {
        points.value = [...points.value, data.point].sort((a, b) => a.alpha - b.alpha)
        latestAlpha.value = data.point.alpha
        progress.value = { done: progress.value.done + 1, total: progress.value.total }
      }
      else if (data.type === 'done') {
        halt()
        status.value = 'done'
      }
      else {
        fail(data.message)
      }
    }
    worker.onerror = e => fail(e.message || 'The solver could not start.')
    worker.postMessage(JSON.parse(JSON.stringify(input))) // plain copy: reactive proxies cannot be cloned
  }

  const stop = () => {
    if (status.value !== 'running')
      return
    halt()
    status.value = 'stopped'
  }

  if (getCurrentScope())
    onScopeDispose(halt)

  return { points, status, progress, error, latestAlpha, run, stop, reset }
}
