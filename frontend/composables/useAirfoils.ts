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
   */
  const fetchRandomAirfoils = async (count = 3): Promise<Airfoil[]> => {
    // First, get total count
    const { count: totalCount, error: countError } = await supabase
      .from('airfoils')
      .select('*', { count: 'exact', head: true })

    if (countError || !totalCount || totalCount === 0) {
      console.error('Error fetching airfoil count:', countError)
      return []
    }

    // Generate random offsets
    const randomOffsets = Array.from({ length: count }, () =>
      Math.floor(Math.random() * totalCount)
    )

    // Fetch random airfoils
    const promises = randomOffsets.map(offset =>
      supabase
        .from('airfoils')
        .select('*')
        .range(offset, offset)
        .single()
    )

    const results = await Promise.all(promises)
    const airfoils = results
      .filter(result => result.data && !result.error)
      .map(result => result.data!)

    return airfoils
  }

  return {
    fetchAirfoil,
    fetchAirfoilGeometry,
    fetchAirfoilMetadata,
    fetchAirfoils,
    fetchRandomAirfoils,
  }
}

