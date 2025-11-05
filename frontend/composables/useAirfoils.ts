/**
 * Composable for airfoil CRUD operations
 */
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

export const useAirfoils = () => {
  const supabase = useSupabaseClient<Database>()

  /**
   * Fetch a single airfoil by ID with full details
   */
  const fetchAirfoil = async (id: string): Promise<Airfoil | null> => {
    const { data, error } = await supabase
      .from('airfoils')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching airfoil:', error)
      throw error
    }

    return data
  }

  /**
   * Fetch airfoil geometry points only (for visualization)
   * Returns coordinate arrays for upper and lower surfaces
   */
  const fetchAirfoilGeometry = async (id: string) => {
    const { data, error } = await supabase
      .from('airfoils')
      .select('upper_x_coordinates, upper_y_coordinates, lower_x_coordinates, lower_y_coordinates')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching airfoil geometry:', error)
      throw error
    }

    return data
  }

  /**
   * Fetch airfoil metadata only (without heavy geometry data)
   * Useful for lists and cards
   */
  const fetchAirfoilMetadata = async (id: string) => {
    const { data, error } = await supabase
      .from('airfoils')
      .select('id, name, description, thickness_pct, thickness_loc_pct, camber_pct, camber_loc_pct, source_url, created_at')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching airfoil metadata:', error)
      throw error
    }

    return data
  }

  /**
   * Get paginated list of all airfoils
   */
  const fetchAirfoils = async (page = 1, limit = 20): Promise<Airfoil[]> => {
    const offset = (page - 1) * limit

    const { data, error } = await supabase
      .from('airfoils')
      .select('*')
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching airfoils:', error)
      throw error
    }

    return data || []
  }

  /**
   * Get random airfoils (for featured section)
   * Uses RPC function get_random_airfoils
   */
  const fetchRandomAirfoils = async (count = 3): Promise<Airfoil[]> => {
    try {
      // Type assertion needed because RPC function not in generated types
      const { data, error } = await (supabase.rpc as any)('get_random_airfoils', { 
        limit_count: count 
      })

      if (error) {
        console.error('[fetchRandomAirfoils] RPC Error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
        throw new Error(`Failed to fetch random airfoils: ${error.message || 'Unknown error'}`)
      }

      if (!data) {
        console.warn('[fetchRandomAirfoils] No data returned from get_random_airfoils')
        return []
      }

      // Ensure we have an array of airfoils
      if (!Array.isArray(data)) {
        console.error('[fetchRandomAirfoils] Expected array but got:', typeof data, data)
        return []
      }

      if (data.length === 0) {
        console.warn('[fetchRandomAirfoils] Empty array returned - database might be empty')
      }

      return data as Airfoil[]
    } catch (err: any) {
      console.error('[fetchRandomAirfoils] Exception:', err)
      throw err
    }
  }

  return {
    fetchAirfoil,
    fetchAirfoilGeometry,
    fetchAirfoilMetadata,
    fetchAirfoils,
    fetchRandomAirfoils,
  }
}

