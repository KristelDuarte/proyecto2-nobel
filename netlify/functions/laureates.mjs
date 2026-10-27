/**
 * netlify/functions/laureates.mjs
 * -------------------------------
 * Entidad PRINCIPAL del catálogo. Recurso REST completo.
 *
 *   GET    /api/laureates?page&limit&q&category&country&gender&year&sort
 *   GET    /api/laureates/:id|:slug
 *   POST   /api/laureates            (requiere Bearer)
 *   PUT    /api/laureates/:id        (requiere Bearer)
 *   DELETE /api/laureates/:id        (requiere rol admin)
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
import { uniqueSlug } from '../../lib/slug.mjs'
import {
  LOOKUP_CATEGORY,
  LOOKUP_COUNTRY,
  paginate,
  findByIdOrKey,
  notFound,
  conflict,
  isDuplicateKey,
} from '../../lib/resource.mjs'

const GENDERS = ['male', 'female', 'org']

const SCHEMA = {
  laureate: { type: 'string', required: true, minLength: 2, maxLength: 120 },
  gender: { type: 'enum', required: true, values: GENDERS },
  year: { type: 'number', required: true, integer: true, min: 1901, max: 2100 },
  categoryId: { type: 'id', required: true },
  countryId: { type: 'id' },
  motivation: { type: 'string', maxLength: 1000 },
  affiliation: { type: 'string', maxLength: 220 },
  birthDate: { type: 'date' },
  birthPlace: { type: 'string', maxLength: 200 },
  birthCountryRaw: { type: 'string', maxLength: 120 },
  deathDate: { type: 'date' },
  portraitUrl: { type: 'string', maxLength: 400 },
}

const SORTS = {
  'year-desc': { year: -1, laureate: 1 },
  'year-asc': { year: 1, laureate: 1 },
  'name-asc': { laureate: 1 },
  'name-desc': { laureate: -1 },
  recent: { updatedAt: -1, _id: -1 },
}

const OPCIONALES = [
  'countryId',
  'motivation',
  'affiliation',
  'birthDate',
  'birthPlace',
  'birthCountryRaw',
  'deathDate',
]

/** Verifica que las referencias enviadas existan (integridad referencial). */
async function resolveReferences(db, values, errors = {}) {
  let categoria = null
  let pais = null

  if (values.categoryId) {
    categoria = await db.collection(COLLECTIONS.categories).findOne({ _id: toObjectId(values.categoryId) })
    if (!categoria) errors.categoryId = 'La categoría indicada no existe.'
  }

  if (values.countryId) {
    pais = await db.collection(COLLECTIONS.countries).findOne({ _id: toObjectId(values.countryId) })
    if (!pais) errors.countryId = 'El país indicado no existe.'
  }

  if (Object.keys(errors).length > 0) {
    throw new HttpError(422, 'validation_error', 'Revisa los campos marcados.', errors)
  }

  return { categoria, pais }
}

/** URL del retrato generado: SVG con iniciales y el color de la categoría. */
function portraitFor(laureate, categoria) {
  const color = String(categoria?.color || '#c9a227').replace('#', '')
  return `/api/images/laureate.svg?n=${encodeURIComponent(laureate)}&c=${color}`
}

/** Construye el filtro de MongoDB a partir de los parámetros de la URL. */
async function buildMatch(db, url) {
  const match = {}

  const texto = (url.searchParams.get('q') || '').trim()
  if (texto) {
    const rx = new RegExp(escapeRegex(texto), 'i')
    match.$or = [
      { laureate: rx },
      { motivation: rx },
      { affiliation: rx },
      { birthPlace: rx },
      { birthCountryRaw: rx },
    ]
  }

  const gender = url.searchParams.get('gender')
  if (gender && GENDERS.includes(gender)) match.gender = gender

  const year = Number(url.searchParams.get('year'))
  if (Number.isInteger(year) && year > 0) match.year = year

  const category = url.searchParams.get('category')
  if (category && category !== 'todas' && category !== 'all') {
    const doc = await findByIdOrKey(db.collection(COLLECTIONS.categories), category, 'key')
    if (!doc) return { match, empty: true }
    match.categoryId = doc._id
  }

  const country = url.searchParams.get('country')
  if (country && country !== 'todos' && country !== 'all') {
    const doc = await findByIdOrKey(db.collection(COLLECTIONS.countries), country, 'code')
    if (!doc) return { match, empty: true }
    match.countryId = doc._id
  }

  return { match, empty: false }
}

