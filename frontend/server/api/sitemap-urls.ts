import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '~/types/database.types'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient<Database>(event)

  // Fetch all airfoil names and update times; Supabase returns at most 1000 rows per request
  const data: { name: string, updated_at: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await client
      .from('airfoils')
      .select('name, updated_at')
      .order('name')
      .range(from, from + 999)
    if (error) throw createError({ statusCode: 502, statusMessage: error.message })
    data.push(...page)
    if (page.length < 1000) break
  }

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
