import type { Chart } from 'chart.js'

// Values mirror tailwind.config.js tokens (gray = slate, primary = blue)
export const chartColors = {
  grid: '#e2e8f0', // gray-200
  border: '#cbd5e1', // gray-300
  tick: '#64748b', // gray-500
  title: '#334155', // gray-700
  primary: '#2563eb', // primary-600
}

export const chartFonts = {
  sans: { family: 'Inter, ui-sans-serif, system-ui, sans-serif', size: 12 },
  mono: { family: '\'JetBrains Mono\', ui-monospace, monospace', size: 11 },
}

// Ordered categorical palette: series 1 is the primary blue; all >= 3:1 against white
export const seriesPalette = [
  '#2563eb', // blue-600
  '#ea580c', // orange-600
  '#059669', // emerald-600
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#0891b2', // cyan-600
  '#db2777', // pink-600
  '#a16207', // yellow-700
]

export const seriesColor = (index: number) => seriesPalette[index % seriesPalette.length]

/** Options for one cartesian axis (x or y) */
export function themedAxis(title?: string) {
  return {
    grid: { color: chartColors.grid },
    border: { color: chartColors.border },
    ticks: { color: chartColors.tick, font: chartFonts.mono },
    title: {
      display: !!title,
      text: title,
      color: chartColors.title,
      font: { ...chartFonts.sans, weight: 500 },
    },
  }
}

export const themedLegend = {
  labels: { color: chartColors.title, font: chartFonts.sans, boxWidth: 12, boxHeight: 12 },
}

export const themedTooltip = {
  backgroundColor: 'rgba(15, 23, 42, 0.75)', // gray-900 at 75%
  titleFont: { ...chartFonts.sans, weight: 600 },
  bodyFont: chartFonts.mono,
  padding: 8,
  cornerRadius: 6,
}

/** Set global Chart.js defaults once, after ChartJS.register(...) */
export function applyChartDefaults(chart: typeof Chart) {
  chart.defaults.font.family = chartFonts.sans.family
  chart.defaults.font.size = chartFonts.sans.size
  chart.defaults.color = chartColors.tick
  chart.defaults.borderColor = chartColors.grid
}
