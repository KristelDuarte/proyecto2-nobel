/**
 * netlify/functions/auth.mjs
 * --------------------------
 * Servicio de autenticación con JWT.
 *
 *   POST /api/auth/register  { name, email, password }  → 201 { token, user }
 *   POST /api/auth/login     { email, password }        → 200 { token, user }
 *   GET  /api/auth/me                                   → 200 { user }   (requiere Bearer)
 */

import { api, json, routeParams, readJsonBody, requireMethod, HttpError } from '../../lib/http.mjs'
import { getDb, COLLECTIONS, toObjectId } from '../../lib/db.mjs'
import { hashPassword, verifyPassword, signToken, TOKEN_TTL } from '../../lib/security.mjs'
import { requireAuth } from '../../lib/auth.mjs'
import { validate } from '../../lib/validate.mjs'
import { conflict, isDuplicateKey } from '../../lib/resource.mjs'

const USER_SCHEMA = {
  name: { type: 'string', required: true, minLength: 2, maxLength: 80 },
  email: { type: 'email', required: true },
  password: { type: 'string', required: true, minLength: 8, maxLength: 100 },
}

function publicUser(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  }
}

const ACTIONS = ['register', 'login', 'me']

export default api(async (req) => {
  const { params } = routeParams(req, 'auth')
  const action = (params[0] || '').toLowerCase()

  if (!ACTIONS.includes(action)) {
    throw new HttpError(
      404,
      'unknown_action',
      `Acción de autenticación desconocida. Opciones: ${ACTIONS.join(', ')}.`,
    )
  }

  const db = await getDb()
  const users = db.collection(COLLECTIONS.users)

  // ---------------------------------------------------------------- registro
  if (action === 'register') {
    requireMethod(req, 'POST')
    const body = await readJsonBody(req)
    const values = validate(body, USER_SCHEMA)

    const existente = await users.findOne({ email: values.email })
    if (existente) {
      throw conflict('Ya existe una cuenta registrada con ese correo electrónico.', {
        email: 'Correo ya registrado.',
      })
    }

    // El primer usuario registrado en una base vacía se convierte en administrador.
    const totalUsuarios = await users.countDocuments()
    const role = totalUsuarios === 0 ? 'admin' : 'editor'

    const doc = {
      name: values.name,
      email: values.email,
      passwordHash: hashPassword(values.password),
      role,
      createdAt: new Date(),
    }

    try {
      const { insertedId } = await users.insertOne(doc)
      doc._id = insertedId
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw conflict('Ya existe una cuenta registrada con ese correo electrónico.')
      }
      throw error
    }

    const token = signToken({ sub: String(doc._id), email: doc.email, name: doc.name, role })
    return json({ token, tokenType: 'Bearer', expiresIn: TOKEN_TTL, user: publicUser(doc) }, 201)
  }

  // ------------------------------------------------------------------ acceso
  if (action === 'login') {
    requireMethod(req, 'POST')
    const body = await readJsonBody(req)
    const values = validate(body, {
      email: { type: 'email', required: true },
      password: { type: 'string', required: true, minLength: 1, maxLength: 100 },
    })

    const user = await users.findOne({ email: values.email })
    const valido = user ? verifyPassword(values.password, user.passwordHash) : false

    if (!user || !valido) {
      throw new HttpError(401, 'invalid_credentials', 'Correo electrónico o contraseña incorrectos.')
    }

    const token = signToken({
      sub: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
    })

    return json({ token, tokenType: 'Bearer', expiresIn: TOKEN_TTL, user: publicUser(user) })
  }

  // ------------------------------------------------------- sesión actual (me)
  requireMethod(req, 'GET')
  const claims = requireAuth(req)
  const oid = toObjectId(claims.sub)
  const user = oid ? await users.findOne({ _id: oid }) : null
  if (!user) {
    throw new HttpError(401, 'user_not_found', 'La cuenta asociada al token ya no existe.')
  }
  return json({ user: publicUser(user) })
})
