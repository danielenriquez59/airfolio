/**
 * Composable for airfoil search and filtering operations
 */
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

export type SortField = 'name' | 'thickness' | 'camber' | 'uploadDate'
export type SortDirection = 'asc' | 'desc'

export interface SearchParams {
  query?: string
  includeName?: string
  excludeName?: string
  thicknessMin?: number
  thicknessMax?: number
  camberMin?: number
  camberMax?: number
  areaMin?: number
  areaMax?: number
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
      areaMin,
      areaMax,
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

    // Exclude name filter
    if (excludeName && excludeName.trim()) {
      const excludeTerm = `%${excludeName.trim()}%`
      supabaseQuery = supabaseQuery.not('name', 'ilike', excludeTerm)
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

    // Area coefficient filter
    if (areaMin !== undefined) {
      supabaseQuery = supabaseQuery.gte('area_coefficient', areaMin)
    }
    if (areaMax !== undefined) {
      supabaseQuery = supabaseQuery.lte('area_coefficient', areaMax)
    }

    // Category filter - only include airfoils with selected categories
    if (categoryIds && categoryIds.length > 0) {
      supabaseQuery = supabaseQuery.in('category', categoryIds)
    }

    // Map sort field to database column
    const sortColumn =
      sortBy === 'thickness' ? 'thickness_pct'
        : sortBy === 'camber' ? 'camber_pct'
          : sortBy === 'uploadDate' ? 'created_at'
            : 'name'
    const { data, error, count } = await supabaseQuery
      .order(sortColumn, { ascending: sortDir === 'asc' })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error searching airfoils:', error)
      throw error
    }

    const finalCount = count || 0
    const totalPages = finalCount ? Math.ceil(finalCount / limit) : 0

    return {
      data: data || [],
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

