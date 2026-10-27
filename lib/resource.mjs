/**
 * lib/resource.mjs
 * ----------------
 * Piezas reutilizables para implementar los recursos REST:
 * paginación con agregación, búsqueda, poblado de referencias y errores comunes.
 */

import { HttpError } from './http.mjs'
import { serialize, toObjectId } from './db.mjs'

/** Poblado de la referencia `categoryId` → `category`. */
export const LOOKUP_CATEGORY = [
  {
    $lookup: {
      from: 'categories',
      localField: 'categoryId',
      foreignField: '_id',
      as: '_category',
    },
  },
  { $addFields: { category: { $arrayElemAt: ['$_category', 0] } } },
  { $project: { _category: 0 } },
]

/** Poblado de la referencia `countryId` → `country`. */
export const LOOKUP_COUNTRY = [
  {
    $lookup: {
      from: 'countries',
      localField: 'countryId',
      foreignField: '_id',
      as: '_country',
    },
  },
  { $addFields: { country: { $arrayElemAt: ['$_country', 0] } } },
  { $project: { _country: 0 } },
]

/**
 * Ejecuta una consulta paginada con `$facet` (filas + total en una sola pasada).
 *
 * @param {object} options
 * @param {import('mongodb').Collection} options.collection
 * @param {object} options.match        filtro de MongoDB
 * @param {object} options.sort         orden de MongoDB
 * @param {any[]}  [options.lookups]    etapas de poblado
 * @param {any[]}  [options.project]    proyección posterior
 * @param {number} options.page         1-based
 * @param {number} options.limit
 * @returns {Promise<{ rows: any[], total: number, page: number, limit: number, pages: number }>}
 */
export async function paginate({ collection, match = {}, sort = {}, lookups = [], project = [], page = 1, limit = 12 }) {
  const skip = (page - 1) * limit

  const [result] = await collection
    .aggregate([
      { $match: match },
      { $sort: sort },
      {
        $facet: {
          rows: [
            { $skip: skip },
            { $limit: limit },
            ...lookups,
            ...(project.length ? [{ $project: project }] : []),
          ],
          total: [{ $count: 'value' }],
        },
      },
    ])
    .toArray()

  const total = result?.total?.[0]?.value ?? 0

  return {
    rows: (result?.rows ?? []).map(serialize),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  }
}

/**
 * Busca un documento por ObjectId o por su clave natural (`key`, `code`).
 * La búsqueda por clave natural no distingue mayúsculas de minúsculas, para
 * aceptar tanto `/api/countries/gt` como `/api/countries/GT`.
 * @returns {Promise<any|null>}
 */
export async function findByIdOrKey(collection, identifier, keyField) {
  if (!identifier) return null
  const raw = String(identifier)

  const oid = toObjectId(raw)
  if (oid) {
    const doc = await collection.findOne({ _id: oid })
    if (doc) return doc
  }

  if (keyField) {
    const exacto = await collection.findOne({ [keyField]: raw })
    if (exacto) return exacto
    return collection.findOne({ [keyField]: new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
  }

  return null
}

/** Lanza 404 cuando un recurso no existe. */
export function notFound(resource = 'Recurso') {
  return new HttpError(404, 'not_found', `${resource} no encontrado.`)
}

/** Lanza 409 cuando hay conflicto de unicidad o de integridad referencial. */
export function conflict(message, details = null) {
  return new HttpError(409, 'conflict', message, details)
}

export function isDuplicateKey(error) {
  return error && typeof error === 'object' && error.code === 11000
}

/** Devuelve el campo duplicado del error de MongoDB (para mensajes claros). */
export function duplicateField(error) {
  const pattern = error?.keyPattern
  if (pattern && typeof pattern === 'object') return Object.keys(pattern)[0]
  const message = String(error?.message || '')
  const match = message.match(/index: (\w+)/)
  return match ? match[1] : null
}
