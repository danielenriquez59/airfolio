<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import type { SparInputs, AirfoilDataPoint, SparCalculationResult, SparCrossSection } from '~/types/spar.types'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface Props {
  data: AirfoilDataPoint[]
  inputs: SparInputs
  result: SparCalculationResult
}

const props = defineProps<Props>()

// Calculate spar geometry based on cross-section type
const sparGeometry = computed(() => {
  if (!props.result.valid) return null

  const xActual = props.inputs.sparLocation * props.inputs.chordLength
  
  // Find the camber value at the spar location
  const sparDataPoint = props.data.find(d => Math.abs(d.x - xActual) < 0.01) || 
                        props.data.reduce((prev, curr) => 
                          Math.abs(curr.x - xActual) < Math.abs(prev.x - xActual) ? curr : prev
                        )
  const camberOffset = sparDataPoint?.camber || 0
  
  // Offset the spar vertically by the camber value
  const sparTopY = camberOffset + (props.result.sparHeight / 2)
  const sparBottomY = camberOffset - (props.result.sparHeight / 2)
  const sparLeftX = xActual - (props.inputs.sparWidth / 2)
  const sparRightX = xActual + (props.inputs.sparWidth / 2)
  const wall = props.inputs.sparWallThickness

  const geometry: any = {
    centerX: xActual,
    centerY: camberOffset,  // Store camber offset for reference line
    type: props.inputs.crossSection,
  }

  switch (props.inputs.crossSection) {
    case 'hollow-rectangle': {
      // Outer and inner rectangles
      const innerTopY = sparTopY - wall
      const innerBottomY = sparBottomY + wall
      const innerLeftX = sparLeftX + wall
      const innerRightX = sparRightX - wall
      
      geometry.outer = {
        x1: sparLeftX,
        x2: sparRightX,
        y1: sparBottomY,
        y2: sparTopY,
      }
      geometry.inner = {
        x1: innerLeftX,
        x2: innerRightX,
        y1: innerBottomY,
        y2: innerTopY,
      }
      break
    }

    case 'i-beam': {
      // Top flange, web, bottom flange
      const webHeight = props.result.sparHeight - 2 * wall
      
      geometry.topFlange = {
        x1: sparLeftX,
        x2: sparRightX,
        y1: sparTopY - wall,
        y2: sparTopY,
      }
      geometry.web = {
        x1: xActual - wall / 2,
        x2: xActual + wall / 2,
        y1: sparBottomY + wall,
        y2: sparTopY - wall,
      }
      geometry.bottomFlange = {
        x1: sparLeftX,
        x2: sparRightX,
        y1: sparBottomY,
        y2: sparBottomY + wall,
      }
      break
    }

    case 'c-channel': {
      // Top flange, web on left, bottom flange
      geometry.topFlange = {
        x1: sparLeftX,
        x2: sparRightX,
        y1: sparTopY - wall,
        y2: sparTopY,
      }
      geometry.web = {
        x1: sparLeftX,
        x2: sparLeftX + wall,
        y1: sparBottomY,
        y2: sparTopY,
      }
      geometry.bottomFlange = {
        x1: sparLeftX,
        x2: sparRightX,
        y1: sparBottomY,
        y2: sparBottomY + wall,
      }
      break
    }
  }

  return geometry
})

