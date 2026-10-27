/**
 * netlify/functions/countries.mjs
 * -------------------------------
 * Entidad SECUNDARIA: países de nacimiento de los galardonados.
 *
 *   GET    /api/countries?q&region&page&limit
 *   GET    /api/countries/:code|:id
 *   POST   /api/countries             (requiere Bearer)
 *   PUT    /api/countries/:code|:id   (requiere Bearer)
 *   DELETE /api/countries/:code|:id   (requiere rol admin)
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
import { getDb, COLLECTIONS, serialize } from '../../lib/db.mjs'
import { requireAuth } from '../../lib/auth.mjs'
import { validate } from '../../lib/validate.mjs'
import { paginate, findByIdOrKey, notFound, conflict, isDuplicateKey } from '../../lib/resource.mjs'

export const REGIONS = [
  'América del Norte',
  'América Central y el Caribe',
  'América del Sur',
  'Europa',
  'Asia',
  'África',
  'Oceanía',
  'Oriente Medio',
]

const SCHEMA = {
  code: { type: 'iso2', required: true },
  name: { type: 'string', required: true, minLength: 2, maxLength: 90 },
  region: { type: 'enum', required: true, values: REGIONS },
  capital: { type: 'string', maxLength: 90 },
  description: { type: 'string', maxLength: 900 },
  flag: { type: 'string', maxLength: 400 },
}

const bandera = (code) => `https://flagcdn.com/w320/${code.toLowerCase()}.png`

const LOOKUP_COUNT = [
  {
    $lookup: {
      from: 'laureates',
      localField: '_id',
      foreignField: 'countryId',
      as: '_laureates',
      pipeline: [{ $count: 'valor' }],
    },
  },
  { $addFields: { laureateCount: { $ifNull: [{ $arrayElemAt: ['$_laureates.valor', 0] }, 0] } } },
  { $project: { _laureates: 0 } },
]

export default api(async (req) => {
  const { url, params } = routeParams(req, 'countries')
  const db = await getDb()
  const countries = db.collection(COLLECTIONS.countries)
  const identificador = params[0]

  // ------------------------------------------------------------- colección
  if (!identificador) {
    if (req.method === 'GET') {
      const page = intParam(url, 'page', 1, { min: 1 })
      const limit = intParam(url, 'limit', 60, { min: 1, max: 100 })
      const q = (url.searchParams.get('q') || '').trim()
      const region = url.searchParams.get('region')

      const match = {}
      if (q) match.name = new RegExp(escapeRegex(q), 'i')
      if (region && REGIONS.includes(region)) match.region = region

      const { rows, total, pages } = await paginate({
        collection: countries,
        match,
        sort: { name: 1 },
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
      flag: values.flag || bandera(values.code),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    try {
      const { insertedId } = await countries.insertOne(doc)
      doc._id = insertedId
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw conflict('Ya existe un país con ese código ISO o nombre.', {
          code: 'Código duplicado.',
        })
      }
      throw error
    }

    return json({ data: serialize(doc), message: 'País creado correctamente.' }, 201)
  }

  // -------------------------------------------------------------- elemento
  const doc = await findByIdOrKey(countries, identificador, 'code')
  if (!doc) throw notFound('País')

  if (req.method === 'GET') {
    const [conConteo] = await countries
      .aggregate([{ $match: { _id: doc._id } }, ...LOOKUP_COUNT])
      .toArray()
    return json({ data: serialize(conConteo) })
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    requireAuth(req)
    const body = await readJsonBody(req)
    const values = validate(body, SCHEMA)

    const repetido = await countries.findOne(
      { $or: [{ code: values.code }, { name: values.name }], _id: { $ne: doc._id } },
      { projection: { _id: 1 } },
    )
    if (repetido) {
      throw conflict('Ya existe otro país con ese código ISO o nombre.')
    }

    const update = {
      ...values,
      flag: values.flag || bandera(values.code),
      updatedAt: new Date(),
    }

    await countries.updateOne({ _id: doc._id }, { $set: update })
    return json({ data: serialize({ ...doc, ...update }), message: 'País actualizado correctamente.' })
  }

  if (req.method === 'DELETE') {
    requireAuth(req, { roles: ['admin'] })

    const enUso = await db.collection(COLLECTIONS.laureates).countDocuments({ countryId: doc._id })
    if (enUso > 0) {
      throw conflict(
        `No se puede eliminar: ${enUso} galardonado(s) nacieron en este país. Reasígnalos primero.`,
        { laureateCount: enUso },
      )
    }

    await countries.deleteOne({ _id: doc._id })
    return json({ message: 'País eliminado correctamente.', id: String(doc._id) })
  }

  requireMethod(req, ['GET', 'PUT', 'PATCH', 'DELETE'])
})
