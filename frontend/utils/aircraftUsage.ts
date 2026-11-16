/**
 * Groups aircraft_airfoils rows (one per surface + position) into one entry per aircraft for the airfoil page.
 */

/** A usage row with its joined aircraft, as fetched for one airfoil */
export interface AircraftUsageRow {
  surface: string
  position: string
  modified: boolean
  sources: unknown // jsonb [{ name, url }]
  aircraft: { key: string, name: string, display_name: string | null } | null
}

export interface AircraftUsage {
  key: string
  name: string
  placements: string
  modified: boolean
  sources: { label: string, url: string }[]
}

const SURFACE_LABELS: Record<string, string> = {
  upper_wing: 'upper wing',
  lower_wing: 'lower wing',
  fwd_wing: 'forward wing',
  aft_wing: 'aft wing',
  rotor: 'rotor blade',
}
const POSITION_ORDER = ['root', 'mid', 'tip', 'inboard', 'outboard']
const SOURCE_LABELS: Record<string, string> = { lednicer: 'Lednicer', wikipedia: 'Wikipedia', j2mcl: 'J2mcL' }

const joinWords = (words: string[]) =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`

/** "wing root and tip", "rotor blade, inboard"; 'all' or 'unspecified' alone give just the surface */
const placementLabel = (surface: string, positions: Set<string>) => {
  const label = SURFACE_LABELS[surface] ?? surface.replace(/_/g, ' ')
  const specific = POSITION_ORDER.filter(p => positions.has(p))
  if (positions.has('all') || specific.length === 0) return label
  return `${label}${surface === 'rotor' ? ', ' : ' '}${joinWords(specific)}`
}

export const groupAircraftUsage = (rows: AircraftUsageRow[]): AircraftUsage[] => {
  const byKey = new Map<string, { name: string, surfaces: Map<string, Set<string>>, modified: boolean, sources: Map<string, string> }>()
  for (const row of rows) {
    if (!row.aircraft) continue
    let entry = byKey.get(row.aircraft.key)
    if (!entry) {
      entry = { name: row.aircraft.display_name || row.aircraft.name, surfaces: new Map(), modified: false, sources: new Map() }
      byKey.set(row.aircraft.key, entry)
    }
    if (!entry.surfaces.has(row.surface)) entry.surfaces.set(row.surface, new Set())
    entry.surfaces.get(row.surface)!.add(row.position)
    entry.modified ||= row.modified
    for (const s of Array.isArray(row.sources) ? row.sources : []) {
      if (typeof s?.name === 'string' && typeof s?.url === 'string' && /^https?:\/\//.test(s.url) && !entry.sources.has(s.name))
        entry.sources.set(s.name, s.url)
    }
  }
  // fixed locale so the server and the browser sort the same way
  return [...byKey].map(([key, e]) => ({
    key,
    name: e.name,
    placements: [...e.surfaces].map(([surface, positions]) => placementLabel(surface, positions)).join('; '),
    modified: e.modified,
    sources: [...e.sources].map(([name, url]) => ({ label: SOURCE_LABELS[name] ?? name, url })),
  })).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }))
}
