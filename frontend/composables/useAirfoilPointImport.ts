/**
 * Parse and normalize uploaded airfoil coordinate files for Bezier fitting.
 */

export interface CoordinatePair {
  x: number
  y: number
}

export interface PointImportResult {
  upperX: number[]
  upperY: number[]
  lowerX: number[]
  lowerY: number[]
  name?: string
  warnings: string[]
  error?: string
}

const MIN_POINTS_PER_SURFACE = 2
const X_TOLERANCE = 1e-5

function parseNumericPair(line: string): CoordinatePair | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//'))
    return null

  const parts = trimmed.split(/[,\s\t]+/).map(p => p.trim()).filter(Boolean)
  if (parts.length < 2)
    return null

  const x = Number.parseFloat(parts[0])
  const y = Number.parseFloat(parts[1])
  if (!Number.isFinite(x) || !Number.isFinite(y))
    return null

  return { x, y }
}

function detectDelimiter(line: string): ',' | 'whitespace' {
  return line.includes(',') ? ',' : 'whitespace'
}

function parseRows(content: string): { name?: string; sections: CoordinatePair[][]; warnings: string[] } {
  const warnings: string[] = []
  const rawLines = content.split(/\r?\n/)
  const sections: CoordinatePair[][] = [[]]
  let name: string | undefined
  let startedData = false

  for (const rawLine of rawLines) {
    const line = rawLine.trim()

    if (!line) {
      if (sections[sections.length - 1].length > 0)
        sections.push([])
      continue
    }

    const pair = parseNumericPair(line)
    if (!pair) {
      if (!startedData && !name)
        name = line.replace(/^#+\s*/, '').trim()
      else
        warnings.push(`Skipped non-numeric line: "${line.slice(0, 40)}${line.length > 40 ? '…' : ''}"`)
      continue
    }

    startedData = true
    if (sections[sections.length - 1] === undefined)
      sections[sections.length - 1] = []
    sections[sections.length - 1].push(pair)
  }

  return { name, sections: sections.filter(s => s.length > 0), warnings }
}

function findLeadingEdgeIndex(points: CoordinatePair[]): number {
  let minX = Infinity
  let minIndex = 0
  for (let i = 0; i < points.length; i++) {
    if (points[i].x < minX) {
      minX = points[i].x
      minIndex = i
    }
  }

  for (let i = 1; i < points.length - 1; i++) {
    const prevX = points[i - 1].x
    const currX = points[i].x
    const nextX = points[i + 1].x
    if (prevX > currX && nextX > currX)
      return i
  }

  return minIndex
}

function splitAtLeadingEdge(points: CoordinatePair[]): { upper: CoordinatePair[]; lower: CoordinatePair[] } {
  const leIndex = findLeadingEdgeIndex(points)
  const upper = points.slice(0, leIndex + 1)
  const lower = points.slice(leIndex)
  if (lower.length === 0)
    lower.push(...points.slice(leIndex))
  return { upper, lower }
}

function groupByXStation(points: CoordinatePair[]): { upper: CoordinatePair[]; lower: CoordinatePair[] } {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const upper: CoordinatePair[] = []
  const lower: CoordinatePair[] = []

  let i = 0
  while (i < sorted.length) {
    const x0 = sorted[i].x
    const group: CoordinatePair[] = []
    while (i < sorted.length && Math.abs(sorted[i].x - x0) <= X_TOLERANCE) {
      group.push(sorted[i])
      i++
    }

    if (group.length === 1) {
      const p = group[0]
      if (p.y >= 0) {
        upper.push(p)
        if (Math.abs(p.y) < X_TOLERANCE)
          lower.push({ x: p.x, y: p.y })
      }
      else {
        lower.push(p)
      }
      continue
    }

    const maxY = group.reduce((best, p) => (p.y > best.y ? p : best), group[0])
    const minY = group.reduce((best, p) => (p.y < best.y ? p : best), group[0])
    upper.push(maxY)
    lower.push(minY)
  }

  return { upper, lower }
}

function sortSurfaceAscending(points: CoordinatePair[]): CoordinatePair[] {
  return [...points].sort((a, b) => a.x - b.x || a.y - b.y)
}

function dedupePoints(points: CoordinatePair[], tolerance = 1e-6): CoordinatePair[] {
  const result: CoordinatePair[] = []
  for (const p of points) {
    const dup = result.some(
      r => Math.abs(r.x - p.x) < tolerance && Math.abs(r.y - p.y) < tolerance,
    )
    if (!dup)
      result.push(p)
  }
  return result
}

function normalizeChord(
  upper: CoordinatePair[],
  lower: CoordinatePair[],
): { upper: CoordinatePair[]; lower: CoordinatePair[]; warnings: string[] } {
  const warnings: string[] = []
  const all = [...upper, ...lower]
  if (all.length === 0)
    return { upper, lower, warnings }

  const xs = all.map(p => p.x)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const chord = maxX - minX

  if (chord <= 0) {
    warnings.push('Could not determine chord length from X coordinates')
    return { upper, lower, warnings }
  }

  const needsNormalize = maxX > 1.001 || minX < -0.001 || Math.abs(maxX - 1) > 0.05
  if (!needsNormalize)
    return { upper, lower, warnings }

  warnings.push(`Normalized coordinates from chord ${chord.toFixed(4)} to 0–1`)

  const scale = (p: CoordinatePair): CoordinatePair => ({
    x: (p.x - minX) / chord,
    y: p.y / chord,
  })

  return {
    upper: upper.map(scale),
    lower: lower.map(scale),
    warnings,
  }
}

function toArrays(surface: CoordinatePair[]): { x: number[]; y: number[] } {
  return {
    x: surface.map(p => p.x),
    y: surface.map(p => p.y),
  }
}

export function parseAirfoilPointFile(
  content: string,
  filename?: string,
): PointImportResult {
  const warnings: string[] = []
  const { name: headerName, sections, warnings: parseWarnings } = parseRows(content)
  warnings.push(...parseWarnings)

  const name = headerName || (filename ? filename.replace(/\.[^.]+$/, '') : undefined)

  if (sections.length === 0) {
    return {
      upperX: [],
      upperY: [],
      lowerX: [],
      lowerY: [],
      name,
      warnings,
      error: 'No coordinate data found in file',
    }
  }

  let upper: CoordinatePair[]
  let lower: CoordinatePair[]

  if (sections.length >= 2) {
    upper = sections[0]
    lower = sections[1]
    if (sections.length > 2)
      warnings.push(`Found ${sections.length} sections; using first two as upper and lower surfaces`)
  }
  else {
    const points = sections[0]
    const leSplit = splitAtLeadingEdge(points)
    const grouped = groupByXStation(points)

    const leUpperCount = leSplit.upper.length
    const leLowerCount = leSplit.lower.length
    const groupedCount = grouped.upper.length + grouped.lower.length

    if (leUpperCount >= MIN_POINTS_PER_SURFACE && leLowerCount >= MIN_POINTS_PER_SURFACE
      && leUpperCount + leLowerCount >= groupedCount * 0.8) {
      upper = leSplit.upper
      lower = leSplit.lower
      warnings.push('Split single contour at leading edge')
    }
    else {
      upper = grouped.upper
      lower = grouped.lower
      warnings.push('Split points by X station (max Y = upper, min Y = lower)')
    }
  }

  upper = dedupePoints(sortSurfaceAscending(upper))
  lower = dedupePoints(sortSurfaceAscending(lower))

  const normalized = normalizeChord(upper, lower)
  warnings.push(...normalized.warnings)
  upper = normalized.upper
  lower = normalized.lower

  if (upper.length < MIN_POINTS_PER_SURFACE || lower.length < MIN_POINTS_PER_SURFACE) {
    return {
      upperX: [],
      upperY: [],
      lowerX: [],
      lowerY: [],
      name,
      warnings,
      error: `Need at least ${MIN_POINTS_PER_SURFACE} points per surface (upper: ${upper.length}, lower: ${lower.length})`,
    }
  }

  const upperArr = toArrays(upper)
  const lowerArr = toArrays(lower)

  return {
    upperX: upperArr.x,
    upperY: upperArr.y,
    lowerX: lowerArr.x,
    lowerY: lowerArr.y,
    name,
    warnings,
  }
}

export const useAirfoilPointImport = () => ({
  parseAirfoilPointFile,
  parseNumericPair,
  detectDelimiter,
})
