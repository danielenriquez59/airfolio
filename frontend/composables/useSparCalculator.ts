import type { SparInputs, AirfoilDataPoint, SparCalculationResult } from '~/types/spar.types'

/**
 * Generate NACA 0012 coordinates with cosine spacing
 * Formula: y = +/- 0.6 * (0.2969*sqrt(x) - 0.1260*x - 0.3516*x^2 + 0.2843*x^3 - 0.1015*x^4)
 * scaled by chord t (12% for 0012 -> 0.12)
 */
export const generateNACA0012 = (
  chord: number,
  skinThickness: number,
  numPoints: number = 100
): AirfoilDataPoint[] => {
  const data: AirfoilDataPoint[] = []

  // Inner skin chord = outer chord - 2 * skin thickness
  const innerChord = chord - 2 * skinThickness

  // Cosine spacing for better resolution at leading/trailing edges
  for (let i = 0; i <= numPoints; i++) {
    const beta = (Math.PI * i) / numPoints
    const xNorm = (1 - Math.cos(beta)) / 2 // Normalized x (0 to 1)
    
    // NACA 0012 thickness distribution constants
    const t = 0.12
    const a0 = 0.2969
    const a1 = -0.1260
    const a2 = -0.3516
    const a3 = 0.2843
    const a4 = -0.1015

    const yt = 5 * t * (
      a0 * Math.sqrt(xNorm) +
      a1 * xNorm +
      a2 * Math.pow(xNorm, 2) +
      a3 * Math.pow(xNorm, 3) +
      a4 * Math.pow(xNorm, 4)
    )

    // Outer surface coordinates
    const xActual = xNorm * chord
    const yUpper = yt * chord
    const yLower = -yt * chord

    // Inner skin: Scale thickness to maintain constant gap at max thickness
    // We can't use innerChord scaling for Y because airfoil is thin (thickness << chord)
    // Scale factor for thickness = (MaxThickness - 2*skin) / MaxThickness
    // For NACA 0012, MaxThickness is 12% of chord
    const maxThickness = 0.12 * chord
    const thicknessScale = (maxThickness - 2 * skinThickness) / maxThickness
    
    // Apply scaling to Y values (relative to camber line, which is 0 for 0012)
    // We handle the X translation in the visualizer
    let yUpperInner = yUpper * thicknessScale
    let yLowerInner = yLower * thicknessScale

    // Handle case where skin is too thick (negative thickness)
    if (thicknessScale <= 0) {
      yUpperInner = 0
      yLowerInner = 0
    }

    data.push({
      x: xActual,
      yUpper,
      yLower,
      yUpperInner,
      yLowerInner,
      thickness: yUpper - yLower,
      camber: (yUpper + yLower) / 2  // Camber line is midpoint between upper and lower
    })
  }

  return data
}

/**
 * Sort and pair coordinate arrays by x value (ascending)
 */
const sortCoordinatesByX = (xArr: number[], yArr: number[]): { x: number[], y: number[] } => {
  // Create paired array, sort by x, then split back
  const paired = xArr.map((x, i) => ({ x, y: yArr[i] }))
  paired.sort((a, b) => a.x - b.x)
  return {
    x: paired.map(p => p.x),
    y: paired.map(p => p.y)
  }
}

/**
 * Process airfoil coordinates from database into chart-ready data points
 * Interpolates upper and lower surfaces to a common x-grid
 */
