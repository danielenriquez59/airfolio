/**
 * Composable for CST (Class Shape Transformation) parameter fitting and coordinate generation
 * Implements the CST method for airfoil parameterization
 */

export interface CSTParameters {
  upperWeights: number[]
  lowerWeights: number[]
  leWeight: number
  teThickness: number
  order: number
}

export interface CSTCoordinates {
  upperX: number[]
  upperY: number[]
  lowerX: number[]
  lowerY: number[]
}

/**
 * Calculate factorial
 */
const factorial = (n: number): number => {
  if (n === 0 || n === 1) return 1
  let result = 1
  for (let i = 2; i <= n; i++) result *= i
  return result
}

/**
 * Calculate binomial coefficient C(n, k)
 */
const comb = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0
  return factorial(n) / (factorial(k) * factorial(n - k))
}

/**
 * Upper and lower CST y at normalised chord station psi in [0, 1]
 */
function cstY(
  upperWeights: number[],
  lowerWeights: number[],
  leWeight: number,
  teThickness: number,
  order: number,
  psi: number,
): [number, number] {
  // Class function: C(ψ) = √ψ × (1-ψ)
  const C = Math.sqrt(psi) * (1 - psi)

  // Shape function: S(ψ) = Σ Aᵢ × Kᵢ × ψⁱ × (1-ψ)^(n-i)
  let S_upper = 0
  let S_lower = 0
  for (let j = 0; j <= order; j++) {
    const basis = comb(order, j) * psi ** j * (1 - psi) ** (order - j)
    S_upper += upperWeights[j] * basis
    S_lower += lowerWeights[j] * basis
  }

  // Leading edge modification term; exponent (weights + 0.5) matches the fit's LE column and AeroSandbox
  const leTerm = leWeight * psi * (1 - psi) ** (order + 1.5)

  // Trailing edge thickness offset
  const teHalf = teThickness / 2

  return [C * S_upper + leTerm + psi * teHalf, C * S_lower + leTerm - psi * teHalf]
}

/**
 * Generate CST coordinates from parameters
 * @param upperWeights Upper surface CST weights
 * @param lowerWeights Lower surface CST weights
 * @param leWeight Leading edge weight modifier
 * @param teThickness Trailing edge thickness
 * @param order Polynomial order (number of weights - 1)
 * @param numPoints Number of intervals per surface (each surface gets numPoints + 1 points, LE to TE)
 * @returns Generated coordinates
 */
export const generateCSTCoordinates = (
  upperWeights: number[],
  lowerWeights: number[],
  leWeight: number,
  teThickness: number,
  order: number,
  numPoints: number = 400
): CSTCoordinates => {
  const upperX: number[] = []
  const upperY: number[] = []
  const lowerX: number[] = []
  const lowerY: number[] = []

  for (let i = 0; i <= numPoints; i++) {
    const beta = (i / numPoints) * Math.PI
    const psi = 0.5 * (1.0 - Math.cos(beta)) // Cosine spacing
    const [yUpper, yLower] = cstY(upperWeights, lowerWeights, leWeight, teThickness, order, psi)

    upperX.push(psi)
    upperY.push(yUpper)
    lowerX.push(psi)
    lowerY.push(yLower)
  }

  return { upperX, upperY, lowerX, lowerY }
}

/**
 * Solve least-squares Ax=b via QR decomposition (Householder reflections).
 * Equivalent to np.linalg.lstsq. A is [m x n] with m >= n.
 */
