/**
 * app/composables/useAuth.ts
 * --------------------------
 * Estado global de la sesión: registro, acceso, cierre de sesión y
 * restauración del token guardado en el navegador.
 */

import { apiFetch, ApiRequestError } from '~/composables/useApi'
import { clearSession, persistSession, readStoredUser, readToken, type SessionUser } from '~/utils/session'

interface AuthResponse {
  token: string
  user: SessionUser
}

interface AuthState {
  token: string | null
  user: SessionUser | null
  checked: boolean
}

export function useAuth() {
  const state = useState<AuthState>('auth', () => ({ token: null, user: null, checked: false }))

  const isAuthenticated = computed(() => Boolean(state.value.token))
  const isAdmin = computed(() => state.value.user?.role === 'admin')
  const user = computed(() => state.value.user)

  /** Recupera la sesión guardada y valida el token contra /auth/me. */
  async function restore() {
    if (state.value.checked) return
    const token = readToken()
    if (!token) {
      state.value = { token: null, user: null, checked: true }
      return
    }

    state.value = { token, user: readStoredUser(), checked: true }

    try {
      const { user: vigente } = await apiFetch<{ user: SessionUser }>('/auth/me')
      state.value = { token, user: vigente, checked: true }
      persistSession(token, vigente)
    } catch (error) {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        clearSession()
        state.value = { token: null, user: null, checked: true }
      }
    }
  }

  async function login(email: string, password: string) {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    persistSession(data.token, data.user)
    state.value = { token: data.token, user: data.user, checked: true }
    return data.user
  }

  async function register(name: string, email: string, password: string) {
    const data = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    })
    persistSession(data.token, data.user)
    state.value = { token: data.token, user: data.user, checked: true }
    return data.user
  }

  function logout() {
    clearSession()
    state.value = { token: null, user: null, checked: true }
  }

  return {
    state: readonly(state),
    user,
    isAuthenticated,
    isAdmin,
    restore,
    login,
    register,
    logout,
  }
}
