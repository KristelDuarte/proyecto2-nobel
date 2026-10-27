/**
 * scripts/seed.mjs
 * ----------------
 * Carga el catálogo en MongoDB Atlas:
 *   - 6 categorías   (entidad secundaria)
 *   - 70 países      (entidad secundaria)
 *   - 1023 galardonados (entidad principal), con referencias a categoría y país
 *   - 1 usuario administrador inicial
 *
 * Uso:
 *   npm run seed                 # carga/actualiza todo
 *   npm run seed -- --reset      # vacía las colecciones antes de cargar
 *   npm run seed -- --limit 30   # solo los primeros 30 galardonados (pruebas)
 *   npm run seed -- --no-laureates
 */

import 'dotenv/config'

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

import { hashPassword } from '../lib/security.mjs'
import { slugify } from '../lib/slug.mjs'
import { COUNTRIES, COUNTRY_MAP } from './data/countries.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const args = process.argv.slice(2)
const RESET = args.includes('--reset')
const SIN_LAUREADOS = args.includes('--no-laureates')
const LIMIT = (() => {
  const i = args.indexOf('--limit')
  if (i === -1) return Infinity
  const value = Number.parseInt(args[i + 1], 10)
  return Number.isFinite(value) ? value : Infinity
})()

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('\n✖ Falta MONGODB_URI. Copia .env.example a .env y pega la cadena de conexión de Atlas.\n')
  process.exit(1)
}

const DB_NAME = process.env.MONGODB_DB || 'nobel'

/* ------------------------------------------------------------------ CSV ---- */

function parseCsv(text) {
  const rows = []
  let field = ''
  let row = []
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function leerLaureados() {
  const filas = parseCsv(readFileSync(join(ROOT, 'content', 'nobel.csv'), 'utf8'))
  const header = filas[0]
  const idx = Object.fromEntries(header.map((name, i) => [name, i]))

  return filas
    .slice(1)
    .filter((fila) => fila[0])
    .map((fila) => ({
      legacyId: Number(fila[idx.id]),
      laureate: fila[idx.laureate].trim(),
      gender: fila[idx.gender].trim() || 'org',
      year: Number(fila[idx.year]),
      categoryKey: fila[idx.category].trim(),
      motivation: fila[idx.motivation].trim(),
      affiliation: fila[idx.affiliation].trim(),
      birthDate: fila[idx.birth_date].trim(),
      birthPlace: fila[idx.birth_place].trim(),
      birthCountryRaw: fila[idx.birth_country].trim(),
      deathDate: fila[idx.death_date].trim(),
    }))
}

function leerCategorias() {
  const dir = join(ROOT, 'content', 'categories')
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')))
    .sort((a, b) => a.ordinal - b.ordinal)
}

/* ----------------------------------------------------------------- main ---- */

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 })

