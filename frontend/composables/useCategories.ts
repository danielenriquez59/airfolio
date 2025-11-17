/**
 * Composable for category CRUD operations
 */
import type { Database } from '~/types/database.types'

type Category = Database['public']['Tables']['categories']['Row']
type Airfoil = Database['public']['Tables']['airfoils']['Row']

export const useCategories = () => {
  const supabase = useSupabaseClient<Database>()

  /**
   * Fetch all categories
   */
  const fetchCategories = async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching categories:', error)
      throw error
    }

    return data || []
  }

  /**
   * Create a new category
   */
  const createCategory = async (
    name: string,
    description?: string | null
  ): Promise<Category> => {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        description: description || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating category:', error)
      throw error
    }

    return data
  }

  /**
   * Update an existing category
   */
  const updateCategory = async (
    id: string,
    name: string,
    description?: string | null
  ): Promise<Category> => {
    const { data, error } = await supabase
      .from('categories')
      .update({
        name,
        description: description || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating category:', error)
      throw error
    }

    return data
  }

  /**
   * Delete a category
   */
  const deleteCategory = async (id: string): Promise<void> => {
    const { error } = await supabase.from('categories').delete().eq('id', id)

    if (error) {
      console.error('Error deleting category:', error)
      throw error
    }
  }

  /**
   * Assign a category to multiple airfoils
   */
  const assignCategoryToAirfoils = async (
    categoryId: string,
    airfoilIds: string[]
  ): Promise<void> => {
    if (airfoilIds.length === 0) {
      return
    }

    const { error } = await supabase
      .from('airfoils')
      .update({ category: categoryId })
      .in('id', airfoilIds)

    if (error) {
      console.error('Error assigning category to airfoils:', error)
      throw error
    }
  }

  /**
   * Remove category assignment from multiple airfoils
   */
  const removeCategory = async (airfoilIds: string[]): Promise<void> => {
    if (airfoilIds.length === 0) {
      return
    }

    const { error } = await supabase
      .from('airfoils')
      .update({ category: null })
      .in('id', airfoilIds)

    if (error) {
      console.error('Error removing category from airfoils:', error)
      throw error
    }
  }

  /**
   * Fetch airfoils filtered by category
   */
  const fetchAirfoilsByCategory = async (
    categoryId: string
  ): Promise<Airfoil[]> => {
    const { data, error } = await supabase
      .from('airfoils')
      .select('*')
      .eq('category', categoryId)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching airfoils by category:', error)
      throw error
    }

    return data || []
  }

  /**
   * Get count of airfoils per category
   */
  const getCategoryCounts = async (): Promise<
    Record<string, number>
  > => {
    const { data, error } = await supabase
      .from('airfoils')
      .select('category')

    if (error) {
      console.error('Error fetching category counts:', error)
      throw error
    }

    const counts: Record<string, number> = {}
    data?.forEach((airfoil) => {
      if (airfoil.category) {
        counts[airfoil.category] = (counts[airfoil.category] || 0) + 1
      }
    })

    return counts
  }

  /**
   * Fetch all airfoils with their category info
   */
  const fetchAllAirfoils = async (): Promise<Airfoil[]> => {
    // Fetch all airfoils in batches to avoid the 1000 row limit
    let allAirfoils: Airfoil[] = []
    let from = 0
    const batchSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('airfoils')
        .select('id, name, category')
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

  return {
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    assignCategoryToAirfoils,
    removeCategory,
    fetchAirfoilsByCategory,
    getCategoryCounts,
    fetchAllAirfoils,
  }
}

