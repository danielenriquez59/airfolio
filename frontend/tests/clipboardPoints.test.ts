// Run: node --test tests/clipboardPoints.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pointsToClipboardText, seligPoints } from '../composables/useNACAExport.ts'
import { AIRFOIL_FAMILIES } from '../utils/airfoilFamilies.ts'

test('Copy points: NACA 2412 Selig points as tab-separated lines, LE once', () => {
  const c = AIRFOIL_FAMILIES['4-digit'].generate(AIRFOIL_FAMILIES['4-digit'].defaults, 100)
  const lines = pointsToClipboardText(c).split('\n')
  // upper TE: thickness laid normal to the cambered mean line puts it at x = 1.000084, as in the Selig file
  assert.ok(lines[0].startsWith('1.000084\t'), lines[0])
  for (const l of lines)
    assert.match(l, /^-?\d\.\d{6}\t-?\d\.\d{6}$/)
  assert.equal(lines.length, seligPoints(c).length) // the Selig file writes one coordinate line per point
  assert.equal(lines.filter(l => l.startsWith('0.000000\t')).length, 1)
})
