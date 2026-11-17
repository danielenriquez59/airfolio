// Pages only admins may open. Add a path here to protect a new admin page.
const ADMIN_PATHS = ['/airfoils-manager', '/categories-manager', '/aircraft-manager']

export default defineNuxtRouteMiddleware(async (to) => {
  const path = to.path.replace(/\/$/, '')
  // The session lives in the browser, so there is nothing to check while pre-rendering.
  if (import.meta.server || !ADMIN_PATHS.includes(path))
    return

  const { data: { session } } = await useSupabaseClient().auth.getSession()
  if (!session)
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  if (!(await fetchIsAdmin()))
    return navigateTo('/')
})