const lstsq = (A: number[][], b: number[]): number[] => {
  const m = A.length
  const n = A[0].length

  // Deep copy A and b
  const R = A.map(row => [...row])
  const qt_b = [...b]

  // Householder QR
  for (let k = 0; k < n; k++) {
    // Compute norm of column k below diagonal
    let norm = 0
    for (let i = k; i < m; i++) norm += R[i][k] * R[i][k]
    norm = Math.sqrt(norm)

    if (norm === 0) continue

    const sign = R[k][k] >= 0 ? 1 : -1
    const alpha = -sign * norm

    // Householder vector
    const v = new Array(m).fill(0)
    for (let i = k; i < m; i++) v[i] = R[i][k]
    v[k] -= alpha
    let vNorm = 0
    for (let i = k; i < m; i++) vNorm += v[i] * v[i]

    if (vNorm === 0) continue

    // Apply reflection to R columns k..n-1
    for (let j = k; j < n; j++) {
      let dot = 0
      for (let i = k; i < m; i++) dot += v[i] * R[i][j]
      const scale = 2 * dot / vNorm
      for (let i = k; i < m; i++) R[i][j] -= scale * v[i]
    }

    // Apply reflection to qt_b
    let dot = 0
    for (let i = k; i < m; i++) dot += v[i] * qt_b[i]
    const scale = 2 * dot / vNorm
    for (let i = k; i < m; i++) qt_b[i] -= scale * v[i]
  }

  // Back substitution on upper triangular R
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = qt_b[i]
    for (let j = i + 1; j < n; j++) x[i] -= R[i][j] * x[j]
    x[i] /= R[i][i]
  }

  return x
}

/**
 * Fit CST parameters from existing airfoil coordinates using least-squares.
 * Mirrors the AeroSandbox get_kulfan_parameters() "least_squares" method.
 *
 * Input coordinates are separate upper/lower arrays as stored in the database.
 * They are combined into Selig-format (upper TE→LE, lower LE→TE) internally.
 *
 * @param upperX Upper surface X coordinates (TE to LE, descending)
 * @param upperY Upper surface Y coordinates
 * @param lowerX Lower surface X coordinates (LE to TE, ascending)
 * @param lowerY Lower surface Y coordinates
 * @param order Polynomial order (default 7 for 8 weights per side)
 * @returns Fitted CST parameters
 */
export const fitCSTParameters = (
  upperX: number[],
  upperY: number[],
  lowerX: number[],
  lowerY: number[],
  order: number = 7
): CSTParameters => {
  const nWeights = order + 1

  // Combine into Selig format: upper (TE→LE) then lower (LE→TE), skip duplicate LE point
  const x = [...upperX, ...lowerX.slice(1)]
  const y = [...upperY, ...lowerY.slice(1)]
  const nCoords = x.length

  // Normalize to [0, 1]
  const xMin = Math.min(...x)
  const xMax = Math.max(...x)
  const chord = xMax - xMin || 1
  const xn = x.map(v => (v - xMin) / chord)
  const yn = y.map(v => v / chord)

  // Find LE index (min x)
  let leIndex = 0
  let leMin = xn[0]
  for (let i = 1; i < nCoords; i++) {
    if (xn[i] < leMin) { leMin = xn[i]; leIndex = i }
  }

  // Determine which points are on the upper surface
  const isUpper: boolean[] = []
  for (let i = 0; i < nCoords; i++) isUpper.push(i <= leIndex)

  // N1=0.5, N2=1.0 (conventional airfoil)
  const N1 = 0.5
  const N2 = 1.0

  // Class function C(x) = x^N1 * (1-x)^N2
  const C = xn.map(xi => Math.pow(xi, N1) * Math.pow(1 - xi, N2))

  // Bernstein polynomial basis: S_matrix[j][i] for weight j, point i
  const N = nWeights - 1
  const K: number[] = []
  for (let j = 0; j <= N; j++) K.push(comb(N, j))

  const S_matrix: number[][] = []
  for (let j = 0; j <= N; j++) {
    const row: number[] = []
    for (let i = 0; i < nCoords; i++) {
      row.push(K[j] * Math.pow(xn[i], j) * Math.pow(1 - xn[i], N - j))
    }
    S_matrix.push(row)
  }

  // Build A matrix [nCoords x (2*nWeights + 2)]
  // Columns: lower_weights(0..nWeights-1), upper_weights(nWeights..2*nWeights-1),
  //          leading_edge_weight, trailing_edge_thickness
  const nCols = 2 * nWeights + 2
  const A: number[][] = []

  for (let i = 0; i < nCoords; i++) {
    const row = new Array(nCols).fill(0)

    for (let j = 0; j < nWeights; j++) {
      // Lower weight columns: active only where NOT upper
      if (!isUpper[i]) {
        row[j] = C[i] * S_matrix[j][i]
      }
      // Upper weight columns: active only where upper
      if (isUpper[i]) {
        row[nWeights + j] = C[i] * S_matrix[j][i]
      }
    }

    // Leading edge weight column
    row[2 * nWeights] = xn[i] * Math.pow(Math.max(1 - xn[i], 0), nWeights + 0.5)

    // Trailing edge thickness column
    row[2 * nWeights + 1] = isUpper[i] ? xn[i] / 2 : -xn[i] / 2

    A.push(row)
  }

  // Solve least-squares
  let solution = lstsq(A, yn)

  let lowerWeights = solution.slice(0, nWeights)
  let upperWeights = solution.slice(nWeights, 2 * nWeights)
  let leWeight = solution[2 * nWeights]
  let teThickness = solution[2 * nWeights + 1]

  // If TE thickness is negative, re-solve without that column
  if (teThickness < 0) {
    const A2 = A.map(row => row.slice(0, nCols - 1))
    solution = lstsq(A2, yn)

    lowerWeights = solution.slice(0, nWeights)
    upperWeights = solution.slice(nWeights, 2 * nWeights)
    leWeight = solution[2 * nWeights]
    teThickness = 0
  }

  // Sanitize outputs
  const sanitize = (arr: number[]) => arr.map(w => isNaN(w) || !isFinite(w) ? 0 : w)

  return {
    upperWeights: sanitize(upperWeights),
    lowerWeights: sanitize(lowerWeights),
    leWeight: isNaN(leWeight) || !isFinite(leWeight) ? 0 : leWeight,
    teThickness: isNaN(teThickness) || !isFinite(teThickness) ? 0 : teThickness,
    order,
  }
}