// Chart data
const chartData = computed(() => {
  const datasets: any[] = []

  // Create concatenated outer surface curve (upper from TE to LE, then lower from LE to TE)
  // This creates one continuous closed curve
  const outerSurfaceData: { x: number, y: number }[] = []
  
  // Upper surface: trailing edge (x=max) to leading edge (x=0) - reverse order
  const reversedUpper = [...props.data].reverse()
  for (const d of reversedUpper) {
    outerSurfaceData.push({ x: d.x, y: d.yUpper })
  }
  
  // Lower surface: leading edge (x=0) to trailing edge (x=max) - normal order
  // Skip the first point since it's the same as the last upper surface point (leading edge)
  for (let i = 1; i < props.data.length; i++) {
    outerSurfaceData.push({ x: props.data[i].x, y: props.data[i].yLower })
  }
  
  // Close the loop back to the starting point
  if (outerSurfaceData.length > 0) {
    outerSurfaceData.push({ x: outerSurfaceData[0].x, y: outerSurfaceData[0].y })
  }

  // Outer surface as single continuous curve with fill
  datasets.push({
    label: 'Outer Surface',
    data: outerSurfaceData,
    borderColor: '#0f172a',
    backgroundColor: '#e0f2fe40',
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 3,
    fill: true,
    tension: 0,
  })

  // Create concatenated inner skin curve (same pattern as outer)
  // Inner skin is a scaled-down copy: scale x by innerChord/chord and translate by +skinThickness
  const skinThickness = props.inputs.skinThickness
  const chord = props.inputs.chordLength
  const innerChord = chord - 2 * skinThickness
  const innerSkinData: { x: number, y: number }[] = []
  
  // Helper to calculate inner x: scale by ratio and translate
  const calcInnerX = (outerX: number) => {
    if (innerChord <= 0) return skinThickness // Collapsed if skin too thick
    const xNorm = outerX / chord
    return xNorm * innerChord + skinThickness
  }
  
  // Inner upper surface: trailing edge to leading edge (reversed)
  for (const d of reversedUpper) {
    innerSkinData.push({ x: calcInnerX(d.x), y: d.yUpperInner })
  }
  
  // Inner lower surface: leading edge to trailing edge
  for (let i = 1; i < props.data.length; i++) {
    innerSkinData.push({ x: calcInnerX(props.data[i].x), y: props.data[i].yLowerInner })
  }
  
  // Close the loop
  if (innerSkinData.length > 0) {
    innerSkinData.push({ x: innerSkinData[0].x, y: innerSkinData[0].y })
  }

  // Inner skin as single continuous dashed curve
  datasets.push({
    label: 'Inner Skin',
    data: innerSkinData,
    borderColor: '#64748b',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderDash: [5, 5],
    pointRadius: 0,
    pointHoverRadius: 0,
    fill: false,
    tension: 0,
  })

  // Camber line (optional visualization)
  datasets.push({
    label: 'Camber Line',
    data: props.data.map(d => ({ x: d.x, y: d.camber })),
    borderColor: '#f59e0b',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderDash: [3, 3],
    pointRadius: 0,
    pointHoverRadius: 0,
    fill: false,
    tension: 0,
  })

  // Spar location reference line
  if (sparGeometry.value) {
    const maxY = Math.max(...props.data.map(d => d.yUpper))
    const minY = Math.min(...props.data.map(d => d.yLower))
    const yRange = maxY - minY
    const padding = yRange * 0.1

    datasets.push({
      label: 'Spar Center',
      data: [
        { x: sparGeometry.value.centerX, y: minY - padding },
        { x: sparGeometry.value.centerX, y: maxY + padding },
      ],
      borderColor: '#ef4444',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderDash: [3, 3],
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      tension: 0,
    })
  }

  // Draw spar based on cross-section type
  if (sparGeometry.value && props.result.valid) {
    const geom = sparGeometry.value

    switch (geom.type) {
      case 'hollow-rectangle': {
        // Outer box
        datasets.push({
          label: 'Spar',
          data: [
            { x: geom.outer.x1, y: geom.outer.y1 },
            { x: geom.outer.x2, y: geom.outer.y1 },
            { x: geom.outer.x2, y: geom.outer.y2 },
            { x: geom.outer.x1, y: geom.outer.y2 },
            { x: geom.outer.x1, y: geom.outer.y1 },
          ],
          borderColor: '#1d4ed8',
          backgroundColor: '#3b82f680',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: true,
          tension: 0,
        })
        break
      }

      case 'i-beam': {
        // Top flange
        datasets.push({
          label: 'I-Beam Top Flange',
          data: [
            { x: geom.topFlange.x1, y: geom.topFlange.y1 },
            { x: geom.topFlange.x2, y: geom.topFlange.y1 },
            { x: geom.topFlange.x2, y: geom.topFlange.y2 },
            { x: geom.topFlange.x1, y: geom.topFlange.y2 },
            { x: geom.topFlange.x1, y: geom.topFlange.y1 },
          ],
          borderColor: '#1d4ed8',
          backgroundColor: '#3b82f680',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: true,
          tension: 0,
        })

        // Web
        datasets.push({
          label: 'I-Beam Web',
          data: [
            { x: geom.web.x1, y: geom.web.y1 },
            { x: geom.web.x2, y: geom.web.y1 },
            { x: geom.web.x2, y: geom.web.y2 },
            { x: geom.web.x1, y: geom.web.y2 },
            { x: geom.web.x1, y: geom.web.y1 },
          ],
          borderColor: '#1d4ed8',
          backgroundColor: '#3b82f680',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: true,
          tension: 0,
        })

        // Bottom flange
        datasets.push({
          label: 'I-Beam Bottom Flange',
          data: [
            { x: geom.bottomFlange.x1, y: geom.bottomFlange.y1 },
            { x: geom.bottomFlange.x2, y: geom.bottomFlange.y1 },
            { x: geom.bottomFlange.x2, y: geom.bottomFlange.y2 },
            { x: geom.bottomFlange.x1, y: geom.bottomFlange.y2 },
            { x: geom.bottomFlange.x1, y: geom.bottomFlange.y1 },
          ],
          borderColor: '#1d4ed8',
          backgroundColor: '#3b82f680',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: true,
          tension: 0,
        })
        break
      }

      case 'c-channel': {
        // Top flange
        datasets.push({
          label: 'C-Channel Top Flange',
          data: [
            { x: geom.topFlange.x1, y: geom.topFlange.y1 },
            { x: geom.topFlange.x2, y: geom.topFlange.y1 },
            { x: geom.topFlange.x2, y: geom.topFlange.y2 },
            { x: geom.topFlange.x1, y: geom.topFlange.y2 },
            { x: geom.topFlange.x1, y: geom.topFlange.y1 },
          ],
          borderColor: '#1d4ed8',
          backgroundColor: '#3b82f680',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: true,
          tension: 0,
        })

        // Web
        datasets.push({
          label: 'C-Channel Web',
          data: [
            { x: geom.web.x1, y: geom.web.y1 },
            { x: geom.web.x2, y: geom.web.y1 },
            { x: geom.web.x2, y: geom.web.y2 },
            { x: geom.web.x1, y: geom.web.y2 },
            { x: geom.web.x1, y: geom.web.y1 },
          ],
          borderColor: '#1d4ed8',
          backgroundColor: '#3b82f680',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: true,
          tension: 0,
        })

        // Bottom flange
        datasets.push({
          label: 'C-Channel Bottom Flange',
          data: [
            { x: geom.bottomFlange.x1, y: geom.bottomFlange.y1 },
            { x: geom.bottomFlange.x2, y: geom.bottomFlange.y1 },
            { x: geom.bottomFlange.x2, y: geom.bottomFlange.y2 },
            { x: geom.bottomFlange.x1, y: geom.bottomFlange.y2 },
            { x: geom.bottomFlange.x1, y: geom.bottomFlange.y1 },
          ],
          borderColor: '#1d4ed8',
          backgroundColor: '#3b82f680',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: true,
          tension: 0,
        })
        break
      }
    }
  }

  return {
    datasets,
  }
})

