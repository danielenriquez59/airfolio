/**
 * Utility functions for handling airfoil categories
 */

/**
 * Convert a string to CamelCase format
 * Examples: "general aviation" -> "General Aviation", "UAV" -> "UAV"
 */
export const toCamelCase = (str: string | null | undefined): string => {
  if (!str) return ''
  
  return str
    .trim()
    .split(/\s+/)
    .map(word => {
      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

/**
 * Format category name for display in CamelCase
 * Returns empty string if category is null/undefined
 */
export const formatCategoryName = (categoryName: string | null | undefined): string => {
  return toCamelCase(categoryName)
}

/**
 * Check if a category is valid (not null/undefined)
 */
export const isValidCategory = (category: string | null | undefined): boolean => {
  return category != null && category.trim().length > 0
}

