/**
 * netlify/functions/stats.mjs
 * ---------------------------
 * Estadísticas agregadas (usadas por la portada y la vista "por año").
 *
 *   GET /api/stats
 */

import { api, json } from '../../lib/http.mjs'
import { getDb, COLLECTIONS } from '../../lib/db.mjs'

export default api(async (req) => {
  if (req.method !== 'GET') {
    return json(
      { error: { code: 'method_not_allowed', message: 'Método no permitido. Use GET.' } },
      405,
    )
  }

  const db = await getDb()
  const laureates = db.collection(COLLECTIONS.laureates)

  const [totales, porCategoria, porAnio, porGenero, porPais, rango] = await Promise.all([
    Promise.all([
      laureates.countDocuments(),
      db.collection(COLLECTIONS.categories).countDocuments(),
      db.collection(COLLECTIONS.countries).countDocuments(),
      db.collection(COLLECTIONS.users).countDocuments(),
    ]),

    laureates
      .aggregate([
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
        { $unwind: '$cat' },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            key: '$cat.key',
            name: '$cat.name',
            color: '$cat.color',
            icon: '$cat.icon',
            count: 1,
          },
        },
        { $sort: { count: -1, name: 1 } },
      ])
      .toArray(),

    laureates
      .aggregate([
        { $group: { _id: '$year', count: { $sum: 1 } } },
        { $project: { _id: 0, year: '$_id', count: 1 } },
        { $sort: { year: 1 } },
      ])
      .toArray(),

    laureates
      .aggregate([
        { $group: { _id: '$gender', count: { $sum: 1 } } },
        { $project: { _id: 0, gender: '$_id', count: 1 } },
        { $sort: { count: -1 } },
      ])
      .toArray(),

    laureates
      .aggregate([
        { $match: { countryId: { $ne: null } } },
        { $group: { _id: '$countryId', count: { $sum: 1 } } },
        { $lookup: { from: 'countries', localField: '_id', foreignField: '_id', as: 'p' } },
        { $unwind: '$p' },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            code: '$p.code',
            name: '$p.name',
            flag: '$p.flag',
            count: 1,
          },
        },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ])
      .toArray(),

    laureates
      .aggregate([
        { $group: { _id: null, min: { $min: '$year' }, max: { $max: '$year' }, total: { $sum: 1 } } },
      ])
      .toArray(),
  ])

  const [totalLaureados, totalCategorias, totalPaises, totalUsuarios] = totales
  const { min, max } = rango[0] || {}

  return json({
    data: {
      totals: {
        laureates: totalLaureados,
        categories: totalCategorias,
        countries: totalPaises,
        users: totalUsuarios,
        years: porAnio.length,
      },
      range: { firstYear: min ?? null, lastYear: max ?? null },
      byCategory: porCategoria,
      byYear: porAnio,
      byGender: porGenero,
      topCountries: porPais,
    },
  })
})