/**
 * Fit CST with `weights` weights per surface in the standard frame: true LE at the origin, TE midpoint on +x,
 * unit chord. Input in database ordering (upper TE→LE, lower LE→TE). Returns the parameters in that frame,
 * toInput mapping a point of that frame back to the input frame, and the RMS y error at the input points
 * (in input units).
 */
export function fitCSTNormalised(
  upperX: number[],
  upperY: number[],
  lowerX: number[],
  lowerY: number[],
  weights: number,
): { params: CSTParameters; toInput: (x: number, y: number) => [number, number]; rms: number } {
  // One loop TE→LE→TE, without the lower LE point when it repeats the upper one
  const dup = lowerX[0] === upperX.at(-1) && lowerY[0] === upperY.at(-1)
  const X = [...upperX, ...lowerX.slice(dup ? 1 : 0)]
  const Y = [...upperY, ...lowerY.slice(dup ? 1 : 0)]

  // True LE: the point farthest from the TE midpoint (stored LE can be off for cambered noses)
  const tx = (X[0] + X[X.length - 1]) / 2
  const ty = (Y[0] + Y[Y.length - 1]) / 2
  const dist = (i: number) => Math.hypot(X[i] - tx, Y[i] - ty)
  let le = 0
  for (let i = 1; i < X.length; i++) {
    if (dist(i) > dist(le))
      le = i
  }

  // The true LE usually falls between samples: take the farthest point on the parabola through le-1, le, le+1
  let [lx, ly] = [X[le], Y[le]]
  if (le > 0 && le < X.length - 1) {
    for (let t = -1; t <= 1; t += 0.005) {
      const qx = X[le] + t * (X[le + 1] - X[le - 1]) / 2 + t * t * (X[le + 1] - 2 * X[le] + X[le - 1]) / 2
      const qy = Y[le] + t * (Y[le + 1] - Y[le - 1]) / 2 + t * t * (Y[le + 1] - 2 * Y[le] + Y[le - 1]) / 2
      if (Math.hypot(qx - tx, qy - ty) > Math.hypot(lx - tx, ly - ty))
        [lx, ly] = [qx, qy]
    }
  }

  // Translate LE to the origin, rotate TE midpoint onto +x, scale chord to 1 (so every x >= 0)
  const [cx, cy] = [tx - lx, ty - ly]
  const c2 = cx * cx + cy * cy
  const xn = X.map((x, i) => ((x - lx) * cx + (Y[i] - ly) * cy) / c2)
  const yn = X.map((x, i) => ((Y[i] - ly) * cx - (x - lx) * cy) / c2)

  // Re-split at the true LE, which goes in both surfaces (CST passes through it, so it adds no error)
  const s = yn[le] > 0 ? le + 1 : le
  const p = fitCSTParameters(
    [...xn.slice(0, s), 0],
    [...yn.slice(0, s), 0],
    [0, ...xn.slice(s)],
    [0, ...yn.slice(s)],
    weights - 1,
  )
  const k = Math.max(...xn) // fitCSTParameters rescales x by its range [0, k]
  const ev = (x: number, side: number) =>
    cstY(p.upperWeights, p.lowerWeights, p.leWeight, p.teThickness, p.order, x / k)[side] * k
  const sq = xn.reduce((sum, x, i) => sum + (ev(x, i < s ? 0 : 1) - yn[i]) ** 2, 0)
  return {
    params: p,
    toInput: (x, y) => [lx + k * (x * cx - y * cy), ly + k * (x * cy + y * cx)],
    rms: Math.sqrt(sq / X.length * c2),
  }
}

