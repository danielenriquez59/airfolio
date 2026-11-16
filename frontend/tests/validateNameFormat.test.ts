// Run: node --test tests/validateNameFormat.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateNameFormat } from '../composables/useAirfoilUpload.ts'

test('validateNameFormat: letters, digits, spaces, hyphens, underscores and periods pass', () => {
  for (const name of ['NACA-2412', 'My Foil 1.2_b'])
    assert.deepEqual(validateNameFormat(name), { valid: true }, name)
})

test('validateNameFormat: special characters, empty and no-alphanumeric names fail', () => {
  for (const name of ['DP1,68-8,37', 'a&b', 'foil/2', 'é387', 'foil (v2)'])
    assert.equal(validateNameFormat(name).message, 'Use only letters, numbers, spaces, hyphens, underscores and periods.', name)
  assert.equal(validateNameFormat('').message, 'Airfoil name is required')
  assert.equal(validateNameFormat('---').message, 'Airfoil name must contain at least one letter or number')
})
