"""Export staged mfoil reference values as JSON fixtures for the TypeScript port.

Run from backend/:  python tests/export_mfoil_fixtures.py
Layout: scalars are numbers/bools, 1-D arrays are lists, arrays with ndim >= 2 are
{"shape": [...], "data": nested row-major lists}. Indices are 0-based.
"""
import contextlib
import copy
import io
import json
import os
import re
import sys

import numpy as np
from scipy import sparse

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)
import mfoil as mf  # noqa: E402

OUT_DIR = os.path.join(os.path.dirname(BACKEND), 'frontend', 'tests', 'mfoil', 'fixtures')
NPANEL, RE, NCRIT = 120, 1e6, 9.0


def enc(v):
    if sparse.issparse(v):
        v = v.toarray()
    if isinstance(v, range):
        v = list(v)
    if isinstance(v, (list, tuple)):
        return [enc(x) for x in v]
    if isinstance(v, np.ndarray):
        if v.ndim >= 2:
            return {'shape': list(v.shape), 'data': v.tolist()}
        return v.tolist()
    if isinstance(v, np.generic):
        return v.item()
    return v


def naca_coords(digits, extra_gap=0.0, c4=-0.1015):
    # mfoil's own NACA points (lower TE -> LE -> upper TE), optionally opened by a linear thickness add;
    # c4 replaces mfoil's x^4 thickness coefficient (-0.1015)
    m = mf.mfoil(naca=digits, npanel=NPANEL)
    X = m.geom.xpoint.copy()
    n = (X.shape[1] - 1) // 2  # LE index
    sgn = np.r_[-np.ones(n), 0., np.ones(n)]
    X[1] += sgn * (0.5 * extra_gap * X[0] + float(digits[-2:]) * .01 / .2 * (c4 + 0.1015) * X[0]**4)
    return X


CASES = [
    dict(name='naca2412_a2', digits='2412', gap=0.0, alpha=2.0, Ma=0.0, matrices=True),
    dict(name='naca2412_a10', digits='2412', gap=0.0, alpha=10.0, Ma=0.0),
    dict(name='naca4412_blunt_a4', digits='4412', gap=0.01, alpha=4.0, Ma=0.0),
    dict(name='naca2412_a4_M03', digits='2412', gap=0.0, alpha=4.0, Ma=0.3),
    # mfoil's "no gap" coefficient; leaves a 1.2e-4 chord gap, above set_coords' 1e-4 opening threshold
    dict(name='naca2412_sharp_a4', digits='2412', gap=0.0, c4=-0.1035, alpha=4.0, Ma=0.0),
    # truly sharp: c4 closes the TE to roundoff, then the TE point is repeated exactly (set_coords opens it)
    dict(name='naca2412_closed_a4', digits='2412', gap=0.0, c4=-0.1036, closed=True, alpha=4.0, Ma=0.0),
]

THERMO = ['Minf', 'Vinf', 'muinf', 'mu0', 'rho0', 'H0', 'KTb', 'KTl', 'cps', 'gam', 'Tsrat']


def param_dict(p):
    return {k: enc(v) for k, v in vars(p).items() if isinstance(v, (bool, int, float, np.generic))}


