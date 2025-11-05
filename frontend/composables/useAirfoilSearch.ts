/**
 * Composable for airfoil search and filtering operations
 */
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

export interface SearchParams {
  query?: string
  thicknessMin?: number
  thicknessMax?: number
  camberMin?: number
  camberMax?: number
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
      thicknessMin,
      thicknessMax,
      camberMin,
      camberMax,
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

    // Order by name and paginate
    const { data, error, count } = await supabaseQuery
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error searching airfoils:', error)
      throw error
    }

    const totalPages = count ? Math.ceil(count / limit) : 0

    return {
      data: data || [],
      count: count || 0,
      page,
      limit,
      totalPages,
    }
  }

  return {
    searchAirfoils,
  }
}

