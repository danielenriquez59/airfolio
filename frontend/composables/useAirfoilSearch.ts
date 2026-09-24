/**
 * Composable for airfoil search and filtering operations
 */
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

export type SortField = 'name' | 'thickness' | 'camber'
export type SortDirection = 'asc' | 'desc'

export interface SearchParams {
  query?: string
  includeName?: string
  excludeName?: string
  thicknessMin?: number
  thicknessMax?: number
  camberMin?: number
  camberMax?: number
  categoryIds?: string[]
  sortBy?: SortField
  sortDir?: SortDirection
  page?: number
  limit?: number
}

export interface SearchResult {
  data: Airfoil[]
  count: number
  page: number
  limit: number
  totalPages: number
}

export const useAirfoilSearch = () => {
  const supabase = useSupabaseClient<Database>()

  /**
   * Search airfoils with filters
   * Uses fuzzy name search with pg_trgm for query matching
   */
  const searchAirfoils = async (params: SearchParams = {}): Promise<SearchResult> => {
    const {
      query,
      includeName,
      excludeName,
      thicknessMin,
      thicknessMax,
      camberMin,
      camberMax,
      categoryIds,
      sortBy = 'name',
      sortDir = 'asc',
      page = 1,
      limit = 20,
    } = params

    const offset = (page - 1) * limit

    // Build query
    let supabaseQuery = supabase
      .from('airfoils')
      .select('*', { count: 'exact' })

    // Fuzzy name search - use ilike for partial matching
    // For full pg_trgm fuzzy search, you may need a database function or RPC call
    if (query && query.trim()) {
      const searchTerm = `%${query.trim()}%`
      supabaseQuery = supabaseQuery.ilike('name', searchTerm)
    }

    // Include name filter
    if (includeName && includeName.trim()) {
      const includeTerm = `%${includeName.trim()}%`
      supabaseQuery = supabaseQuery.ilike('name', includeTerm)
    }

    // Thickness filter
    if (thicknessMin !== undefined) {
      supabaseQuery = supabaseQuery.gte('thickness_pct', thicknessMin)
    }
    if (thicknessMax !== undefined) {
      supabaseQuery = supabaseQuery.lte('thickness_pct', thicknessMax)
    }

    // Camber filter
    if (camberMin !== undefined) {
      supabaseQuery = supabaseQuery.gte('camber_pct', camberMin)
    }
    if (camberMax !== undefined) {
      supabaseQuery = supabaseQuery.lte('camber_pct', camberMax)
    }

    // Category filter - only include airfoils with selected categories
    if (categoryIds && categoryIds.length > 0) {
      supabaseQuery = supabaseQuery.in('category', categoryIds)
    }

    // For exclude filter, we need to fetch all matching results first, then filter client-side
    // because Supabase PostgREST doesn't directly support NOT ILIKE
    const needsExcludeFilter = excludeName && excludeName.trim()

    // Map sort field to database column
    const sortColumn = sortBy === 'thickness' ? 'thickness_pct' : sortBy === 'camber' ? 'camber_pct' : 'name'
    let orderedQuery = supabaseQuery.order(sortColumn, { ascending: sortDir === 'asc' })
    
    if (!needsExcludeFilter) {
      // Normal pagination when no exclude filter
      orderedQuery = orderedQuery.range(offset, offset + limit - 1)
    }
    // If exclude filter needed, fetch all results (no range limit)

    const { data, error, count: rawCount } = await orderedQuery

    if (error) {
      console.error('Error searching airfoils:', error)
      throw error
    }

    let filteredData = data || []
    let finalCount = rawCount || 0

    // Apply exclude filter client-side if needed
    if (needsExcludeFilter && filteredData.length > 0) {
      const excludeTerm = excludeName.trim().toLowerCase()
      filteredData = filteredData.filter(airfoil => 
        !airfoil.name.toLowerCase().includes(excludeTerm)
      )
      finalCount = filteredData.length
      
      // Apply pagination after filtering
      const startIdx = offset
      const endIdx = offset + limit
      filteredData = filteredData.slice(startIdx, endIdx)
    }

    const totalPages = finalCount ? Math.ceil(finalCount / limit) : 0

    return {
      data: filteredData,
      count: finalCount,
      page,
      limit,
      totalPages,
    }
  }

  return {
    searchAirfoils,
  }
}

