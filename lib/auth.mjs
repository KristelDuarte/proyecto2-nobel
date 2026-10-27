/**
 * lib/auth.mjs
 * ------------
 * Verificación del token Bearer y control de acceso por rol.
 */

import { HttpError } from './http.mjs'
import { verifyToken } from './security.mjs'

/**
 * Extrae y valida el JWT del encabezado Authorization.
 * @param {Request} req
 * @param {{ roles?: string[] }} options
 * @returns {{ sub: string, email: string, name?: string, role: string }}
 */
export function requireAuth(req, { roles = null } = {}) {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    throw new HttpError(
      401,
      'missing_token',
      'Se requiere autenticación: envía el encabezado Authorization: Bearer <token>.',
    )
  }

  let payload
  try {
    payload = verifyToken(match[1].trim())
  } catch (error) {
    throw new HttpError(401, 'invalid_token', `Token no válido: ${error.message}.`)
  }

  if (roles && !roles.includes(payload.role)) {
    throw new HttpError(403, 'forbidden', 'Tu usuario no tiene permisos para esta operación.')
  }

  return payload
}
