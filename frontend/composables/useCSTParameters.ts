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
 * Generate CST coordinates from parameters
 * @param upperWeights Upper surface CST weights
 * @param lowerWeights Lower surface CST weights
 * @param leWeight Leading edge weight modifier
 * @param teThickness Trailing edge thickness
 * @param order Polynomial order (number of weights - 1)
 * @param numPoints Number of points to generate
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

  const K_LE = order + 0.5 // Leading edge exponent

  for (let i = 0; i <= numPoints; i++) {
    const beta = (i / numPoints) * Math.PI
    const psi = 0.5 * (1.0 - Math.cos(beta)) // Cosine spacing

    // Class function: C(ψ) = √ψ × (1-ψ)
    const C = Math.sqrt(psi) * (1 - psi)

    // Shape function: S(ψ) = Σ Aᵢ × Kᵢ × ψⁱ × (1-ψ)^(n-i)
    let S_upper = 0
    let S_lower = 0

    for (let j = 0; j <= order; j++) {
      const K = comb(order, j)
      const basis = K * Math.pow(psi, j) * Math.pow(1 - psi, order - j)
      S_upper += upperWeights[j] * basis
      S_lower += lowerWeights[j] * basis
    }

    // Leading edge modification term
    const leTerm = leWeight * psi * Math.pow(1 - psi, K_LE)

    // Trailing edge thickness offset
    const teHalf = teThickness / 2

    // Generate coordinates
    const x = psi
    const yUpper = C * S_upper + leTerm + psi * teHalf
    const yLower = C * S_lower + leTerm - psi * teHalf

    upperX.push(x)
    upperY.push(yUpper)
    lowerX.push(x)
    lowerY.push(yLower)
  }

  return { upperX, upperY, lowerX, lowerY }
}

/**
 * Fit CST parameters from existing airfoil coordinates using least-squares
 * @param upperX Upper surface X coordinates (TE to LE, descending)
 * @param upperY Upper surface Y coordinates
 * @param lowerX Lower surface X coordinates (LE to TE, ascending)
 * @param lowerY Lower surface Y coordinates
 * @param order Polynomial order (default 7 for 8 weights)
 * @returns Fitted CST parameters
 */
