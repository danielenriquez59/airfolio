// Numerics for the mfoil port: dense LU (np.linalg.solve / spsolve) and
// not-a-knot cubic splines (scipy CubicSpline / interp1d 'cubic').
// Vectors are Float64Array; matrices are flat row-major Float64Array.

export interface LU {
  n: number
  lu: Float64Array // L (unit diagonal, below) and U (on and above) packed, row-major
  piv: Int32Array // piv[k] = original row now at position k
}

// Factor the n x n row-major matrix A with partial pivoting. A is not modified.
export function luFactor(A: Float64Array, n: number): LU {
  if (A.length !== n * n)
    throw new Error('luFactor: A must have n*n entries')
  const a = Float64Array.from(A)
  const piv = new Int32Array(n)
  for (let i = 0; i < n; i++) piv[i] = i
  for (let k = 0; k < n; k++) {
    let p = k
    let amax = Math.abs(a[k * n + k])
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(a[i * n + k])
      if (v > amax) {
        amax = v
        p = i
      }
    }
    if (amax === 0)
      throw new Error('luFactor: singular matrix')
    if (p !== k) {
      const rk = k * n
      const rp = p * n
      for (let j = 0; j < n; j++) {
        const t = a[rk + j]
        a[rk + j] = a[rp + j]
        a[rp + j] = t
      }
      const t = piv[k]
      piv[k] = piv[p]
      piv[p] = t
    }
    const ak = a.subarray(k * n, k * n + n)
    const d = ak[k]
    for (let i = k + 1; i < n; i++) {
      const ai = a.subarray(i * n, i * n + n) // row views keep the inner loop bounds-check friendly
      const l = (ai[k] /= d)
      if (l === 0)
        continue
      for (let j = k + 1; j < n; j++) ai[j] -= l * ak[j]
    }
  }
  return { n, lu: a, piv }
}

// Solve A X = B using a factorization from luFactor. B is n x nrhs row-major
// (a plain vector when nrhs = 1). Returns a new array; B is not modified.
export function luSolve(f: LU, B: Float64Array, nrhs = 1): Float64Array {
  const { n, lu, piv } = f
  if (B.length !== n * nrhs)
    throw new Error('luSolve: B must have n*nrhs entries')
  const x = new Float64Array(n * nrhs)
  for (let i = 0; i < n; i++) x.set(B.subarray(piv[i] * nrhs, piv[i] * nrhs + nrhs), i * nrhs)
  for (let i = 1; i < n; i++) { // forward: L y = P b
    const ri = i * n
    const xi = i * nrhs
    for (let j = 0; j < i; j++) {
      const l = lu[ri + j]
      if (l === 0)
        continue
      const xj = j * nrhs
      for (let c = 0; c < nrhs; c++) x[xi + c] -= l * x[xj + c]
    }
  }
  for (let i = n - 1; i >= 0; i--) { // backward: U x = y
    const ri = i * n
    const xi = i * nrhs
    for (let j = i + 1; j < n; j++) {
      const u = lu[ri + j]
      if (u === 0)
        continue
      const xj = j * nrhs
      for (let c = 0; c < nrhs; c++) x[xi + c] -= u * x[xj + c]
    }
    const d = lu[ri + i]
    for (let c = 0; c < nrhs; c++) x[xi + c] /= d
  }
  return x
}

// One-shot np.linalg.solve(A, B) for an n x n A and n x nrhs B.
export function solve(A: Float64Array, B: Float64Array, n: number, nrhs = 1): Float64Array {
  return luSolve(luFactor(A, n), B, nrhs)
}

export function norm2(x: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < x.length; i++) s += x[i] * x[i]
  return Math.sqrt(s)
}

// Piecewise cubic in scipy PPoly layout: on [x[i], x[i+1]], with t = s - x[i],
// p(s) = c[i] t^3 + c[m+i] t^2 + c[2m+i] t + c[3m+i], m = x.length - 1.
// So scipy's PP.c[k, i] is c[k*m + i].
export interface PP {
  x: Float64Array
  c: Float64Array
}