try {
  await client.connect()
  const db = client.db(DB_NAME)
  console.log(`\n▸ Conectado a MongoDB — base de datos: ${DB_NAME}\n`)

  const colCategories = db.collection('categories')
  const colCountries = db.collection('countries')
  const colLaureates = db.collection('laureates')
  const colUsers = db.collection('users')

  if (RESET) {
    for (const col of [colLaureates, colCategories, colCountries]) {
      await col.deleteMany({})
    }
    console.log('▸ Colecciones vaciadas (--reset)')
  }

  /* ---------------------------------------------------------- categorías -- */
  const categorias = leerCategorias()
  const idPorCategoriaKey = new Map()

  for (const cat of categorias) {
    const doc = {
      key: cat.key,
      name: cat.name,
      fullname: cat.fullname,
      ordinal: cat.ordinal,
      color: cat.color,
      icon: cat.icon,
      description: cat.description,
      image: `/api/images/category.svg?k=${encodeURIComponent(cat.key)}&c=${cat.color.replace('#', '')}`,
      updatedAt: new Date(),
    }

    const { upsertedId } = await colCategories.updateOne(
      { key: cat.key },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    )

    const id = upsertedId || (await colCategories.findOne({ key: cat.key }, { projection: { _id: 1 } }))._id
    idPorCategoriaKey.set(cat.key, id)
  }
  console.log(`▸ Categorías: ${categorias.length}`)

  /* -------------------------------------------------------------- países -- */
  const idPorCodigoPais = new Map()

  for (const pais of COUNTRIES) {
    const doc = {
      code: pais.code,
      name: pais.name,
      region: pais.region,
      capital: pais.capital,
      flag: `https://flagcdn.com/w320/${pais.code.toLowerCase()}.png`,
      updatedAt: new Date(),
    }

    const { upsertedId } = await colCountries.updateOne(
      { code: pais.code },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    )

    const id = upsertedId || (await colCountries.findOne({ code: pais.code }, { projection: { _id: 1 } }))._id
    idPorCodigoPais.set(pais.code, id)
  }
  console.log(`▸ Países: ${COUNTRIES.length}`)

  /* --------------------------------------------------------- galardonados -- */
  let insertados = 0
  let sinPais = 0

  if (!SIN_LAUREADOS) {
    const filas = leerLaureados().slice(0, LIMIT)
    const slugsUsados = new Set()

    // Slugs ya existentes (para no colisionar si se ejecuta el seed dos veces).
    for (const { slug } of await colLaureates.find({}, { projection: { slug: 1 } }).toArray()) {
      if (slug) slugsUsados.add(slug)
    }

    const operaciones = []

    for (const fila of filas) {
      const categoryId = idPorCategoriaKey.get(fila.categoryKey)
      if (!categoryId) {
        console.warn(`  ! categoría desconocida: ${fila.categoryKey} (${fila.laureate})`)
        continue
      }

      const codigoPais = COUNTRY_MAP[fila.birthCountryRaw] || null
      const countryId = codigoPais ? idPorCodigoPais.get(codigoPais) : null
      if (!countryId) sinPais += 1

      const base = `${slugify(fila.laureate)}-${fila.year}`
      let slug = base
      let n = 2
      while (slugsUsados.has(slug)) {
        slug = `${base}-${n}`
        n += 1
      }
      slugsUsados.add(slug)

      const color = categorias.find((c) => c.key === fila.categoryKey)?.color || '#c9a227'

      operaciones.push({
        updateOne: {
          filter: { legacyId: fila.legacyId },
          update: {
            $set: {
              legacyId: fila.legacyId,
              laureate: fila.laureate,
              slug,
              gender: fila.gender,
              year: fila.year,
              categoryId,
              countryId,
              motivation: fila.motivation || null,
              affiliation: fila.affiliation || null,
              birthDate: fila.birthDate || null,
              birthPlace: fila.birthPlace || null,
              birthCountryRaw: fila.birthCountryRaw || null,
              deathDate: fila.deathDate || null,
              portraitUrl: `/api/images/laureate.svg?n=${encodeURIComponent(fila.laureate)}&c=${color.replace('#', '')}`,
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          upsert: true,
        },
      })
    }

    if (operaciones.length) {
      const result = await colLaureates.bulkWrite(operaciones, { ordered: false })
      insertados = (result.upsertedCount || 0) + (result.modifiedCount || 0)
    }
  }
  console.log(`▸ Galardonados procesados: ${insertados}${sinPais ? ` (sin país asignado: ${sinPais})` : ''}`)

  /* --------------------------------------------------------------- índices -- */
  await colUsers.createIndex({ email: 1 }, { unique: true })
  await colCategories.createIndex({ key: 1 }, { unique: true })
  await colCategories.createIndex({ ordinal: 1 })
  await colCountries.createIndex({ code: 1 }, { unique: true })
  await colCountries.createIndex({ name: 1 }, { unique: true })
  await colLaureates.createIndex({ slug: 1 }, { unique: true })
  await colLaureates.createIndex({ legacyId: 1 })
  await colLaureates.createIndex({ year: -1 })
  await colLaureates.createIndex({ categoryId: 1 })
  await colLaureates.createIndex({ countryId: 1 })
  await colLaureates.createIndex({ laureate: 'text', motivation: 'text', affiliation: 'text' })
  console.log('▸ Índices creados/verificados')

  /* ------------------------------------------------------ usuario inicial -- */
  const totalUsuarios = await colUsers.countDocuments()
  if (totalUsuarios === 0) {
    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@catalogo-nobel.test').toLowerCase()
    const password = process.env.SEED_ADMIN_PASSWORD || 'Nobel2026!'

    await colUsers.insertOne({
      name: 'Administrador del catálogo',
      email,
      passwordHash: hashPassword(password),
      role: 'admin',
      createdAt: new Date(),
    })

    console.log('\n┌───────────────────────────────────────────────┐')
    console.log('│  Usuario administrador creado                 │')
    console.log('└───────────────────────────────────────────────┘')
    console.log(`   Correo:     ${email}`)
    console.log(`   Contraseña: ${password}`)
    console.log('   (cámbiala en .env con SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)\n')
  } else {
    console.log(`▸ Usuarios existentes: ${totalUsuarios} (no se creó ninguno nuevo)`)
  }

  /* ---------------------------------------------------------------- conteo -- */
  const [nLaureados, nCategorias, nPaises] = await Promise.all([
    colLaureates.countDocuments(),
    colCategories.countDocuments(),
    colCountries.countDocuments(),
  ])

  console.log('\n✔ Resumen en la base de datos')
  console.log(`   laureates  : ${nLaureados}`)
  console.log(`   categories : ${nCategorias}`)
  console.log(`   countries  : ${nPaises}`)
  console.log('')
} catch (error) {
  console.error('\n✖ Error durante el seed:', error.message)
  process.exitCode = 1
} finally {
  await client.close()
}