def run_case(c):
    X = naca_coords(c['digits'], c['gap'], c.get('c4', -0.1015))
    if c.get('closed'):
        X[:, -1] = X[:, 0]
    M = mf.mfoil(coords=X, npanel=NPANEL)
    M.param.verb, M.param.ncrit = 0, NCRIT
    M.setoper(alpha=c['alpha'], Re=RE, Ma=c['Ma'])
    t, hTE, dtdx, tcp, tdp = mf.TE_info(M.foil.x)
    out = {'case': {k: c[k] for k in ('name', 'alpha', 'Ma')} | {'Re': RE, 'ncrit': NCRIT, 'npanel': NPANEL},
           'input': {'coords': enc(X)},
           'geometry': {'xpoint': enc(M.geom.xpoint), 'chord': M.geom.chord, 'N': M.foil.N,
                        'foil_x': enc(M.foil.x), 'foil_s': enc(M.foil.s), 'foil_t': enc(M.foil.t),
                        'te': {'t': enc(t), 'hTE': hTE, 'dtdx': dtdx, 'tcp': tcp, 'tdp': tdp}}}

    # same call sequence as mf.solve_viscous, with captures between stages
    mf.solve_inviscid(M)
    out['inviscid'] = {'gamref': enc(M.isol.gamref), 'gam': enc(M.isol.gam), 'cl': M.post.cl, 'cm': M.post.cm,
                       'cdpi': M.post.cdpi, 'cp': enc(M.post.cp), 'cpi': enc(M.post.cpi)}
    mats = {'AIC': enc(M.isol.AIC)} if c.get('matrices') else None
    M.oper.viscous = True
    mf.init_thermo(M)
    out['param'] = {k: enc(getattr(M.param, k)) for k in THERMO}
    mf.build_wake(M)
    mf.stagpoint_find(M)
    mf.identify_surfaces(M)
    mf.set_wake_gap(M)
    mf.calc_ue_m(M)
    out['coupling'] = {'wake_N': M.wake.N, 'wake_x': enc(M.wake.x), 'wake_s': enc(M.wake.s), 'wake_t': enc(M.wake.t),
                       'uewi': enc(M.isol.uewi), 'uewiref': enc(M.isol.uewiref),
                       'sstag': M.isol.sstag, 'sstag_g': enc(M.isol.sstag_g), 'Istag': enc(M.isol.Istag),
                       'xstag': enc(M.isol.xstag), 'xi': enc(M.isol.xi), 'sgnue': enc(M.isol.sgnue),
                       'Is': enc(M.vsol.Is), 'wgap': enc(M.vsol.wgap)}
    if mats is not None:
        mats |= {'ue_m': enc(M.vsol.ue_m), 'sigma_m': enc(M.vsol.sigma_m), 'ue_sigma': enc(M.vsol.ue_sigma)}
    mf.init_boundary_layer(M)
    out['init_bl'] = {'U': enc(M.glob.U), 'turb': enc(M.vsol.turb), 'Xt': enc(M.vsol.Xt)}
    mf.stagpoint_move(M)
    mf.build_glob_sys(M)  # solve_coupled rebuilds the same system on its first iteration
    out['first_glob'] = {'U': enc(M.glob.U), 'xi': enc(M.isol.xi), 'sstag': M.isol.sstag,
                         'Istag': enc(M.isol.Istag), 'Is': enc(M.vsol.Is), 'R': enc(M.glob.R),
                         'Rnorm': mf.norm2(M.glob.R)}
    M.param.verb = 1  # only to read the Newton iteration count from the log
    with contextlib.redirect_stdout(io.StringIO()) as log:
        mf.solve_coupled(M)
    M.param.verb = 0
    hist = [float(r) for r in re.findall(r'Newton iteration \d+, Rnorm = (\S+)', log.getvalue())]  # printed %.10e
    mf.calc_force(M)
    mf.get_distributions(M)
    p = M.post
    out['final'] = {'U': enc(M.glob.U), 'cl': p.cl, 'cd': p.cd, 'cm': p.cm, 'cdf': p.cdf, 'cdp': p.cdp,
                    'cdpi': p.cdpi, 'Xt': enc(M.vsol.Xt), 'converged': bool(M.glob.conv), 'newton_iterations': len(hist) - 1, 'rnorm_history': hist,
                    'turb': enc(M.vsol.turb), 'Is': enc(M.vsol.Is), 'sstag': M.isol.sstag, 'Istag': enc(M.isol.Istag),
                    'xi': enc(M.isol.xi),
                    'post': {k: enc(getattr(p, k)) for k in ('cp', 'cpi', 'th', 'ds', 'sa', 'ue', 'uei', 'cf', 'Ret', 'Hk')}}
    if mats is not None:
        out['matrices'] = mats
    return out, M


