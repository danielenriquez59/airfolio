/**
 * Composable for airfoil CRUD operations
 */
import type { Database } from '~/types/database.types'
import type { AircraftUsageRow } from '~/utils/aircraftUsage'

type Airfoil = Database['public']['Tables']['airfoils']['Row']

/** Lightweight row for selection lists (no coordinate arrays). */
export type AirfoilListItem = Pick<
  Airfoil,
  'id' | 'name' | 'display_name' | 'thickness_pct' | 'camber_pct'
>

/** Meta description for an airfoil page: measured values first, then its own text, cut to ~160 characters. */
export const airfoilMetaDescription = (airfoil: Airfoil, displayName: string, categoryLabel?: string): string => {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`
  const at = (loc: number | null) => (loc != null ? ` at ${pct(loc)} chord` : '')
  const points = (airfoil.upper_x_coordinates?.length ?? 0) + (airfoil.lower_x_coordinates?.length ?? 0)
  const facts = [
    airfoil.thickness_pct != null && `${pct(airfoil.thickness_pct)} thick${at(airfoil.thickness_loc_pct)}`,
    airfoil.camber_pct === 0 ? 'symmetric' : airfoil.camber_pct != null && `${pct(airfoil.camber_pct)} camber${at(airfoil.camber_loc_pct)}`,
    categoryLabel,
    points > 0 && `${points} points`,
  ].filter(Boolean).join(', ')
  const text = `${displayName} airfoil${facts ? `: ${facts}.` : '.'} ${airfoil.description || 'Coordinates, geometry and polars.'}`
  return text.length <= 160 ? text : `${text.slice(0, 159).replace(/\s+\S*$/, '')}…`
}

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
   * Fetch a single airfoil by name (slug) with full details
   */
  const fetchAirfoilByName = async (name: string): Promise<Airfoil | null> => {
    // Decode the slug (name) from URL format
    const decodedName = decodeURIComponent(name)

    const { data, error } = await supabase
      .from('airfoils')
      .select('*')
      .eq('name', decodedName)
      .maybeSingle()

    if (error) {
      console.error('Error fetching airfoil by name:', error)
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
   * Fetch slim airfoil rows for selection UIs (no coordinate payloads).
   */
  const fetchAirfoilListItems = async (): Promise<AirfoilListItem[]> => {
    const batchSize = 1000
    let all: AirfoilListItem[] = []
    let from = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('airfoils')
        .select('id, name, display_name, thickness_pct, camber_pct')
        .order('name', { ascending: true })
        .range(from, from + batchSize - 1)

      if (error) {
        console.error('Error fetching airfoil list items:', error)
        throw error
      }

      if (data && data.length > 0) {
        all = [...all, ...data]
        from += batchSize
        hasMore = data.length === batchSize
      }
      else {
        hasMore = false
      }
    }

    return all
  }

  /**
   * Fetch full airfoil rows by IDs (includes coordinates).
   * Results are ordered to match the given id list.
   */
  const fetchAirfoilsByIds = async (ids: string[]): Promise<Airfoil[]> => {
    if (ids.length === 0)
      return []

    const { data, error } = await supabase
      .from('airfoils')
      .select('*')
      .in('id', ids)

    if (error) {
      console.error('Error fetching airfoils by ids:', error)
      throw error
    }

    const byId = new Map((data || []).map(a => [a.id, a]))
    return ids.map(id => byId.get(id)).filter((a): a is Airfoil => Boolean(a))
  }

  /**
   * Fetch the aircraft rows that use an airfoil (exact matches only, uncertain entries left out).
   * Hidden aircraft are filtered out by RLS; the largest airfoils pass 1000 rows, so this pages.
   */
  const fetchAircraftUsage = async (airfoilId: string): Promise<AircraftUsageRow[]> => {
    const rows: AircraftUsageRow[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('aircraft_airfoils')
        .select('surface, position, modified, sources, aircraft(key, name, display_name)')
        .eq('airfoil_id', airfoilId)
        .eq('uncertain', false)
        .order('id')
        .range(from, from + 999)

      if (error) {
        console.error('Error fetching aircraft usage:', error)
        throw error
      }

      rows.push(...data)
      if (data.length < 1000) break
    }
    return rows
  }

  /**
   * Get random airfoils (for featured section)
   * Uses RPC function get_random_airfoils
   */
  const fetchRandomAirfoils = async (count = 3): Promise<Airfoil[]> => {
    try {
      // Type assertion needed because RPC function not in generated types
      const { data, error } = await (supabase.rpc as any)('get_random_airfoils', {
        limit_count: count,
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
    }
    catch (err: any) {
      console.error('[fetchRandomAirfoils] Exception:', err)
      throw err
    }
  }

  /**
   * Fetch all airfoils without pagination (for management view)
   * Fetches in batches to handle large datasets
   */
  const fetchAllAirfoils = async (): Promise<Airfoil[]> => {
    let allAirfoils: Airfoil[] = []
    let from = 0
    const batchSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('airfoils')
        .select('*')
        .order('name', { ascending: true })
        .range(from, from + batchSize - 1)

      if (error) {
        console.error('Error fetching airfoils:', error)
        throw error
      }

      if (data && data.length > 0) {
        allAirfoils = [...allAirfoils, ...data]
        from += batchSize
        hasMore = data.length === batchSize
      } else {
        hasMore = false
      }
    }

    return allAirfoils
  }

  /**
   * Update airfoil fields (metadata and/or geometry properties)
   */
  const updateAirfoil = async (
    id: string,
    updates: Partial<Pick<
      Airfoil,
      | 'display_name'
      | 'description'
      | 'thickness_pct'
      | 'thickness_loc_pct'
      | 'camber_pct'
      | 'camber_loc_pct'
      | 'area_coefficient'
      | 'le_radius'
      | 'te_thickness'
      | 'te_angle'
      | 'upper_surface_nodes'
      | 'lower_surface_nodes'
      | 'upper_x_coordinates'
      | 'upper_y_coordinates'
      | 'lower_x_coordinates'
      | 'lower_y_coordinates'
    >>
  ): Promise<Airfoil> => {
    const { data, error } = await supabase
      .from('airfoils')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating airfoil:', error)
      throw error
    }

    return data
  }

  /**
   * Hard-delete an airfoil and its performance_cache rows.
   */
  const deleteAirfoil = async (id: string): Promise<void> => {
    const { error: cacheError } = await supabase
      .from('performance_cache')
      .delete()
      .eq('airfoil_id', id)

    if (cacheError) {
      console.error('Error deleting performance cache:', cacheError)
      throw cacheError
    }

    const { data, error } = await supabase
      .from('airfoils')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      console.error('Error deleting airfoil:', error)
      throw error
    }

    // RLS silently filters blocked deletes, so zero rows means it did not happen.
    if (!data || data.length === 0) {
      throw new Error('Airfoil was not deleted. You may not have permission to delete airfoils.')
    }
  }

  return {
    fetchAirfoil,
    fetchAirfoilByName,
    fetchAirfoilGeometry,
    fetchAirfoilListItems,
    fetchAirfoilsByIds,
    fetchRandomAirfoils,
    fetchAircraftUsage,
    fetchAllAirfoils,
    updateAirfoil,
    deleteAirfoil,
  }
}