export const processAirfoilCoordinates = (
  upperX: number[],
  upperY: number[],
  lowerX: number[],
  lowerY: number[],
  chord: number,
  skinThickness: number,
  numPoints: number = 100
): AirfoilDataPoint[] => {
  // Sort coordinates by x (ascending) to ensure proper interpolation
  const sortedUpper = sortCoordinatesByX(upperX, upperY)
  const sortedLower = sortCoordinatesByX(lowerX, lowerY)

  // Inner skin chord = outer chord - 2 * skin thickness
  const innerChord = chord - 2 * skinThickness

  // Create common x-grid with cosine spacing
  const xGrid: number[] = []
  for (let i = 0; i <= numPoints; i++) {
    const beta = (Math.PI * i) / numPoints
    const xNorm = (1 - Math.cos(beta)) / 2
    xGrid.push(xNorm)
  }

  // Interpolate on sorted arrays
  const interpolate = (xTarget: number, xArr: number[], yArr: number[]): number => {
    // Handle edge cases
    if (xArr.length === 0) return 0
    if (xTarget <= xArr[0]) return yArr[0]
    if (xTarget >= xArr[xArr.length - 1]) return yArr[yArr.length - 1]
    
    // Binary search for efficiency on sorted arrays
    let left = 0
    let right = xArr.length - 1
    
    while (left < right - 1) {
      const mid = Math.floor((left + right) / 2)
      if (xArr[mid] <= xTarget) {
        left = mid
      } else {
        right = mid
      }
    }

    const p1 = { x: xArr[left], y: yArr[left] }
    const p2 = { x: xArr[right], y: yArr[right] }

    // Avoid division by zero
    if (p2.x === p1.x) return p1.y

    const ratio = (xTarget - p1.x) / (p2.x - p1.x)
    return p1.y + ratio * (p2.y - p1.y)
  }

  // Pre-calculate max thickness for scaling
  let maxThicknessNorm = 0
  for (const xNorm of xGrid) {
    const yUp = interpolate(xNorm, sortedUpper.x, sortedUpper.y)
    const yLow = interpolate(xNorm, sortedLower.x, sortedLower.y)
    const t = yUp - yLow
    if (t > maxThicknessNorm) maxThicknessNorm = t
  }
  
  // Calculate thickness scaling factor
  const maxThickness = maxThicknessNorm * chord
  const thicknessScale = maxThickness > 0 ? (maxThickness - 2 * skinThickness) / maxThickness : 0

  const data: AirfoilDataPoint[] = []

  for (const xNorm of xGrid) {
    // Interpolate upper and lower surfaces using sorted arrays (normalized coords)
    const yUpperNorm = interpolate(xNorm, sortedUpper.x, sortedUpper.y)
    const yLowerNorm = interpolate(xNorm, sortedLower.x, sortedLower.y)

    // Outer surface: scale by outer chord
    const xActual = xNorm * chord
    const yUpper = yUpperNorm * chord
    const yLower = yLowerNorm * chord

    // Calculate camber and thickness
    const camber = (yUpper + yLower) / 2
    const halfThickness = (yUpper - yLower) / 2

    // Inner skin coordinates:
    // Scale thickness relative to camber line
    // We handle X translation in the visualizer
    let innerHalfThickness = halfThickness * thicknessScale
    
    if (thicknessScale <= 0) innerHalfThickness = 0
    
    const yUpperInner = camber + innerHalfThickness
    const yLowerInner = camber - innerHalfThickness

    data.push({
      x: xActual,
      yUpper,
      yLower,
      yUpperInner,
      yLowerInner,
      thickness: yUpper - yLower,
      camber,
    })
  }

  return data
}

/**
 * Linear interpolation to find Y values at a specific X
 */
export const interpolateAirfoil = (
  xTarget: number,
  data: AirfoilDataPoint[]
): { yUpper: number; yLower: number } => {
  // Find index where x is just greater than xTarget
  const index = data.findIndex(p => p.x >= xTarget)
  
  if (index === -1) {
    // Past trailing edge
    const last = data[data.length - 1]
    return { yUpper: last.yUpper, yLower: last.yLower }
  }
  if (index === 0) {
    // Before leading edge
    return { yUpper: data[0].yUpper, yLower: data[0].yLower }
  }

  const p1 = data[index - 1]
  const p2 = data[index]

  const ratio = (xTarget - p1.x) / (p2.x - p1.x)

  const yUpper = p1.yUpper + ratio * (p2.yUpper - p1.yUpper)
  const yLower = p1.yLower + ratio * (p2.yLower - p1.yLower)

  return { yUpper, yLower }
}

/**
 * Calculate spar properties: height and moment of inertia
 * Supports different cross-section types: hollow rectangle, I-beam, C-channel
 */