SWEEP_ALPHAS = [0.0, 2.0, 4.0, 6.0, 8.0]


def run_sweep():
    # warm-started sweep on one object, as the TS solvePolar does: initbl=False after a converged point,
    # Xt cleared before each solve (mfoil never resets it, so a surface laminar to the TE kept the old value)
    M = mf.mfoil(coords=naca_coords('2412'), npanel=NPANEL)
    M.param.verb, M.param.ncrit = 1, NCRIT
    points = []
    for a in SWEEP_ALPHAS:
        M.setoper(alpha=a, Re=RE, Ma=0.0)
        M.vsol.Xt[:] = 0
        with contextlib.redirect_stdout(io.StringIO()) as log:
            M.solve()
        n = len(re.findall(r'Newton iteration \d+', log.getvalue())) - 1
        points.append({'alpha': a, 'converged': bool(M.glob.conv), 'cl': M.post.cl, 'cd': M.post.cd, 'cm': M.post.cm,
                       'Xt': enc(M.vsol.Xt), 'newton_iterations': n})
        M.oper.initbl = not M.glob.conv
    return {'case': {'name': 'naca2412_sweep', 'Re': RE, 'ncrit': NCRIT, 'npanel': NPANEL},
            'input': {'coords': enc(naca_coords('2412'))}, 'points': points}


# closures taking (U, param); others are handled explicitly below
UP_FUNCS = ['get_Hk', 'get_Ret', 'get_cf', 'get_cDi', 'get_cDi_turbwall', 'get_cDi_lam', 'get_cDi_lamwake',
            'get_cDi_outer', 'get_cDi_lamstress', 'get_Hs', 'get_Us', 'get_damp', 'get_Mach2', 'get_Hss', 'get_de',
            'get_rho', 'get_cteq', 'get_cttr']


def closure_state(M, si, j, label, case):
    Is = list(M.vsol.Is[si])
    k = Is.index(j)
    param = mf.build_param(M, si)
    mf.station_param(M, param, j); param.turb = bool(param.turb)
    U, Uprev, x = M.glob.U[:, j].copy(), M.glob.U[:, Is[k - 1]].copy(), M.isol.xi[j]
    wgap = M.vsol.wgap[k] if si == 2 else 0.0
    P = lambda: copy.deepcopy(param)  # noqa: E731 - some closures toggle param flags
    f = {n: getattr(mf, n)(U, P()) for n in UP_FUNCS}
    f['get_H'] = mf.get_H(U)
    f['get_Hw'] = mf.get_Hw(U, wgap)
    f['get_cp'] = mf.get_cp(U[3], P())
    f['get_uk'] = mf.get_uk(U[3], P())
    f['get_cfxt'] = mf.get_cfxt(U, x, P())
    f['get_cDixt'] = mf.get_cDixt(U, x, P())
    f['get_upw'] = mf.get_upw(Uprev, U, P())
    cf, cf_U = mf.get_cf(U, P()); Hk, Hk_U = mf.get_Hk(U, P()); Ret, Ret_U = mf.get_Ret(U, P())
    uq_in = dict(ds=U[1], ds_U=np.r_[0., 1, 0, 0], cf=cf, cf_U=cf_U, Hk=Hk, Hk_U=Hk_U, Ret=Ret, Ret_U=Ret_U)
    f['get_uq'] = mf.get_uq(*uq_in.values(), P())
    return {'label': label, 'case': case, 'station': j, 'param': param_dict(param), 'U': enc(U), 'U_prev': enc(Uprev),
            'x': x, 'wgap': wgap, 'get_uq_inputs': {k: enc(v) for k, v in uq_in.items()},
            'functions': {n: [enc(r) for r in v] for n, v in f.items()}}


