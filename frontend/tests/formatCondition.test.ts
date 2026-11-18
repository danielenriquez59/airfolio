// Run: node --test tests/formatCondition.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { flapDeflection, formatCondition } from '../utils/formatCondition.ts'

// Shapes as backend/main.py stores performance_cache.inputs
const plain = { Re: 500000, Mach: 0.1, alpha_range: [-4, 16, 0.5], n_crit: 9, control_surface_fraction: 0, control_surface_deflection: 0 }
const flapped = { ...plain, flap_fraction: 0.75, deflection: 10 }

test('formatCondition: plain run has no flap parts', () => {
  assert.equal(formatCondition(plain), 'Re 500k, Mach 0.1, Ncrit 9, AoA Range [-4, 16]')
  assert.equal(flapDeflection(plain), 0)
})

test('formatCondition: flapped run reads flap_fraction / deflection', () => {
  assert.equal(formatCondition(flapped), 'Re 500k, Mach 0.1, Ncrit 9, AoA Range [-4, 16], Flap Fraction 0.75, Flap Deflection 10.0°')
  assert.equal(flapDeflection(flapped), 10)
})

test('formatCondition: missing inputs', () => {
  assert.equal(formatCondition(null), 'Unknown conditions')
  assert.equal(flapDeflection(null), null)
})
