/**
 * netlify/functions/categories.mjs
 * --------------------------------
 * Entidad SECUNDARIA: categorías del premio (Física, Química, …).
 *
 *   GET    /api/categories?q&page&limit
 *   GET    /api/categories/:key|:id
 *   POST   /api/categories            (requiere Bearer)
 *   PUT    /api/categories/:key|:id   (requiere Bearer)
 *   DELETE /api/categories/:key|:id   (requiere rol admin)
 */

import {
  api,
  json,
  routeParams,
  readJsonBody,
  requireMethod,
  intParam,
  escapeRegex,
  HttpError,
} from '../../lib/http.mjs'
import { getDb, COLLECTIONS, toObjectId, serialize } from '../../lib/db.mjs'
import { requireAuth } from '../../lib/auth.mjs'
import { validate } from '../../lib/validate.mjs'
import { paginate, findByIdOrKey, notFound, conflict, isDuplicateKey } from '../../lib/resource.mjs'

const SCHEMA = {
  key: { type: 'slug', required: true },
  name: { type: 'string', required: true, minLength: 2, maxLength: 60 },
  fullname: { type: 'string', maxLength: 140 },
  ordinal: { type: 'number', required: true, integer: true, min: 1, max: 99 },
  color: { type: 'hexcolor', required: true },
  icon: { type: 'string', maxLength: 40 },
  description: { type: 'string', maxLength: 900 },
  image: { type: 'string', maxLength: 400 },
}

/** Cuenta cuántos galardonados usan esta categoría (referencia inversa). */
const LOOKUP_COUNT = [
  {
    $lookup: {
      from: 'laureates',
      localField: '_id',
      foreignField: 'categoryId',
      as: '_laureates',
      pipeline: [{ $count: 'valor' }],
    },
  },
  { $addFields: { laureateCount: { $ifNull: [{ $arrayElemAt: ['$_laureates.valor', 0] }, 0] } } },
  { $project: { _laureates: 0 } },
]

export default api(async (req) => {
  const { url, params } = routeParams(req, 'categories')
  const db = await getDb()
  const categories = db.collection(COLLECTIONS.categories)
  const identificador = params[0]

  // ------------------------------------------------------------- colección
  if (!identificador) {
    if (req.method === 'GET') {
      const page = intParam(url, 'page', 1, { min: 1 })
      const limit = intParam(url, 'limit', 50, { min: 1, max: 100 })
      const q = (url.searchParams.get('q') || '').trim()

      const match = q
        ? { $or: [{ name: new RegExp(escapeRegex(q), 'i') }, { fullname: new RegExp(escapeRegex(q), 'i') }] }
        : {}

      const { rows, total, pages } = await paginate({
        collection: categories,
        match,
        sort: { ordinal: 1, name: 1 },
        lookups: LOOKUP_COUNT,
        page,
        limit,
      })

      return json({ data: rows, meta: { page, limit, total, pages, hasNext: page < pages } })
    }

    requireMethod(req, 'POST')
    requireAuth(req)
    const body = await readJsonBody(req)
    const values = validate(body, SCHEMA)

    const doc = {
      ...values,
      image: values.image || `/api/images/category.svg?k=${encodeURIComponent(values.key)}&c=${values.color.replace('#', '')}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    try {
      const { insertedId } = await categories.insertOne(doc)
      doc._id = insertedId
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw conflict('Ya existe una categoría con esa clave (key).', { key: 'Clave duplicada.' })
      }
      throw error
    }

    return json({ data: serialize(doc), message: 'Categoría creada correctamente.' }, 201)
  }

  // -------------------------------------------------------------- elemento
  const doc = await findByIdOrKey(categories, identificador, 'key')
  if (!doc) throw notFound('Categoría')

  if (req.method === 'GET') {
    const [conConteo] = await categories
      .aggregate([{ $match: { _id: doc._id } }, ...LOOKUP_COUNT])
      .toArray()
    return json({ data: serialize(conConteo) })
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    requireAuth(req)
    const body = await readJsonBody(req)
    const values = validate(body, SCHEMA)

    const repetida = await categories.findOne(
      { key: values.key, _id: { $ne: doc._id } },
      { projection: { _id: 1 } },
    )
    if (repetida) {
      throw conflict('Ya existe otra categoría con esa clave (key).', { key: 'Clave duplicada.' })
    }

    const update = {
      ...values,
      image: values.image || `/api/images/category.svg?k=${encodeURIComponent(values.key)}&c=${values.color.replace('#', '')}`,
      updatedAt: new Date(),
    }

    await categories.updateOne({ _id: doc._id }, { $set: update })
    return json({ data: serialize({ ...doc, ...update }), message: 'Categoría actualizada correctamente.' })
  }

  if (req.method === 'DELETE') {
    requireAuth(req, { roles: ['admin'] })

    const enUso = await db
      .collection(COLLECTIONS.laureates)
      .countDocuments({ categoryId: doc._id })
    if (enUso > 0) {
      throw conflict(
        `No se puede eliminar: ${enUso} galardonado(s) usan esta categoría. Reasígnalos primero.`,
        { laureateCount: enUso },
      )
    }

    await categories.deleteOne({ _id: doc._id })
    return json({ message: 'Categoría eliminada correctamente.', id: String(doc._id) })
  }

  requireMethod(req, ['GET', 'PUT', 'PATCH', 'DELETE'])
})
