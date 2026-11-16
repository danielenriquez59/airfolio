// Runs one viscous polar off the main thread: receives an MfoilInput, posts each point as it finishes,
// then 'done' (or 'error'). The page cancels a run by terminating the worker.
import type { MfoilInput, MfoilPoint } from './index.ts'
import { solvePolar } from './index.ts'

export type MfoilWorkerMessage =
  | { type: 'point'; point: MfoilPoint }
  | { type: 'done' }
  | { type: 'error'; message: string }

const post = (m: MfoilWorkerMessage) => postMessage(m)

onmessage = (e: MessageEvent<MfoilInput>) => {
  try {
    solvePolar(e.data, point => post({ type: 'point', point }))
    post({ type: 'done' })
  }
  catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