export const fitCSTParameters = (
  upperX: number[],
  upperY: number[],
  lowerX: number[],
  lowerY: number[],
  order: number = 7
): CSTParameters => {
  // Normalize coordinates to [0, 1] chord
  const allX = [...upperX, ...lowerX]
  const minX = Math.min(...allX)
  const maxX = Math.max(...allX)
  const chord = maxX - minX

  const normalizeX = (x: number) => (x - minX) / chord

  // Prepare data points with cosine spacing mapping
  const preparePoints = (x: number[], y: number[]): Array<{ psi: number; y: number }> => {
    return x.map((xVal, i) => {
      const normalizedX = normalizeX(xVal)
      // Map normalized X to psi (0 to 1)
      const psi = normalizedX
      return { psi, y: y[i] }
    })
  }

  // Fit weights for a surface using least-squares
  const fitWeights = (points: Array<{ psi: number; y: number }>): number[] => {
    const n = points.length
    const numWeights = order + 1
    const weights = new Array(numWeights).fill(0)

    // Build system of equations: y = C(ψ) × S(ψ) + LE_term
    // For simplicity, we'll solve for weights assuming LE weight is zero initially
    // Then extract LE weight from leading edge region

    // Create matrix A and vector b for Ax = b
    const A: number[][] = []
    const b: number[] = []

    for (const point of points) {
      const psi = point.psi
      const y = point.y

      // Class function
      const C = Math.sqrt(psi) * (1 - psi)

      // Build row for this point
      const row: number[] = []
      for (let j = 0; j <= order; j++) {
        const K = comb(order, j)
        const basis = K * Math.pow(psi, j) * Math.pow(1 - psi, order - j)
        row.push(C * basis)
      }
      A.push(row)
      b.push(y)
    }

    // Solve least-squares: (A^T A) x = A^T b
    // Simple implementation using normal equations
    const AT = A[0].map((_, colIdx) => A.map(row => row[colIdx]))
    const ATA = AT.map(row => A[0].map((_, colIdx) => 
      row.reduce((sum, val, idx) => sum + val * AT[idx][colIdx], 0)
    ))
    const ATb = AT.map(row => row.reduce((sum, val, idx) => sum + val * b[idx], 0))

    // Solve using Gaussian elimination (simplified)
    const solve = (matrix: number[][], vector: number[]): number[] => {
      const n = matrix.length
      const result = [...vector]

      // Forward elimination
      for (let i = 0; i < n; i++) {
        // Find pivot
        let maxRow = i
        for (let k = i + 1; k < n; k++) {
          if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) {
            maxRow = k
          }
        }
        // Swap rows
        [matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]]
        [result[i], result[maxRow]] = [result[maxRow], result[i]]

        // Eliminate
        for (let k = i + 1; k < n; k++) {
          const factor = matrix[k][i] / matrix[i][i]
          for (let j = i; j < n; j++) {
            matrix[k][j] -= factor * matrix[i][j]
          }
          result[k] -= factor * result[i]
        }
      }

      // Back substitution
      const x = new Array(n).fill(0)
      for (let i = n - 1; i >= 0; i--) {
        x[i] = result[i]
        for (let j = i + 1; j < n; j++) {
          x[i] -= matrix[i][j] * x[j]
        }
        x[i] /= matrix[i][i]
      }
      return x
    }

    const fittedWeights = solve(ATA, ATb)

    // Extract LE weight from leading edge region (first few points)
    const lePoints = points.slice(0, Math.min(10, points.length))
    let leWeight = 0
    if (lePoints.length > 0) {
      const avgPsi = lePoints.reduce((sum, p) => sum + p.psi, 0) / lePoints.length
      const K_LE = order + 0.5
      const leTerm = lePoints[0].y - (fittedWeights.reduce((sum, w, j) => {
        const K = comb(order, j)
        const basis = K * Math.pow(avgPsi, j) * Math.pow(1 - avgPsi, order - j)
        const C = Math.sqrt(avgPsi) * (1 - avgPsi)
        return sum + w * C * basis
      }, 0))
      leWeight = leTerm / (avgPsi * Math.pow(1 - avgPsi, K_LE))
    }

    return fittedWeights.map(w => isNaN(w) || !isFinite(w) ? 0 : w)
  }

  // Fit upper and lower surfaces
  const upperPoints = preparePoints(upperX, upperY)
  const lowerPoints = preparePoints(lowerX, lowerY)

  const upperWeights = fitWeights(upperPoints)
  const lowerWeights = fitWeights(lowerPoints)

  // Extract LE weight from leading edge region
  // Use the first point of upper and lower surfaces (should be near LE)
  const leUpperY = upperY[upperY.length - 1] || 0 // Last point of upper (LE)
  const leLowerY = lowerY[0] || 0 // First point of lower (LE)
  const leAvgY = (leUpperY + leLowerY) / 2
  
  // Estimate LE weight from leading edge shape (simplified)
  // This is a rough estimate - for more accuracy, would need iterative fitting
  const leWeight = leAvgY * 0.5 // Simplified estimate

  // Extract TE thickness from trailing edge coordinates
  const teUpperY = upperY[0] || 0 // First point of upper (TE)
  const teLowerY = lowerY[lowerY.length - 1] || 0 // Last point of lower (TE)
  const teThickness = Math.abs(teUpperY - teLowerY)

  return {
    upperWeights,
    lowerWeights,
    leWeight: isNaN(leWeight) || !isFinite(leWeight) ? 0.5 : leWeight,
    teThickness: isNaN(teThickness) || !isFinite(teThickness) ? 0.0001 : teThickness,
    order,
  }
}

/**
 * Composable function
 */
export const useCSTParameters = () => {
  return {
    generateCSTCoordinates,
    fitCSTParameters,
  }
}