// Chart options
const chartOptions = computed(() => {
  const maxY = Math.max(...props.data.map(d => d.yUpper))
  const minY = Math.min(...props.data.map(d => d.yLower))
  const yRange = maxY - minY
  const padding = yRange * 0.1

  // Unit labels - directly use the unitSystem value
  const lengthUnit = props.inputs.unitSystem

  // Determine decimal places based on unit
  const getDecimals = (unit: string) => {
    switch (unit) {
      case 'mm': return 2
      case 'm': return 4
      case 'in': return 3
      case 'ft': return 3
      default: return 2
    }
  }
  const decimals = getDecimals(lengthUnit)

  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 10,
        right: 20,
        bottom: 10,
        left: 10,
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        filter: (legendItem: any) => {
          // Hide spar center line and null labels from legend
          if (legendItem.text === 'Spar Center' || legendItem.text === null) {
            return false
          }
          // Hide spar inner/web/flange labels from legend to reduce clutter
          if (legendItem.text && (
            legendItem.text.includes('Spar') ||
            legendItem.text.includes('I-Beam') ||
            legendItem.text.includes('C-Channel')
          )) {
            return false
          }
          return true
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || ''
            const value = context.parsed.y
            return `${label}: ${value.toFixed(decimals)} ${lengthUnit}`
          },
          title: (context: any) => {
            return `X: ${context[0].parsed.x.toFixed(decimals)} ${lengthUnit}`
          },
        },
      },
      title: {
        display: true,
        text: 'Cross Section Visualization',
        font: {
          size: 14,
          weight: 'bold' as const,
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        title: {
          display: true,
          text: `Chord Position (${lengthUnit})`,
          font: {
            size: 12,
            weight: 'bold' as const,
          },
        },
        min: 0,
        max: props.inputs.chordLength,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: (value: any) => {
            return value.toFixed(decimals)
          },
        },
      },
      y: {
        type: 'linear' as const,
        title: {
          display: true,
          text: `Thickness (${lengthUnit})`,
          font: {
            size: 12,
            weight: 'bold' as const,
          },
        },
        min: minY - padding,
        max: maxY + padding,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: (value: any) => {
            return value.toFixed(decimals)
          },
        },
      },
    },
    elements: {
      point: {
        radius: 0,
        hitRadius: 5,
        hoverRadius: 3,
      },
    },
  }
})
</script>

<template>
  <div class="h-full">
    <Line
      v-if="data.length > 0"
      :data="chartData"
      :options="chartOptions"
    />
    <div v-else class="flex items-center justify-center h-full text-slate-500">
      No airfoil data available
    </div>
  </div>
</template>

