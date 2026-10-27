/**
 * app/utils/session.ts
 * --------------------
 * Persistencia de la sesión (token JWT + datos del usuario) en localStorage.
 * Al ser una SPA, el token se envía en el encabezado Authorization en cada
 * petición protegida.
 */

export interface SessionUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'editor'
  createdAt?: string
}

const TOKEN_KEY = 'catalogo-nobel.token'
const USER_KEY = 'catalogo-nobel.user'

function disponible() {
  return import.meta.client && typeof localStorage !== 'undefined'
}

export function readToken(): string | null {
  if (!disponible()) return null
  return localStorage.getItem(TOKEN_KEY)
}

export function readStoredUser(): SessionUser | null {
  if (!disponible()) return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export function persistSession(token: string, user: SessionUser) {
  if (!disponible()) return
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  if (!disponible()) return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
