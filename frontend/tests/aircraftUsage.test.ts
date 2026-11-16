// Run: node --test tests/aircraftUsage.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupAircraftUsage } from '../utils/aircraftUsage.ts'

const ac = (key: string, name: string, display_name: string | null = null) => ({ key, name, display_name })
const row = (aircraft: ReturnType<typeof ac>, surface: string, position: string, extra: object = {}) =>
  ({ aircraft, surface, position, modified: false, sources: [], ...extra })

const placements = (...rows: ReturnType<typeof row>[]) => groupAircraftUsage(rows)[0].placements

test('groupAircraftUsage: positions merge per surface', () => {
  const a = ac('a', 'A')
  assert.equal(placements(row(a, 'wing', 'all')), 'wing')
  assert.equal(placements(row(a, 'wing', 'unspecified')), 'wing')
  assert.equal(placements(row(a, 'wing', 'root')), 'wing root')
  assert.equal(placements(row(a, 'wing', 'tip'), row(a, 'wing', 'root')), 'wing root and tip')
  assert.equal(placements(row(a, 'wing', 'tip'), row(a, 'wing', 'mid'), row(a, 'wing', 'root')), 'wing root, mid and tip')
  assert.equal(placements(row(a, 'rotor', 'unspecified')), 'rotor blade')
  assert.equal(placements(row(a, 'rotor', 'inboard')), 'rotor blade, inboard')
  assert.equal(placements(row(a, 'rotor', 'outboard'), row(a, 'rotor', 'inboard')), 'rotor blade, inboard and outboard')
  assert.equal(placements(row(a, 'fwd_wing', 'all'), row(a, 'aft_wing', 'root')), 'forward wing; aft wing root')
  assert.equal(placements(row(a, 'upper_wing', 'all'), row(a, 'lower_wing', 'all'), row(a, 'canard', 'all')), 'upper wing; lower wing; canard')
  assert.equal(placements(row(a, 'tail', 'all'), row(a, 'fin', 'all'), row(a, 'winglet', 'all')), 'tail; fin; winglet')
})

test('groupAircraftUsage: one entry per aircraft with display name, modified flag and de-duplicated sources', () => {
  const a = ac('a', 'Recorded', 'Shown')
  const [entry, ...rest] = groupAircraftUsage([
    row(a, 'wing', 'root', { sources: [{ name: 'lednicer', url: 'https://l/1' }, { name: 'wikipedia', url: 'https://w' }] }),
    row(a, 'wing', 'tip', { modified: true, sources: [{ name: 'lednicer', url: 'https://l/2' }, { name: 'j2mcl', url: 'https://j' }] }),
  ])
  assert.equal(rest.length, 0)
  assert.deepEqual(entry, {
    key: 'a',
    name: 'Shown',
    placements: 'wing root and tip',
    modified: true,
    sources: [{ label: 'Lednicer', url: 'https://l/1' }, { label: 'Wikipedia', url: 'https://w' }, { label: 'J2mcL', url: 'https://j' }],
  })
})

test('groupAircraftUsage: only http(s) source links are kept', () => {
  const [entry] = groupAircraftUsage([row(ac('a', 'A'), 'wing', 'all', { sources: [
    { name: 'x', url: 'javascript:alert(1)' },
    { name: 'y', url: '' },
    { name: 'z', url: '/relative/path' },
    { name: 'lednicer', url: 'https://l' },
    { name: 'wikipedia', url: 'http://w' },
  ] })])
  assert.deepEqual(entry.sources, [{ label: 'Lednicer', url: 'https://l' }, { label: 'Wikipedia', url: 'http://w' }])
})

test('groupAircraftUsage: sorted by name ignoring case and accents, numbers in order', () => {
  const names = groupAircraftUsage([
    row(ac('1', 'cessna 172'), 'wing', 'all'),
    row(ac('2', 'Éclipse'), 'wing', 'all'),
    row(ac('3', 'Beech 99'), 'wing', 'all'),
    row(ac('4', 'Beech 200'), 'wing', 'all'),
    row(ac('5', 'Airbus'), 'wing', 'all'),
  ]).map(e => e.name)
  assert.deepEqual(names, ['Airbus', 'Beech 99', 'Beech 200', 'cessna 172', 'Éclipse'])
})

test('groupAircraftUsage: empty input and rows without an aircraft give no entries', () => {
  assert.deepEqual(groupAircraftUsage([]), [])
  assert.deepEqual(groupAircraftUsage([{ aircraft: null, surface: 'wing', position: 'all', modified: false, sources: null }]), [])
})
