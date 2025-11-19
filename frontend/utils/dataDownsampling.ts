/**
 * Downsample data using Largest Triangle Three Buckets (LTTB) algorithm
 * Preserves visual shape while reducing data points
 */
export function downsampleLTTB(
  data: { x: number; y: number }[],
  threshold: number
): { x: number; y: number }[] {
  if (data.length <= threshold || threshold < 3) {
    return data
  }

  const sampled: { x: number; y: number }[] = []
  const bucketSize = (data.length - 2) / (threshold - 2)

  // Always include first point
  sampled.push(data[0])

  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1
    const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1
    const avgRangeLength = avgRangeEnd - avgRangeStart

    // Calculate average point for next bucket
    let avgX = 0
    let avgY = 0
    for (let j = avgRangeStart; j < avgRangeEnd && j < data.length; j++) {
      avgX += data[j].x
      avgY += data[j].y
    }
    avgX /= avgRangeLength
    avgY /= avgRangeLength

    // Find point in current bucket with largest triangle area
    const rangeStart = Math.floor(i * bucketSize) + 1
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1

    let maxArea = -1
    let maxAreaIndex = rangeStart

    const pointA = sampled[sampled.length - 1]

    for (let j = rangeStart; j < rangeEnd && j < data.length; j++) {
      const area = Math.abs(
        (pointA.x - avgX) * (data[j].y - pointA.y) -
        (pointA.x - data[j].x) * (avgY - pointA.y)
      )
      if (area > maxArea) {
        maxArea = area
        maxAreaIndex = j
      }
    }

    sampled.push(data[maxAreaIndex])
  }

  // Always include last point
  sampled.push(data[data.length - 1])

  return sampled
}

/**
 * Determine optimal downsampling threshold based on dataset size
 */
export function getOptimalThreshold(dataLength: number, airfoilCount: number): number {
  // For performance mode with many airfoils, reduce points more aggressively
  if (airfoilCount > 200) return 15
  if (airfoilCount > 100) return 20
  if (airfoilCount > 50) return 30
  return 40 // Default for smaller datasets
}

