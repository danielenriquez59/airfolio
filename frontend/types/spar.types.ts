export type SparCrossSection = 'hollow-rectangle' | 'i-beam' | 'c-channel'
export type UnitSystem = 'mm' | 'in' | 'm' | 'ft'

export interface SparInputs {
  chordLength: number      // mm, in, m, or ft
  skinThickness: number    // mm, in, m, or ft
  skinOffset: number       // mm, in, m, or ft - offset added to skin thickness
  sparLocation: number     // normalized 0-1 (x/c)
  sparWidth: number        // mm, in, m, or ft
  sparWallThickness: number // mm, in, m, or ft
  crossSection: SparCrossSection
  unitSystem: UnitSystem
}

export interface AirfoilDataPoint {
  x: number
  yUpper: number
  yLower: number
  yUpperInner: number
  yLowerInner: number
  thickness: number
  camber: number  // Camber line: (yUpper + yLower) / 2
}

export interface SparCalculationResult {
  sparHeight: number
  outerMomentOfInertia: number
  innerMomentOfInertia: number
  netMomentOfInertia: number
  area: number
  valid: boolean
  error?: string
}

