// URL <-> filter state for the Performance page; shared links depend on these parameter names and formats
export const PERFORMANCE_RANGE_KEYS = ['thickness', 'camber', 'area'] as const
export const PERFORMANCE_FILTER_KEYS = ['maxCMRoughness', 'minCMAtZero', 'minMaxLD', 'maxMaxLD', 'minCLMax', 'maxCLMax', 'targetCL', 'targetAOA'] as const

type RangeKey = typeof PERFORMANCE_RANGE_KEYS[number]
type FilterKey = typeof PERFORMANCE_FILTER_KEYS[number]

export interface PerformanceQueryState {
  includeName: string
  excludeName: string
  ranges: Record<RangeKey, { enabled: boolean; min?: number; max?: number }>
  Re: number // thousands
  Mach: number
  alphaMin: number
  alphaMax: number
  nCrit: number
  selectionMode: 'all' | 'specific'
  selectedIds: readonly string[]
  filters: Partial<Record<FilterKey, number | null>>
  selected?: readonly string[]
}

export function readPerformanceQuery(query: Record<string, any>): PerformanceQueryState {
  const num = (k: string, fallback?: number) => (query[k] ? Number.parseFloat(query[k]) : fallback)
  const s: PerformanceQueryState = {
    includeName: query.includeName || '',
    excludeName: query.excludeName || '',
    ranges: {} as PerformanceQueryState['ranges'],
    Re: query.Re ? Number.parseFloat(query.Re) / 1000 : 500,
    Mach: num('Mach', 0)!,
    alphaMin: num('alphaMin', -5)!,
    alphaMax: num('alphaMax', 20)!,
    nCrit: num('nCrit', 9)!,
    selectionMode: query.selectionMode === 'specific' ? 'specific' : 'all',
    selectedIds: query.selectedIds ? query.selectedIds.split(',').filter(Boolean) : [],
    filters: {},
  }
  for (const k of PERFORMANCE_RANGE_KEYS) {
    const enabled = query[`${k}Enabled`] === 'true'
    s.ranges[k] = { enabled, min: enabled ? num(`${k}Min`) : undefined, max: enabled ? num(`${k}Max`) : undefined }
  }
  // Only filters present in the URL, so the page applies just those
  for (const k of PERFORMANCE_FILTER_KEYS) {
    if (query[k])
      s.filters[k] = Number.parseFloat(query[k])
  }
  if (query.selected)
    s.selected = query.selected.split(',').filter(Boolean)
  return s
}

export function writePerformanceQuery(s: PerformanceQueryState): Record<string, string> {
  const query: Record<string, string> = {}
  if (s.includeName.trim())
    query.includeName = s.includeName.trim()
  if (s.excludeName.trim())
    query.excludeName = s.excludeName.trim()
  for (const k of PERFORMANCE_RANGE_KEYS) {
    const r = s.ranges[k]
    if (!r.enabled)
      continue
    if (r.min !== undefined)
      query[`${k}Min`] = r.min.toString()
    if (r.max !== undefined)
      query[`${k}Max`] = r.max.toString()
    query[`${k}Enabled`] = 'true'
  }
  query.Re = (s.Re * 1000).toString()
  query.Mach = s.Mach.toString()
  query.alphaMin = s.alphaMin.toString()
  query.alphaMax = s.alphaMax.toString()
  query.nCrit = s.nCrit.toString()
  query.selectionMode = s.selectionMode
  if (s.selectionMode === 'specific' && s.selectedIds.length > 0)
    query.selectedIds = s.selectedIds.join(',')
  for (const k of PERFORMANCE_FILTER_KEYS) {
    const v = s.filters[k]
    if (v !== null && v !== undefined)
      query[k] = v.toString()
  }
  if (s.selected?.length)
    query.selected = s.selected.join(',')
  return query
}
