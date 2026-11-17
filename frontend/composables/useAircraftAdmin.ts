/**
 * Data access for the aircraft manager page: thin functions over the Supabase client.
 * Every write returns the affected rows, because RLS drops blocked updates and deletes without an error.
 */
import type { Database } from '~/types/database.types'
import { ilikeAny } from '~/utils/aircraftAdmin'

export type Aircraft = Database['public']['Tables']['aircraft']['Row']
type AircraftUpdate = Database['public']['Tables']['aircraft']['Update']
type AssignmentInsert = Database['public']['Tables']['aircraft_airfoils']['Insert']
type AssignmentUpdate = Database['public']['Tables']['aircraft_airfoils']['Update']

export const AIRCRAFT_PAGE_SIZE = 50

// two foreign keys point at airfoils, so each embed names its constraint
const ASSIGNMENT_SELECT = '*, airfoil:airfoils!aircraft_airfoils_airfoil_id_fkey(id, name), probable:airfoils!aircraft_airfoils_probable_airfoil_id_fkey(id, name)'

export const useAircraftAdmin = () => {
  const supabase = useSupabaseClient<Database>()

  const throwIfError = (error: { message: string } | null, action: string) => {
    if (error) throw new Error(`Could not ${action}: ${error.message}`)
  }
  const throwIfNone = (rows: unknown[] | null, action: string) => {
    if (!rows || rows.length === 0) throw new Error(`Could not ${action}: no row was changed (the database may not allow this write).`)
  }

  const listAircraft = async (query: string, hiddenOnly: boolean, page: number) => {
    const from = (page - 1) * AIRCRAFT_PAGE_SIZE
    let req = supabase
      .from('aircraft')
      .select('*', { count: 'exact' })
      .order('name')
      .order('id')
      .range(from, from + AIRCRAFT_PAGE_SIZE - 1)
    if (query) req = req.or(ilikeAny(['name', 'display_name'], query))
    if (hiddenOnly) req = req.eq('hidden', true)
    const { data, count, error } = await req
    throwIfError(error, 'load aircraft')
    return { rows: data ?? [], count: count ?? 0 }
  }

  const getAircraftByKey = async (key: string) => {
    const { data, error } = await supabase.from('aircraft').select('*').eq('key', key).maybeSingle()
    throwIfError(error, 'load the aircraft')
    return data
  }

  const createAircraft = async (fields: { key: string, name: string, display_name: string | null, category: string | null }) => {
    if (await getAircraftByKey(fields.key))
      throw new Error(`An aircraft with the key "${fields.key}" already exists.`)
    const { data, error } = await supabase.from('aircraft').insert(fields).select()
    throwIfError(error, 'create the aircraft')
    throwIfNone(data, 'create the aircraft')
    return data![0]
  }

  const updateAircraft = async (id: string, patch: AircraftUpdate) => {
    const { data, error } = await supabase
      .from('aircraft')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
    throwIfError(error, 'save the aircraft')
    throwIfNone(data, 'save the aircraft')
    return data![0]
  }

  const deleteAircraft = async (id: string) => {
    const { data, error } = await supabase.from('aircraft').delete().eq('id', id).select('id')
    throwIfError(error, 'delete the aircraft')
    throwIfNone(data, 'delete the aircraft')
  }

  const listAssignments = async (aircraftId: string) => {
    const { data, error } = await supabase.from('aircraft_airfoils').select(ASSIGNMENT_SELECT).eq('aircraft_id', aircraftId)
    throwIfError(error, 'load the assigned airfoils')
    return data ?? []
  }

  const addAssignment = async (row: AssignmentInsert) => {
    const { data, error } = await supabase.from('aircraft_airfoils').insert(row).select(ASSIGNMENT_SELECT)
    throwIfError(error, 'add the airfoil')
    throwIfNone(data, 'add the airfoil')
    return data![0]
  }

  const updateAssignment = async (id: string, patch: AssignmentUpdate) => {
    const { data, error } = await supabase.from('aircraft_airfoils').update(patch).eq('id', id).select(ASSIGNMENT_SELECT)
    throwIfError(error, 'save the airfoil row')
    throwIfNone(data, 'save the airfoil row')
    return data![0]
  }

  const deleteAssignment = async (id: string) => {
    const { data, error } = await supabase.from('aircraft_airfoils').delete().eq('id', id).select('id')
    throwIfError(error, 'delete the airfoil row')
    throwIfNone(data, 'delete the airfoil row')
  }

  return {
    listAircraft,
    getAircraftByKey,
    createAircraft,
    updateAircraft,
    deleteAircraft,
    listAssignments,
    addAssignment,
    updateAssignment,
    deleteAssignment,
  }
}

export type Assignment = Awaited<ReturnType<ReturnType<typeof useAircraftAdmin>['listAssignments']>>[number]