export default api(async (req) => {
  const { url, params } = routeParams(req, 'laureates')
  const db = await getDb()
  const laureates = db.collection(COLLECTIONS.laureates)
  const identificador = params[0]

  // -------------------------------------------------------------- colección
  if (!identificador) {
    if (req.method === 'GET') {
      const page = intParam(url, 'page', 1, { min: 1 })
      const limit = intParam(url, 'limit', 12, { min: 1, max: 100 })
      const sort = SORTS[url.searchParams.get('sort')] || SORTS['year-desc']

      const { match, empty } = await buildMatch(db, url)
      if (empty) {
        return json({ data: [], meta: { page, limit, total: 0, pages: 1 } })
      }

      const { rows, total, pages } = await paginate({
        collection: laureates,
        match,
        sort,
        lookups: [...LOOKUP_CATEGORY, ...LOOKUP_COUNTRY],
        page,
        limit,
      })

      return json({
        data: rows,
        meta: {
          page,
          limit,
          total,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1,
          sort: url.searchParams.get('sort') || 'year-desc',
        },
      })
    }

    requireMethod(req, 'POST')
    const claims = requireAuth(req)
    const body = await readJsonBody(req)
    const values = validate(body, SCHEMA)
    const { categoria } = await resolveReferences(db, values)

    const now = new Date()
    const doc = {
      ...values,
      categoryId: toObjectId(values.categoryId),
      countryId: values.countryId ? toObjectId(values.countryId) : null,
      portraitUrl: values.portraitUrl || portraitFor(values.laureate, categoria),
      slug: await uniqueSlug(laureates, `${values.laureate} ${values.year}`),
      createdAt: now,
      updatedAt: now,
      createdBy: claims.email,
    }

    for (const campo of OPCIONALES) {
      if (doc[campo] === undefined) doc[campo] = null
    }

    try {
      const { insertedId } = await laureates.insertOne(doc)
      doc._id = insertedId
    } catch (error) {
      if (isDuplicateKey(error)) throw conflict('Ya existe un galardonado con esos datos.')
      throw error
    }

    const [creado] = await laureates
      .aggregate([{ $match: { _id: doc._id } }, ...LOOKUP_CATEGORY, ...LOOKUP_COUNTRY])
      .toArray()

    return json({ data: serialize(creado), message: 'Galardonado creado correctamente.' }, 201)
  }

  // --------------------------------------------------------------- elemento
  const doc = await findByIdOrKey(laureates, identificador, 'slug')
  if (!doc) throw notFound('Galardonado')

  if (req.method === 'GET') {
    const [completo] = await laureates
      .aggregate([{ $match: { _id: doc._id } }, ...LOOKUP_CATEGORY, ...LOOKUP_COUNTRY])
      .toArray()
    return json({ data: serialize(completo) })
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    requireAuth(req)
    const body = await readJsonBody(req)
    const values = validate(body, SCHEMA)
    const { categoria } = await resolveReferences(db, values)

    const update = {
      ...values,
      categoryId: toObjectId(values.categoryId),
      countryId: values.countryId ? toObjectId(values.countryId) : null,
      updatedAt: new Date(),
    }

    // El slug se recalcula solo si cambia el nombre o el año.
    if (values.laureate !== doc.laureate || values.year !== doc.year) {
      update.slug = await uniqueSlug(laureates, `${values.laureate} ${values.year}`, 'slug', {
        _id: { $ne: doc._id },
      })
    }

    // El retrato solo se sustituye si llega explícitamente; si cambia el nombre
    // se regenera para que las iniciales sigan coincidiendo.
    if (!('portraitUrl' in values)) {
      delete update.portraitUrl
      if (values.laureate !== doc.laureate) {
        update.portraitUrl = portraitFor(values.laureate, categoria)
      }
    }

    // Los campos opcionales ausentes se vacían (reemplazo completo del recurso).
    for (const campo of OPCIONALES) {
      if (update[campo] === undefined) update[campo] = null
    }

    await laureates.updateOne({ _id: doc._id }, { $set: update })

    const [actualizado] = await laureates
      .aggregate([{ $match: { _id: doc._id } }, ...LOOKUP_CATEGORY, ...LOOKUP_COUNTRY])
      .toArray()

    return json({ data: serialize(actualizado), message: 'Galardonado actualizado correctamente.' })
  }

  if (req.method === 'DELETE') {
    requireAuth(req, { roles: ['admin'] })
    await laureates.deleteOne({ _id: doc._id })
    return json({ message: 'Galardonado eliminado correctamente.', id: String(doc._id) })
  }

  requireMethod(req, ['GET', 'PUT', 'PATCH', 'DELETE'])
})