/**
 * fitCSTNormalised, regenerated with `panels` panels per surface and mapped back to where the input airfoil sits.
 * Input and output use the database ordering: upper TE→LE, lower LE→TE, LE point in both surfaces;
 * each output surface has panels + 1 cosine-spaced points. rms as in fitCSTNormalised.
 */
export function fitCSTAirfoil(
  upperX: number[],
  upperY: number[],
  lowerX: number[],
  lowerY: number[],
  weights: number,
  panels: number,
): CSTCoordinates & { rms: number } {
  const { params: p, toInput, rms } = fitCSTNormalised(upperX, upperY, lowerX, lowerY, weights)
  const g = generateCSTCoordinates(p.upperWeights, p.lowerWeights, p.leWeight, p.teThickness, p.order, panels)
  const up = g.upperX.map((x, i) => toInput(x, g.upperY[i])).reverse()
  const lo = g.lowerX.map((x, i) => toInput(x, g.lowerY[i]))
  return {
    upperX: up.map(q => q[0]),
    upperY: up.map(q => q[1]),
    lowerX: lo.map(q => q[0]),
    lowerY: lo.map(q => q[1]),
    rms,
  }
}

/**
 * Smooth an airfoil: fitCSTAirfoil with 6, 7 and 8 weights per surface, keeping the lowest RMS error,
 * regenerated with 200 panels (101 points per surface, database ordering).
 * Throws if no order gives a finite fit, so the caller can fall back to the raw points.
 */
export function smoothAirfoilCST(
  upperX: number[],
  upperY: number[],
  lowerX: number[],
  lowerY: number[],
): CSTCoordinates & { weights: number; rms: number[] } {
  const rms: number[] = []
  let best: (CSTCoordinates & { weights: number }) | null = null
  let bestErr = Infinity
  for (const weights of [6, 7, 8]) {
    let err = NaN
    try {
      const fit = fitCSTAirfoil(upperX, upperY, lowerX, lowerY, weights, 100)
      err = fit.rms
      if (err < bestErr) { // NaN never wins
        best = { ...fit, weights }
        bestErr = err
      }
    }
    catch {
      // skip this order
    }
    rms.push(err)
  }
  if (!best)
    throw new Error('CST smoothing failed for 6, 7 and 8 weights per surface')
  return { ...best, rms }
}

/**
 * Composable function
 */
export const useCSTParameters = () => {
  return {
    generateCSTCoordinates,
    fitCSTNormalised,
    fitCSTAirfoil,
    smoothAirfoilCST,
  }
}

