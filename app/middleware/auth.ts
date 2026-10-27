/**
 * app/middleware/auth.ts
 * ----------------------
 * Protege las rutas del panel de administración: restaura la sesión guardada
 * y, si no hay token válido, redirige al acceso guardando el destino.
 */

export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, restore } = useAuth()
  await restore()

  if (!isAuthenticated.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