export const calculateSparProperties = (
  inputs: SparInputs,
  airfoilData: AirfoilDataPoint[]
): SparCalculationResult => {
  const { chordLength, sparLocation, skinThickness, sparWidth, sparWallThickness, crossSection } = inputs
  const xActual = sparLocation * chordLength

  // Get outer bounds at spar location
  const { yUpper, yLower } = interpolateAirfoil(xActual, airfoilData)
  
  // Outer Airfoil Thickness at this location
  const localAirfoilThickness = yUpper - yLower

  // Calculate available spar height (bounded by skin)
  const sparHeight = localAirfoilThickness - (2 * skinThickness)

  if (sparHeight <= 0) {
    return {
      sparHeight: 0,
      outerMomentOfInertia: 0,
      innerMomentOfInertia: 0,
      netMomentOfInertia: 0,
      area: 0,
      valid: false,
      error: "Spar cannot fit: Skin is thicker than airfoil at this location."
    }
  }

  // Spar outer dimensions
  const B = sparWidth
  const H = sparHeight
  const t = sparWallThickness

  // Check if wall thickness is valid
  if (t <= 0 || t >= B / 2 || t >= H / 2) {
     return {
      sparHeight: H,
      outerMomentOfInertia: 0,
      innerMomentOfInertia: 0,
      netMomentOfInertia: 0,
      area: 0,
      valid: false,
      error: "Invalid Wall Thickness: Must be positive and less than half of width or height."
    }
  }

  let outerIx = 0
  let innerIx = 0
  let netIx = 0
  let area = 0

  // Calculate based on cross-section type
  switch (crossSection) {
    case 'hollow-rectangle': {
      // Hollow rectangle: Ix = (BH³ - bh³) / 12
      const b = B - (2 * t)
      const h = H - (2 * t)
      
      outerIx = (B * Math.pow(H, 3)) / 12
      innerIx = (b * Math.pow(h, 3)) / 12
      netIx = outerIx - innerIx
      area = (B * H) - (b * h)
      break
    }

    case 'i-beam': {
      // I-beam: Two flanges (top and bottom) and a vertical web
      // Flange width = B, height = t
      // Web width = t, height = H
      // Ix = 2 * [B*t³/12 + B*t*(H/2 - t/2)²] + [t*H³/12]
      
      const flangeWidth = B
      const flangeHeight = t
      const webWidth = t
      const webHeight = H - 2 * t // Web between flanges
      
      // Top flange contribution
      const topFlangeIx = (flangeWidth * Math.pow(flangeHeight, 3)) / 12
      const topFlangeArea = flangeWidth * flangeHeight
      const topFlangeDistance = (H / 2) - (flangeHeight / 2)
      const topFlangeParallel = topFlangeIx + topFlangeArea * Math.pow(topFlangeDistance, 2)
      
      // Bottom flange (symmetric to top)
      const bottomFlangeParallel = topFlangeParallel
      
      // Web contribution
      const webIx = (webWidth * Math.pow(webHeight, 3)) / 12
      
      outerIx = topFlangeParallel + bottomFlangeParallel + webIx
      innerIx = 0 // No hollow part in standard I-beam
      netIx = outerIx
      area = 2 * (flangeWidth * flangeHeight) + (webWidth * webHeight)
      break
    }

    case 'c-channel': {
      // C-channel: Top flange, bottom flange, and vertical web on one side
      // Flanges: width = B, height = t
      // Web: width = t, height = H
      // Calculate about centroidal axis
      
      const flangeWidth = B
      const flangeHeight = t
      const webWidth = t
      const webHeight = H - 2 * t // Web between flanges
      
      // Total area
      area = 2 * (flangeWidth * flangeHeight) + (webWidth * webHeight)
      
      // Find centroid (distance from left edge)
      const topFlangeArea = flangeWidth * flangeHeight
      const topFlangeCentroid = flangeWidth / 2
      const bottomFlangeArea = flangeWidth * flangeHeight
      const bottomFlangeCentroid = flangeWidth / 2
      const webArea = webWidth * webHeight
      const webCentroid = webWidth / 2
      
      const xBar = (
        topFlangeArea * topFlangeCentroid +
        bottomFlangeArea * bottomFlangeCentroid +
        webArea * webCentroid
      ) / area
      
      // Calculate Ix about centroidal horizontal axis
      // Top flange
      const topFlangeIx = (flangeWidth * Math.pow(flangeHeight, 3)) / 12
      const topFlangeYDist = (H / 2) - (flangeHeight / 2)
      const topFlangeParallel = topFlangeIx + topFlangeArea * Math.pow(topFlangeYDist, 2)
      
      // Bottom flange
      const bottomFlangeIx = (flangeWidth * Math.pow(flangeHeight, 3)) / 12
      const bottomFlangeYDist = (H / 2) - (flangeHeight / 2)
      const bottomFlangeParallel = bottomFlangeIx + bottomFlangeArea * Math.pow(bottomFlangeYDist, 2)
      
      // Web (vertical)
      const webIx = (webWidth * Math.pow(webHeight, 3)) / 12
      
      outerIx = topFlangeParallel + bottomFlangeParallel + webIx
      innerIx = 0 // No hollow part
      netIx = outerIx
      break
    }

    default: {
      return {
        sparHeight: H,
        outerMomentOfInertia: 0,
        innerMomentOfInertia: 0,
        netMomentOfInertia: 0,
        area: 0,
        valid: false,
        error: "Invalid cross-section type."
      }
    }
  }

  return {
    sparHeight: H,
    outerMomentOfInertia: outerIx,
    innerMomentOfInertia: innerIx,
    netMomentOfInertia: netIx,
    area,
    valid: true
  }
}

export const useSparCalculator = () => {
  return {
    generateNACA0012,
    processAirfoilCoordinates,
    interpolateAirfoil,
    calculateSparProperties
  }
}

