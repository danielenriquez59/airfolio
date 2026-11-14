import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cubicSpline, luFactor, luSolve, norm2, ppEval, solve } from '../../utils/mfoil/linalg.ts'

function close(a: ArrayLike<number>, b: ArrayLike<number>, tol: number) {
  assert.equal(a.length, b.length)
  for (let i = 0; i < a.length; i++)
    assert.ok(Math.abs(a[i] - b[i]) <= tol * Math.max(1, Math.abs(b[i])), `index ${i}: ${a[i]} vs ${b[i]}`)
}

describe('LU', () => {
  it('solves a system that needs pivoting', () => {
    close(solve(Float64Array.of(0, 1, 1, 1), Float64Array.of(1, 2), 2), [1, 1], 1e-15)
  })

  it('reuses one factorization for multiple right-hand sides', () => {
    const A = Float64Array.of(2, 1, 1, 4, -6, 0, -2, 7, 2)
    const X = Float64Array.of(1, 0, 2, 1, 1, -1, -1, 3, 0) // 3x3, row-major
    const B = new Float64Array(9)
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 3; k++)
        for (let j = 0; j < 3; j++) B[i * 3 + k] += A[i * 3 + j] * X[j * 3 + k]
    }
    const f = luFactor(A, 3)
    close(luSolve(f, B, 3), X, 1e-14)
    close(luSolve(f, Float64Array.of(B[0], B[3], B[6])), [1, 1, -1], 1e-14)
    assert.deepEqual(Array.from(A), [2, 1, 1, 4, -6, 0, -2, 7, 2]) // input untouched
  })

  it('has a small residual on a seeded random 200x200 system', () => {
    let seed = 12345
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5
    const n = 200
    const A = new Float64Array(n * n).map(rand)
    const b = new Float64Array(n).map(rand)
    const x = solve(A, b, n)
    const r = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      let s = -b[i]
      for (let j = 0; j < n; j++) s += A[i * n + j] * x[j]
      r[i] = s
    }
    assert.ok(norm2(r) < 1e-12 * norm2(b) * n, `residual ${norm2(r)}`)
  })

  it('rejects a singular matrix', () => {
    assert.throws(() => luFactor(Float64Array.of(1, 2, 2, 4), 2), /singular/)
  })
})

// Reference values from scipy 1.17.1 CubicSpline(x, y), default not-a-knot.
describe('cubicSpline', () => {
  const x = [0, 0.1, 0.35, 0.4, 1.0, 1.7, 2.0]
  const y = x.map(v => Math.sin(3 * v) + v * v)
  const pp = cubicSpline(x, y)
  const q = [-0.3, 0, 0.05, 0.1, 0.37, 0.4, 0.9, 1.7, 1.95, 2.0, 2.4] // knots, ends, interior, extrapolation

  it('matches scipy coefficients (PP.c layout)', () => {
    close(pp.c, [-3.3296993821860355, -3.3296993821859937, -12.734079469803183, 3.160040614190311, 2.238891047132599, 2.238891047132598, 0.5909647480331648, -0.4079450666226344, -2.9052196032620587, -4.815331523732526, 0.8727415818100326, 5.574412780788492, 3.02940258563194, 3.0477045537729923, 2.219413386301802, 1.833385829952072, -0.5321681352014244, 3.9808399186175407, 0.0, 0.3055202066613396, 0.9899232255940168, 1.0920390859672264, 1.1411200080598671, 1.9641853176722672], 1e-12)
  })

  it('matches scipy values and first derivatives on non-uniform knots', () => {
    close(ppEval(pp, q), [-0.7657320650475742, 0.0, 0.15253132872890665, 0.3055202066613396, 1.0330475328429896, 1.0920390859672264, 1.19990419678392, 1.9641853176722672, 3.34277876873738, 3.720584501801074, 8.250175152457388], 1e-13)
    close(ppEval(pp, q, 1), [1.7758049036218115, 3.02940258563194, 3.063526315068861, 3.0477045537729923, 2.0879237068075556, 1.833385829952072, -0.6119152331377209, 3.9808399186175407, 7.187838380349149, 7.929988169816438, 15.076187651006348], 1e-13)
  })

  it('matches scipy on strongly clustered knots (spacing ratio ~650)', () => {
    const xc = Array.from({ length: 41 }, (_, i) => 0.5 * (1 - Math.cos(Math.PI * i / 40)))
    const s = [0]
    for (let i = 1; i < 41; i++) s.push(s[i - 1] + (xc[i] - xc[i - 1]) ** 2)
    const pc = cubicSpline(s, s.map(v => Math.sqrt(v + 1e-3)))
    const qc = Array.from({ length: 9 }, (_, i) => s[40] * i / 8)
    close(ppEval(pc, qc), [0.03162277660168379, 0.06966596331342928, 0.09330959937332822, 0.1120714491164787, 0.1281145242911986, 0.14236104435698624, 0.15530614134806942, 0.16725229428511118, 0.17840028774842326], 1e-12)
    close(ppEval(pc, qc, 1), [15.811388018484132, 7.177805234873808, 5.3582855981090995, 4.461470971896698, 3.9027472042372064, 3.512195251619753, 3.219454024425822, 2.989493933355603, 2.8026860623934873], 1e-11)
  })
})
