import assert from 'node:assert/strict'

// Central-difference check of an analytic Jacobian J [m, n] (row-major) of f: R^n -> R^m at u0.
// The error of column k in output i is measured as a change in f over the step,
// |fd - J|*h_k, relative to S_i = max_k |J_ik*h_k| (the largest change of f_i over any one step).
// Passes when that is <= rtol + roundoff floor (64 ulp of |f_i| over S_i).
// Step: 1e-6 relative to |u_k| (absolute when u_k = 0).
// Returns the worst normalized error and whether any entry passed only thanks to the roundoff floor.
export function fdCheck(f: (u: Float64Array) => ArrayLike<number>, u0: Float64Array, J: ArrayLike<number>, label: string, rtol = 1e-6): { err: number; roundoff: boolean } {
  const n = u0.length
  const m = J.length / n
  const h = Float64Array.from(u0, v => 1e-6 * (Math.abs(v) || 1))
  const fp: ArrayLike<number>[] = []
  const fm: ArrayLike<number>[] = []
  for (let k = 0; k < n; k++) {
    const u = Float64Array.from(u0)
    u[k] = u0[k] + h[k]
    fp.push(f(u))
    u[k] = u0[k] - h[k]
    fm.push(f(u))
  }
  let worst = 0
  let roundoff = false
  for (let i = 0; i < m; i++) {
    let S = 0
    let fs = 0
    for (let k = 0; k < n; k++) {
      S = Math.max(S, Math.abs(J[i * n + k] * h[k]))
      fs = Math.max(fs, Math.abs(fp[k][i]), Math.abs(fm[k][i]))
    }
    const floor = 64 * Number.EPSILON * fs
    for (let k = 0; k < n; k++) {
      const fd = (fp[k][i] - fm[k][i]) / (2 * h[k])
      const d = Math.abs(fd - J[i * n + k]) * h[k]
      assert.ok(d <= rtol * S + floor, `${label}: d(out ${i})/d(in ${k}) analytic ${J[i * n + k]} vs fd ${fd}`)
      if (d > rtol * S)
        roundoff = true
      if (S > 0)
        worst = Math.max(worst, d / S)
    }
  }
  return { err: worst, roundoff }
}
