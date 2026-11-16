import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as C from '../../utils/mfoil/closures.ts'
import type { Param } from '../../utils/mfoil/types.ts'
import { copyParam, newParam } from '../../utils/mfoil/types.ts'
import { fdCheck } from './fd.ts'
import { assertClose, flat, loadFixture } from './helpers.ts'

type Vec = Float64Array
const fx = loadFixture('closures')
const toParam = (p: any): Param => Object.assign(newParam(), p)

// closures called as f(U, param) -> [value, value_U]
const UP = ['get_Hk', 'get_Ret', 'get_cf', 'get_cDi', 'get_cDi_turbwall', 'get_cDi_lam', 'get_cDi_lamwake', 'get_cDi_outer',
  'get_cDi_lamstress', 'get_Hs', 'get_Us', 'get_damp', 'get_Mach2', 'get_Hss', 'get_de', 'get_rho', 'get_cteq', 'get_cttr'] as const

// every ported closure evaluated on one fixture state, outputs in Python return order
function evalAll(s: any): Record<string, (number | Vec)[]> {
  const P = () => toParam(s.param) // fresh copy: some closures toggle param flags
  const U = flat(s.U)
  const out: Record<string, (number | Vec)[]> = {}
  for (const n of UP) out[n] = (C[n] as (U: Vec, p: Param) => [number, Vec])(U, P())
  out.get_H = C.get_H(U)
  out.get_Hw = C.get_Hw(U, s.wgap)
  out.get_cp = C.get_cp(U[3], P())
  out.get_uk = C.get_uk(U[3], P())
  out.get_cfxt = C.get_cfxt(U, s.x, P())
  out.get_cDixt = C.get_cDixt(U, s.x, P())
  out.get_upw = C.get_upw(flat(s.U_prev), U, P())
  const q = s.get_uq_inputs
  out.get_uq = C.get_uq(q.ds, flat(q.ds_U), q.cf, flat(q.cf_U), q.Hk, flat(q.Hk_U), q.Ret, flat(q.Ret_U), P())
  return out
}

describe('closures vs Python fixtures', () => {
  const worst: Record<string, number> = {}
  for (const s of fx.states) {
    it(`${s.case} ${s.label}`, () => {
      const got = evalAll(s)
      for (const [name, exp] of Object.entries<any[]>(s.functions)) {
        const res = got[name]
        assert.ok(res, `${name} not evaluated`)
        assert.equal(res.length, exp.length, name)
        exp.forEach((e, o) => {
          const ev = flat(e)
          const scale = Math.max(...Array.from(ev, Math.abs))
          const err = assertClose(res[o], ev, { rtol: 1e-12, atol: 1e-14 * scale, label: `${name}[${o}]` })
          worst[name] = Math.max(worst[name] ?? 0, scale > 0 ? err / scale : err)
        })
      }
    })
  }
  it('report', t => t.diagnostic(`closures: worst abs error / max|expected| per function ${JSON.stringify(worst)}`))
})

describe('closures: finite-difference derivative check', () => {
  const worst: Record<string, number> = {}
  const floorLimited = new Set<string>()
  const record = (name: string, r: { err: number; roundoff: boolean }, tag: string) => {
    worst[name] = Math.max(worst[name] ?? 0, r.err)
    if (r.roundoff)
      floorLimited.add(`${name} (${tag})`)
  }
  const v0 = (r: [number, unknown, ...unknown[]]) => [r[0]]
  for (const s of fx.states) {
    it(`${s.case} ${s.label}`, () => {
      const P = () => toParam(s.param)
      const U = flat(s.U)
      const tag = `${s.case} ${s.label}`
      for (const n of UP) {
        const f = C[n] as (U: Vec, p: Param) => [number, Vec]
        record(n, fdCheck(u => v0(f(u, P())), U, f(U, P())[1], `${n} ${tag}`), tag)
      }
      record('get_H', fdCheck(u => v0(C.get_H(u)), U, C.get_H(U)[1], `get_H ${tag}`), tag)
      if (s.wgap !== 0)
        record('get_Hw', fdCheck(u => v0(C.get_Hw(u, s.wgap)), U, C.get_Hw(U, s.wgap)[1], `get_Hw ${tag}`), tag)
      for (const n of ['get_cp', 'get_uk'] as const) {
        const f = C[n]
        record(n, fdCheck(u => v0(f(u[0], P())), Float64Array.of(U[3]), [f(U[3], P())[1]], `${n} ${tag}`), tag)
      }
      for (const n of ['get_cfxt', 'get_cDixt'] as const) {
        const f = C[n]
        const [, a_U, a_x] = f(U, s.x, P())
        const ux = Float64Array.of(...U, s.x)
        record(n, fdCheck(v => v0(f(v.subarray(0, 4), v[4], P())), ux, [...a_U, a_x], `${n} ${tag}`), tag)
      }
      const U12 = Float64Array.of(...flat(s.U_prev), ...U)
      record('get_upw', fdCheck(v => v0(C.get_upw(v.subarray(0, 4), v.subarray(4), P())), U12, C.get_upw(U12.subarray(0, 4), U12.subarray(4), P())[1], `get_upw ${tag}`), tag)
      // get_uq chained through the closures that feed it (as in residual_station)
      const uq = (u: Vec) => {
        const [cf, cf_U] = C.get_cf(u, P())
        const [Hk, Hk_U] = C.get_Hk(u, P())
        const [Ret, Ret_U] = C.get_Ret(u, P())
        return C.get_uq(u[1], Float64Array.of(0, 1, 0, 0), cf, cf_U, Hk, Hk_U, Ret, Ret_U, P())
      }
      record('get_uq', fdCheck(u => v0(uq(u)), U, uq(U)[1], `get_uq ${tag}`), tag)
    })
  }
  it('report', t => t.diagnostic(`closures FD: worst normalized error ${JSON.stringify(worst)}; passed via roundoff floor: ${[...floorLimited].join(', ') || 'none'}`))
})

describe('closures: param mutation', () => {
  it('get_cttr sets param.wake = false on the caller object; get_cDi_lamwake leaves turb alone', () => {
    const s = fx.states.find((s: any) => s.label === 'wake')
    const p = toParam(s.param)
    C.get_cttr(flat(s.U), p)
    assert.equal(p.wake, false)
    const q = toParam(s.param)
    const before = copyParam(q)
    C.get_cDi_lamwake(flat(s.U), q)
    C.get_cDi(flat(s.U), q)
    assert.deepEqual(q, before)
  })
})
