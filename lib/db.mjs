/**
 * lib/db.mjs
 * ----------
 * Conexión única y reutilizable a MongoDB Atlas.
 *
 * Las Netlify Functions son "serverless": el proceso se reutiliza entre
 * invocaciones mientras esté "caliente". Se cachea la promesa de conexión para
 * no abrir un cliente nuevo en cada petición (evita agotar el límite de
 * conexiones del clúster gratuito de Atlas).
 */

import { MongoClient, ObjectId } from 'mongodb'
import { HttpError } from './http.mjs'

const uri = () => {
  const value = process.env.MONGODB_URI
  if (!value) {
    throw new HttpError(
      503,
      'db_not_configured',
      'La base de datos no está configurada: falta la variable de entorno MONGODB_URI.',
    )
  }
  return value
}

let clientePromesa = null

export async function getClient() {
  if (!clientePromesa) {
    const cliente = new MongoClient(uri(), {
      maxPoolSize: 5,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      retryWrites: true,
    })
    clientePromesa = cliente.connect().catch((error) => {
      // No cachear un fallo: la siguiente invocación debe poder reintentar.
      clientePromesa = null
      throw error
    })
  }
  return clientePromesa
}

export async function getDb() {
  const cliente = await getClient()
  return cliente.db(process.env.MONGODB_DB || 'nobel')
}

export const COLLECTIONS = {
  laureates: 'laureates',
  categories: 'categories',
  countries: 'countries',
  users: 'users',
}

/** Convierte un id de ruta en ObjectId; lanza 400 si no es válido. */
export function toObjectId(value) {
  if (value instanceof ObjectId) return value
  if (typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value)) {
    return new ObjectId(value)
  }
  return null
}

/** Normaliza un documento de MongoDB para la API (`_id` → `id`, refs a string). */
export function serialize(doc) {
  if (!doc) return null
  const { _id, passwordHash, ...rest } = doc
  const out = { id: String(_id), ...rest }

  for (const key of ['categoryId', 'countryId']) {
    if (out[key] instanceof ObjectId) out[key] = String(out[key])
    else if (out[key]) out[key] = String(out[key])
  }

  if (out.category && out.category._id) {
    out.category = serialize(out.category)
  }
  if (out.country && out.country._id) {
    out.country = serialize(out.country)
  }
  if (out.createdAt instanceof Date) out.createdAt = out.createdAt.toISOString()
  if (out.updatedAt instanceof Date) out.updatedAt = out.updatedAt.toISOString()

  return out
}

export { ObjectId }
