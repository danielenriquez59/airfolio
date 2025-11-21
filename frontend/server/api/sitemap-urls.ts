import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '~/types/database.types'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient<Database>(event)

  // Fetch all airfoil names and update times
  const { data } = await client
    .from('airfoils')
    .select('name, updated_at')

  if (!data) return []

  return data.map((airfoil) => {
    return {
      // Ensure the slug is URL-encoded exactly as your app expects it
      loc: `/airfoils/${encodeURIComponent(airfoil.name)}`,
      lastmod: airfoil.updated_at || new Date().toISOString(),
      changefreq: 'monthly',
      priority: 0.8,
    }
  })
})
