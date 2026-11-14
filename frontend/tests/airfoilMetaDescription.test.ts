// Run: node --test tests/airfoilMetaDescription.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { airfoilMetaDescription } from '../composables/useAirfoils.ts'

const base = {
  thickness_pct: 0.12, thickness_loc_pct: 0.3, camber_pct: 0.02, camber_loc_pct: 0.4,
  upper_x_coordinates: [1, 0.5, 0], lower_x_coordinates: [0, 0.5, 1], description: null,
} as any

test('airfoilMetaDescription: values, category and point count; default text without a description', () => {
  assert.equal(
    airfoilMetaDescription(base, 'NACA 2412', 'Naca 4-digit'),
    'NACA 2412 airfoil: 12.0% thick at 30.0% chord, 2.0% camber at 40.0% chord, Naca 4-digit, 6 points. Coordinates, geometry and polars.',
  )
})

test('airfoilMetaDescription: null values are left out, zero camber reads as symmetric', () => {
  const a = { ...base, thickness_pct: null, camber_pct: 0, camber_loc_pct: null, upper_x_coordinates: null, lower_x_coordinates: null }
  assert.equal(airfoilMetaDescription(a, 'X'), 'X airfoil: symmetric. Coordinates, geometry and polars.')
  assert.equal(airfoilMetaDescription({ ...a, camber_pct: null }, 'X'), 'X airfoil. Coordinates, geometry and polars.')
})

test('airfoilMetaDescription: a long description is cut at a word boundary under 160 characters', () => {
  const d = airfoilMetaDescription({ ...base, description: 'word '.repeat(60) }, 'NACA 2412')
  assert.ok(d.length <= 160, String(d.length))
  assert.ok(d.endsWith('word…'))
})