// scipy CubicSpline(x, y) with its default not-a-knot ends. x strictly increasing.
// shortcut: n < 4 is rejected (scipy special-cases n = 2, 3); mfoil always passes many points.
export function cubicSpline(x: ArrayLike<number>, y: ArrayLike<number>): PP {
  const n = x.length
  if (n < 4 || y.length !== n)
    throw new Error('cubicSpline: need x.length === y.length >= 4')
  const m = n - 1
  const dx = new Float64Array(m)
  const sl = new Float64Array(m)
  for (let i = 0; i < m; i++) {
    dx[i] = x[i + 1] - x[i]
    if (!(dx[i] > 0))
      throw new Error('cubicSpline: x must be strictly increasing')
    sl[i] = (y[i + 1] - y[i]) / dx[i]
  }
  // tridiagonal system for the knot slopes s: lo[i] s[i-1] + di[i] s[i] + up[i] s[i+1] = b[i]
  const lo = new Float64Array(n)
  const di = new Float64Array(n)
  const up = new Float64Array(n)
  const b = new Float64Array(n)
  for (let i = 1; i < m; i++) {
    lo[i] = dx[i]
    di[i] = 2 * (dx[i - 1] + dx[i])
    up[i] = dx[i - 1]
    b[i] = 3 * (dx[i] * sl[i - 1] + dx[i - 1] * sl[i])
  }
  let d = x[2] - x[0]
  di[0] = dx[1]
  up[0] = d
  b[0] = ((dx[0] + 2 * d) * dx[1] * sl[0] + dx[0] * dx[0] * sl[1]) / d
  d = x[m] - x[m - 2]
  di[m] = dx[m - 2]
  lo[m] = d
  b[m] = (dx[m - 1] * dx[m - 1] * sl[m - 2] + (2 * d + dx[m - 1]) * dx[m - 2] * sl[m - 1]) / d
  const s = solveTridiagonal(lo, di, up, b)
  const c = new Float64Array(4 * m)
  for (let i = 0; i < m; i++) {
    const t = (s[i] + s[i + 1] - 2 * sl[i]) / dx[i]
    c[i] = t / dx[i]
    c[m + i] = (sl[i] - s[i]) / dx[i] - t
    c[2 * m + i] = s[i]
    c[3 * m + i] = y[i]
  }
  return { x: Float64Array.from(x), c }
}

// Evaluate pp (nu = 0) or its first derivative (nu = 1) at each s, extrapolating
// outside [x0, xN] with the end pieces like scipy's default.
export function ppEval(pp: PP, s: ArrayLike<number>, nu: 0 | 1 = 0): Float64Array {
  const { x, c } = pp
  const m = x.length - 1
  const out = new Float64Array(s.length)
  for (let q = 0; q < s.length; q++) {
    const sq = s[q]
    let lo = 0
    let hi = m - 1 // find largest i <= m-1 with x[i] <= sq (0 if sq < x0)
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (x[mid] <= sq)
        lo = mid
      else hi = mid - 1
    }
    const t = sq - x[lo]
    const c0 = c[lo]
    const c1 = c[m + lo]
    const c2 = c[2 * m + lo]
    out[q] = nu === 0 ? ((c0 * t + c1) * t + c2) * t + c[3 * m + lo] : (3 * c0 * t + 2 * c1) * t + c2
  }
  return out
}

// Thomas algorithm, no pivoting: interior rows are diagonally dominant; the not-a-knot
// end rows are not, but match scipy's pivoted banded solve to roundoff (see tests).
function solveTridiagonal(lo: Float64Array, di: Float64Array, up: Float64Array, b: Float64Array): Float64Array {
  const n = di.length
  const cp = new Float64Array(n)
  const x = new Float64Array(n)
  let den = di[0]
  cp[0] = up[0] / den
  x[0] = b[0] / den
  for (let i = 1; i < n; i++) {
    den = di[i] - lo[i] * cp[i - 1]
    cp[i] = up[i] / den
    x[i] = (b[i] - lo[i] * x[i - 1]) / den
  }
  for (let i = n - 2; i >= 0; i--) x[i] -= cp[i] * x[i + 1]
  return x
}
