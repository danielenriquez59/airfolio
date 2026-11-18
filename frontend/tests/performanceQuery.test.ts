// Run: node --test tests/performanceQuery.test.ts
// Expected values were captured from the Performance page's URL code before it was moved here.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readPerformanceQuery, writePerformanceQuery } from '../utils/performanceQuery.ts'

const queryOf = (link: string) => Object.fromEntries(new URL(link, 'http://x').searchParams)
const off = { enabled: false, min: undefined, max: undefined }
const base = {
  includeName: '',
  excludeName: '',
  ranges: { thickness: off, camber: off, area: off },
  ...{ Re: 500, Mach: 0, alphaMin: -5, alphaMax: 20, nCrit: 9 },
  ...{ selectionMode: 'all', selectedIds: [], filters: {} },
}
const flow = 'Re=500000&Mach=0&alphaMin=-5&alphaMax=20&nCrit=9'

// [link, state read from it, query the page writes back (in order)]
const cases: [string, object, string][] = [
  ['/performance', base, `${flow}&selectionMode=all`],
  [
    `/performance?${flow}&selectionMode=specific&selected=ag03,ag04,ag08`,
    { ...base, selectionMode: 'specific', selected: ['ag03', 'ag04', 'ag08'] },
    `${flow}&selectionMode=specific&selected=ag03,ag04,ag08`,
  ],
  [
    '/performance?includeName=naca&excludeName=test&thicknessMin=10&thicknessMax=15&thicknessEnabled=true&camberMin=2&camberEnabled=true&areaMax=8.5&areaEnabled=true&Re=1000000&Mach=0.2&alphaMin=-4&alphaMax=16&nCrit=7&selectionMode=all',
    {
      ...base,
      includeName: 'naca',
      excludeName: 'test',
      ranges: { thickness: { enabled: true, min: 10, max: 15 }, camber: { enabled: true, min: 2, max: undefined }, area: { enabled: true, min: undefined, max: 8.5 } },
      ...{ Re: 1000, Mach: 0.2, alphaMin: -4, alphaMax: 16, nCrit: 7 },
    },
    'includeName=naca&excludeName=test&thicknessMin=10&thicknessMax=15&thicknessEnabled=true&camberMin=2&camberEnabled=true&areaMax=8.5&areaEnabled=true&Re=1000000&Mach=0.2&alphaMin=-4&alphaMax=16&nCrit=7&selectionMode=all',
  ],
  [
    '/performance?Re=200000&Mach=0&alphaMin=-5&alphaMax=20&nCrit=9&selectionMode=specific&selectedIds=uuid-1,uuid-2,,uuid-3',
    { ...base, Re: 200, selectionMode: 'specific', selectedIds: ['uuid-1', 'uuid-2', 'uuid-3'] },
    'Re=200000&Mach=0&alphaMin=-5&alphaMax=20&nCrit=9&selectionMode=specific&selectedIds=uuid-1,uuid-2,uuid-3',
  ],
  [
    `/performance?${flow}&selectionMode=all&maxCMRoughness=0.05&minCMAtZero=-0.1&minMaxLD=40&maxMaxLD=120&minCLMax=1.1&maxCLMax=1.6&targetCL=0.5&targetAOA=2&selected=e387,s1223`,
    {
      ...base,
      filters: { maxCMRoughness: 0.05, minCMAtZero: -0.1, minMaxLD: 40, maxMaxLD: 120, minCLMax: 1.1, maxCLMax: 1.6, targetCL: 0.5, targetAOA: 2 },
      selected: ['e387', 's1223'],
    },
    `${flow}&selectionMode=all&maxCMRoughness=0.05&minCMAtZero=-0.1&minMaxLD=40&maxMaxLD=120&minCLMax=1.1&maxCLMax=1.6&targetCL=0.5&targetAOA=2&selected=e387,s1223`,
  ],
  // Ranges without Enabled=true are ignored; empty values keep defaults; junk numbers become NaN
  [
    '/performance?thicknessMin=12&thicknessMax=14&camberEnabled=false&camberMin=3&Re=abc&Mach=&alphaMin=0&nCrit=x&selectionMode=bogus&minMaxLD=&targetCL=foo',
    { ...base, Re: Number.NaN, alphaMin: 0, nCrit: Number.NaN, filters: { targetCL: Number.NaN } },
    'Re=NaN&Mach=0&alphaMin=0&alphaMax=20&nCrit=NaN&selectionMode=all&targetCL=NaN',
  ],
  [
    '/performance?thicknessEnabled=true&Re=3e6&selected=,',
    { ...base, ranges: { ...base.ranges, thickness: { enabled: true, min: undefined, max: undefined } }, Re: 3000, selected: [] },
    'thicknessEnabled=true&Re=3000000&Mach=0&alphaMin=-5&alphaMax=20&nCrit=9&selectionMode=all',
  ],
]

test('readPerformanceQuery / writePerformanceQuery: links read and write back as before', () => {
  for (const [link, state, written] of cases) {
    const read = readPerformanceQuery(queryOf(link))
    assert.deepEqual(read, state, link)
    assert.equal(new URLSearchParams(writePerformanceQuery(read)).toString().replaceAll('%2C', ','), written, link)
  }
})

test('writePerformanceQuery: selected ids only in specific mode, names trimmed, page filters after flow', () => {
  const s = readPerformanceQuery({})
  Object.assign(s, { includeName: ' naca ', selectedIds: ['a', 'b'], filters: { minMaxLD: null, targetAOA: 0 }, selected: ['n1'] })
  assert.deepEqual(Object.entries(writePerformanceQuery(s)), [
    ['includeName', 'naca'], ['Re', '500000'], ['Mach', '0'], ['alphaMin', '-5'], ['alphaMax', '20'], ['nCrit', '9'],
    ['selectionMode', 'all'], ['targetAOA', '0'], ['selected', 'n1'],
  ])
  s.selectionMode = 'specific'
  assert.equal(writePerformanceQuery(s).selectedIds, 'a,b')
})
