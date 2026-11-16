import type { NACACoordinates } from './useNACAGenerator'
import { type Family, familyDef } from '../utils/airfoilFamilies.ts'
import { formatCoord, sanitizeFilename, sortLowerCoordinates, sortUpperCoordinates, triggerDownload } from './useAirfoilDownload.ts'

/**
 * Export generator parameters to CSV: metadata, then the family's rows from AIRFOIL_FAMILIES
 */
export const exportNACAParameters = (family: Family, params: unknown, airfoilName: string, fileBase: string = sanitizeFilename(airfoilName)) => {
  const lines = [
    'parameter_name,value',
    `airfoil_name,${airfoilName}`,
    `series_type,${family}`,
    `timestamp,${new Date().toISOString()}`,
    '',
    ...(familyDef(family).csvRows?.(params) ?? []),
  ]
  triggerDownload(lines.join('\n'), `${fileBase}_naca_parameters.csv`)
}

// Drops a point near ANY kept point of the surface. The library writers in useAirfoilDownload only compare with the
// previous point; this stricter rule is kept so generator files stay byte-identical to earlier exports.
const dedupe = (coords: Array<[number, number]>, tolerance: number = 5e-5) => {
  const kept: Array<[number, number]> = []
  coords.forEach((c) => {
    if (!kept.some(k => Math.abs(k[0] - c[0]) < tolerance && Math.abs(k[1] - c[1]) < tolerance))
      kept.push(c)
  })
  return kept
}

const line = (c: [number, number]) => `${formatCoord(c[0])}  ${formatCoord(c[1])}`
const count = (coords: unknown[]) => `${coords.length}.`.padStart(8)

/** Selig point order: upper TE->LE then lower LE->TE, the shared LE point once */
export const seligPoints = (c: NACACoordinates): Array<[number, number]> => {
  const upper = dedupe(sortUpperCoordinates(c.upperX, c.upperY))
  // Selig is one loop: the leading-edge point ends the upper surface, so drop it from the lower
  return [...upper, ...dedupe([upper[upper.length - 1], ...sortLowerCoordinates(c.lowerX, c.lowerY)]).slice(1)]
}

/** The Selig points as tab-separated x, y lines for pasting into a spreadsheet */
export const pointsToClipboardText = (c: NACACoordinates) =>
  seligPoints(c).map(p => `${p[0].toFixed(6)}\t${p[1].toFixed(6)}`).join('\n')

/**
 * Generated coordinates as {fileBase}_{suffix}_{format}.dat.
 * Selig: name, blank, then seligPoints. Lednicer: NAME, counts, blank, both LE->TE.
 */
export const exportCoordinates = (c: NACACoordinates, name: string, fileBase: string, suffix: 'naca' | 'cst', format: 'selig' | 'lednicer') => {
  let lines: string[]
  if (format === 'lednicer') {
    const upper = dedupe(sortLowerCoordinates(c.upperX, c.upperY))
    const lower = dedupe(sortLowerCoordinates(c.lowerX, c.lowerY))
    lines = [name.toUpperCase(), `${count(upper)}  ${count(lower)}`, '', ...upper.map(line), '', ...lower.map(line)]
  }
  else {
    lines = [name, '', ...seligPoints(c).map(line)]
  }
  triggerDownload(lines.join('\n'), `${fileBase}_${suffix}_${format}.dat`)
}
