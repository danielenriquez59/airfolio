import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const cache = new Map<string, any>()

// Parsed fixtures/<name>.json (name without extension), cached per process.
export function loadFixture(name: string): any {
  if (!cache.has(name))
    cache.set(name, JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), 'utf8')))
  return cache.get(name)
}

// Fixture 1-D list, nested list, or {shape, data} object -> flat row-major Float64Array.
export function flat(a: any): Float64Array {
  if (typeof a === 'number')
    return Float64Array.of(a)
  return Float64Array.from((Array.isArray(a) ? a : a.data).flat(Infinity) as number[])
}

// Assert |actual - expected| <= atol + rtol*|expected| elementwise; reports the worst index.
// Returns the largest absolute error, so tests can log it.
export function assertClose(actual: number | ArrayLike<number>, expected: number | ArrayLike<number>, opts: { rtol?: number; atol?: number; label?: string } = {}): number {
  const { rtol = 1e-10, atol = 0, label = 'value' } = opts
  const a = typeof actual === 'number' ? [actual] : actual
  const e = typeof expected === 'number' ? [expected] : expected
  assert.equal(a.length, e.length, `${label}: length ${a.length} vs expected ${e.length}`)
  let worst = -1
  let worstExcess = -Infinity
  let maxErr = 0
  for (let i = 0; i < a.length; i++) {
    const err = Math.abs(a[i] - e[i])
    const excess = Number.isNaN(err) ? Infinity : err - (atol + rtol * Math.abs(e[i]))
    maxErr = Math.max(maxErr, Number.isNaN(err) ? Infinity : err)
    if (excess > worstExcess) {
      worstExcess = excess
      worst = i
    }
  }
  if (worstExcess > 0)
    assert.fail(`${label}: index ${worst}: got ${a[worst]}, expected ${e[worst]} (abs err ${Math.abs(a[worst] - e[worst]).toExponential(3)}, rtol ${rtol}, atol ${atol})`)
  return maxErr
}
