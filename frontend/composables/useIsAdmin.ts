import type { Database } from '~/types/database.types'

/**
 * Whether the signed-in user is an admin. Use it to hide admin pages and controls.
 * It is not the security boundary: the database refuses non-admin writes by itself.
 */
export async function fetchIsAdmin(): Promise<boolean> {
  const supabase = useSupabaseClient<Database>()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session)
    return false
  const { data } = await supabase.rpc('is_admin')
  return data === true
}

/**
 * Reactive admin flag shared by every caller. Starts false (pre-rendered HTML has no session)
 * and is re-checked after mount and whenever the signed-in user changes.
 */
export function useIsAdmin() {
  const isAdmin = useState('is_admin', () => false)
  // the user id the flag was last checked for, so several callers trigger one RPC per auth change
  const checkedFor = useState<string | null | undefined>('is_admin_checked_for', () => undefined)
  const session = useSupabaseSession()
  onMounted(() => {
    watch(() => session.value?.user.id ?? null, async (userId) => {
      if (checkedFor.value === userId)
        return
      checkedFor.value = userId
      const result = await fetchIsAdmin()
      if (checkedFor.value === userId)
        isAdmin.value = result
    }, { immediate: true })
  })
  return isAdmin
}
