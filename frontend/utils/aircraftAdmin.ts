/**
 * Pure helpers for the aircraft manager page.
 */
import { SOURCE_LABELS } from './aircraftUsage.ts'

export const AIRCRAFT_SURFACES = ['wing', 'upper_wing', 'lower_wing', 'fwd_wing', 'aft_wing', 'canard', 'rotor', 'tail', 'fin', 'winglet']
export const AIRCRAFT_POSITIONS = ['root', 'mid', 'tip', 'inboard', 'outboard', 'all', 'unspecified']
export const AIRCRAFT_CATEGORIES = ['conventional', 'canard-tandem', 'rotorcraft']

/** Same normalisation as the data pipeline: "Göppingen Gö 3 Minimoa" -> "goppingengo3minimoa" */
export const aircraftKey = (name: string) =>
  name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/** PostgREST `or` filter matching any column case-insensitively; the value is quoted so commas and brackets are safe */
export const ilikeAny = (columns: string[], query: string) => {
  const value = `"%${query.replace(/[\\"]/g, '\\$&')}%"`
  return columns.map(c => `${c}.ilike.${value}`).join(',')
}

// unknown surfaces/positions sort after the known ones
const rank = (list: string[], v: string) => (list.includes(v) ? list.indexOf(v) : list.length)

/** Surface (known order, then alphabetical), then position (root, mid, tip, inboard, outboard, all, unspecified) */
export const sortAssignments = <T extends { surface: string, position: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) =>
    rank(AIRCRAFT_SURFACES, a.surface) - rank(AIRCRAFT_SURFACES, b.surface)
    || a.surface.localeCompare(b.surface)
    || rank(AIRCRAFT_POSITIONS, a.position) - rank(AIRCRAFT_POSITIONS, b.position))

/** jsonb [{ name, url }] -> labelled http(s) links; anything else is dropped */
export const sourceLinks = (sources: unknown): { label: string, url: string }[] =>
  (Array.isArray(sources) ? sources : [])
    .filter(s => typeof s?.name === 'string' && typeof s?.url === 'string' && /^https?:\/\//.test(s.url))
    .map(s => ({ label: SOURCE_LABELS[s.name] ?? s.name, url: s.url }))
