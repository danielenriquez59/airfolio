import { computed, ref } from 'vue'

type SortDirection = 'asc' | 'desc'

const isValidValue = (value: any): boolean => value !== undefined && value !== null && isFinite(value)

/** Sorted copy of rows; N/A values (missing / non-finite) always go to the bottom */
export function sortRows<T>(rows: T[], getValue: (row: T, column: string) => any, column: string | null, direction: SortDirection): T[] {
  if (!column)
    return rows
  return [...rows].sort((a, b) => {
    const valA = getValue(a, column)
    const valB = getValue(b, column)
    const isValidA = isValidValue(valA)
    const isValidB = isValidValue(valB)

    if (!isValidA && !isValidB)
      return 0
    if (!isValidA)
      return 1
    if (!isValidB)
      return -1

    const result = typeof valA === 'string'
      ? valA.localeCompare(valB as string, undefined, { sensitivity: 'base' })
      : (valA as number) - (valB as number)
    return direction === 'asc' ? result : -result
  })
}

/** Click-to-sort table state: a new column sorts asc, then desc, then unsorted */
export function useSortedRows<T>(rows: () => T[], getValue: (row: T, column: string) => any, column: string | null, direction: SortDirection) {
  const sortColumn = ref<string | null>(column)
  const sortDirection = ref<SortDirection>(direction)
  const sortedData = computed(() => sortRows(rows(), getValue, sortColumn.value, sortDirection.value))

  const handleSort = (col: string) => {
    if (sortColumn.value === col) {
      if (sortDirection.value === 'asc') {
        sortDirection.value = 'desc'
      }
      else {
        sortColumn.value = null
        sortDirection.value = 'asc'
      }
    }
    else {
      sortColumn.value = col
      sortDirection.value = 'asc'
    }
  }

  return { sortColumn, sortDirection, sortedData, handleSort }
}
