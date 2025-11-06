/**
 * Composable for airfoil autocomplete/search suggestions
 */
import type { Database } from '~/types/database.types'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

export const useAirfoilAutocomplete = () => {
  const supabase = useSupabaseClient<Database>()

  /**
   * Search airfoils by prefix match (exact prefix, case-insensitive)
   * Returns top N results sorted alphabetically
   */
  const searchAirfoilsByPrefix = async (query: string, limit = 15): Promise<Airfoil[]> => {
    if (!query || query.length < 2) {
      return []
    }

    const { data, error } = await supabase
      .from('airfoils')
      .select('id, name, description, thickness_pct, camber_pct')
      .ilike('name', `${query}%`) // Prefix match, case-insensitive
      .order('name', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Error searching airfoils by prefix:', error)
      throw error
    }

    return (data || []) as Airfoil[]
  }

  return {
    searchAirfoilsByPrefix,
  }
}