def residual_case(param, x, U, Aux, label, case, fn='residual_station', M=None):
    pin = param_dict(param)
    if fn == 'residual_station':
        R, R_U, R_x = mf.residual_station(copy.deepcopy(param), x, U, Aux)
        extra = {}
    else:
        R, R_U, R_x = mf.residual_transition(M, copy.deepcopy(param), x, U, Aux)
        extra = {'xt': M.vsol.xt}
    return {'label': label, 'case': case, 'param': pin, 'x': enc(x), 'U': enc(U), 'Aux': enc(Aux),
            'R': enc(R), 'R_U': enc(R_U), 'R_x': enc(R_x)} | extra


def closures(solved):
    states, station, transition, stag = [], [], [], []
    for name, M in solved:
        turb = M.vsol.turb
        up = list(M.vsol.Is[1])
        lam_up = [j for j in up[1:] if not turb[j]]
        turb_up = [j for j in up if turb[j]]
        wk = list(M.vsol.Is[2])
        picks = [(1, lam_up[len(lam_up) // 2], 'laminar'), (1, turb_up[len(turb_up) // 2], 'turbulent'),
                 (2, wk[len(wk) // 2], 'wake')]
        for si, j, label in picks:
            states.append(closure_state(M, si, j, label, name))
            Is = list(M.vsol.Is[si]); k = Is.index(j); I = [Is[k - 1], j]
            param = mf.build_param(M, si); param.turb = bool(turb[j])
            Aux = M.vsol.wgap[[k - 1, k]] if si == 2 else np.zeros(2)
            station.append(residual_case(param, M.isol.xi[I], M.glob.U[:, I].copy(), Aux, label, name))
        # transition intervals on lower and upper surfaces
        for si in range(2):
            Is = list(M.vsol.Is[si])
            k = next((i for i in range(1, len(Is)) if turb[Is[i]] != turb[Is[i - 1]]), None)
            if k is None:  # surface stays laminar to the TE
                continue
            I = [Is[k - 1], Is[k]]
            param = mf.build_param(M, si)
            transition.append(residual_case(param, M.isol.xi[I], M.glob.U[:, I].copy(), np.zeros(2),
                                            ['lower', 'upper'][si], name, 'residual_transition', M))
        # stagnation state and the similarity residual of the first station (as in build_glob_sys)
        Is = list(M.vsol.Is[1]); I = [Is[0], Is[1]]
        U, x = M.glob.U[:, I].copy(), M.isol.xi[I]
        Ust, Ust_U, Ust_x, xst = mf.stagnation_state(U, x)
        stag.append({'case': name, 'U': enc(U), 'x': enc(x), 'Ust': enc(Ust), 'Ust_U': enc(Ust_U),
                     'Ust_x': enc(Ust_x), 'xst': xst})
        param = mf.build_param(M, 1); param.simi = True
        station.append(residual_case(param, np.r_[xst, xst], np.stack((Ust, Ust), axis=-1), np.zeros(2),
                                     'similarity', name))
    return {'states': states, 'residual_station': station, 'residual_transition': transition,
            'stagnation_state': stag}


def build_all():
    files, solved = {}, []
    for c in CASES:
        out, M = run_case(c)
        files[c['name'] + '.json'] = out
        solved.append((c['name'], M))
    files['naca2412_sweep.json'] = run_sweep()
    files['closures.json'] = closures([s for s in solved if s[0] in ('naca2412_a2', 'naca2412_a4_M03')])
    meta = {'generator': 'backend/tests/export_mfoil_fixtures.py', 'mfoil_version': solved[0][1].version,
            'numpy': np.__version__}
    return {k: {'meta': meta} | v for k, v in files.items()}


def dumps(obj):
    return json.dumps(obj, allow_nan=False, separators=(',', ':'))


if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    for fname, obj in build_all().items():
        with open(os.path.join(OUT_DIR, fname), 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(dumps(obj))
        print(fname, os.path.getsize(os.path.join(OUT_DIR, fname)), 'bytes')
