/**
 * scripts/test-api.mjs
 * --------------------
 * Pruebas de integración de la API REST contra un MongoDB efímero.
 * No requiere credenciales reales ni desplegar en Netlify.
 *
 *   npm install --no-save mongodb-memory-server
 *   node scripts/test-api.mjs
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { COUNTRIES } from './data/countries.mjs'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const SEED = fileURLToPath(new URL('./seed.mjs', import.meta.url))

process.env.JWT_SECRET ||= 'secreto-de-pruebas-suficientemente-largo-123456'
process.env.MONGODB_DB = 'nobel_test'
process.env.SEED_ADMIN_EMAIL = 'admin@test.local'
process.env.SEED_ADMIN_PASSWORD = 'Nobel2026!'

const { MongoMemoryServer } = await import('mongodb-memory-server')

let pasadas = 0
const fallidas = []

function check(nombre, condicion, detalle = '') {
  if (condicion) {
    pasadas += 1
    console.log(`  ✔ ${nombre}`)
  } else {
    fallidas.push(nombre)
    console.log(`  ✖ ${nombre}${detalle ? ` → ${detalle}` : ''}`)
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function call(funcion, method, path, { body, token } = {}) {
  const { default: handler } = await import(`../netlify/functions/${funcion}.mjs`)
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`

  const req = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const res = await handler(req, {})
  const text = await res.text()
  return { status: res.status, body: safeJson(text), text }
}

const mongod = await MongoMemoryServer.create()
const uri = mongod.getUri('nobel_test')
process.env.MONGODB_URI = uri

console.log(`\n▸ MongoDB de pruebas: ${uri}\n`)

try {
  console.log('▸ Ejecutando seed (40 galardonados)…')
  const salida = execFileSync(process.execPath, [SEED, '--limit', '40'], {
    cwd: RAIZ,
    env: process.env,
    encoding: 'utf8',
  })
  console.log(salida.split('\n').filter((l) => l.includes('▸') || l.includes('✔')).join('\n'))

  /* ------------------------------------------------------------- lectura -- */
  console.log('\n[1] Lectura pública')

  const stats = await call('stats', 'GET', '/api/stats')
  check('GET /api/stats responde 200', stats.status === 200, `status ${stats.status}`)
  check('stats.totals.laureates = 40', stats.body?.data?.totals?.laureates === 40, JSON.stringify(stats.body?.data?.totals))
  check('stats.totals.categories = 6', stats.body?.data?.totals?.categories === 6)
  check('stats.totals.countries = catálogo de países', stats.body?.data?.totals?.countries === COUNTRIES.length, `${stats.body?.data?.totals?.countries} vs ${COUNTRIES.length}`)
  check('stats.byCategory devuelve grupos', (stats.body?.data?.byCategory?.length || 0) >= 1)
  check('stats.byYear es ascendente', stats.body?.data?.byYear?.length > 0)

  const cats = await call('categories', 'GET', '/api/categories')
  check('GET /api/categories responde 200', cats.status === 200)
  check('categorías ordenadas por ordinal', cats.body?.data?.[0]?.key === 'physics', cats.body?.data?.[0]?.key)
  check('categorías incluyen laureateCount', typeof cats.body?.data?.[0]?.laureateCount === 'number')

  const catByKey = await call('categories', 'GET', '/api/categories/physics')
  check('GET /api/categories/physics responde 200', catByKey.status === 200)
  check('categoría tiene imagen', Boolean(catByKey.body?.data?.image))

  const countries = await call('countries', 'GET', '/api/countries?limit=100')
  check('GET /api/countries responde 200', countries.status === 200)
  check('países tienen bandera', String(countries.body?.data?.[0]?.flag).includes('flagcdn'))

  const lista = await call('laureates', 'GET', '/api/laureates?page=1&limit=5')
  check('GET /api/laureates responde 200', lista.status === 200)
  check('paginación devuelve 5 filas', lista.body?.data?.length === 5, `len ${lista.body?.data?.length}`)
  check('meta.total = 40', lista.body?.meta?.total === 40)
  check('meta.pages = 8', lista.body?.meta?.pages === 8)
  check('referencia category poblada', Boolean(lista.body?.data?.[0]?.category?.key))
  check(
    'referencia country poblada en algún registro',
    (lista.body?.data || []).some((r) => r.country && r.country.code),
    JSON.stringify((lista.body?.data || []).map((r) => r.country?.code)),
  )
  check('incluye la fecha de creación', Boolean(lista.body?.data?.[0]?.createdAt))

  const busqueda = await call('laureates', 'GET', '/api/laureates?q=curie&limit=50')
  check('búsqueda q=curie devuelve resultados', (busqueda.body?.data?.length || 0) > 0)

  const porCategoria = await call('laureates', 'GET', '/api/laureates?category=physics&limit=100')
  check(
    'filtro por categoría devuelve solo física',
    (porCategoria.body?.data || []).every((r) => r.category?.key === 'physics'),
  )

  const mujer = await call('laureates', 'GET', '/api/laureates?gender=female&limit=100')
  check('filtro por género funciona', (mujer.body?.data || []).every((r) => r.gender === 'female'))

  const todos = await call('laureates', 'GET', '/api/laureates?limit=100')
  const conPais = (todos.body?.data || []).find((r) => r.country && r.country.code)
  check('existe al menos un registro con país asignado', Boolean(conPais))

  if (conPais) {
    const detalle = await call('laureates', 'GET', `/api/laureates/${conPais.slug}`)
    check('GET por slug responde 200', detalle.status === 200, `status ${detalle.status}`)
    check('detalle incluye país', Boolean(detalle.body?.data?.country?.code))
  }

  const inexistente = await call('laureates', 'GET', '/api/laureates/000000000000000000000000')
  check('id inexplorado responde 404', inexistente.status === 404, `status ${inexistente.status}`)

  const svg = await call('images', 'GET', '/api/images/laureate.svg?n=Marie%20Curie&c=c9a227')
  check('retrato SVG responde 200', svg.status === 200)

  /* ------------------------------------------------------- autenticación -- */
  console.log('\n[2] Autenticación JWT')

  const sinToken = await call('laureates', 'POST', '/api/laureates', {
    body: { laureate: 'Prueba', gender: 'male', year: 2000 },
  })
  check('POST sin token responde 401', sinToken.status === 401, `status ${sinToken.status}`)

  const tokenFalso = await call('laureates', 'GET', '/api/laureates', { token: 'a.b.c' })
  check('token mal formado en GET público no rompe', tokenFalso.status === 200)

  const loginMal = await call('auth', 'POST', '/api/auth/login', {
    body: { email: 'admin@test.local', password: 'incorrecta' },
  })
  check('login con contraseña incorrecta responde 401', loginMal.status === 401, `status ${loginMal.status}`)

  const login = await call('auth', 'POST', '/api/auth/login', {
    body: { email: 'admin@test.local', password: 'Nobel2026!' },
  })
  check('login correcto responde 200', login.status === 200, `status ${login.status}`)
  check('login devuelve token', typeof login.body?.token === 'string')
  check('login devuelve rol admin', login.body?.user?.role === 'admin')
  check('login no expone el hash', login.body?.user?.passwordHash === undefined)

  const token = login.body?.token

  const me = await call('auth', 'GET', '/api/auth/me', { token })
  check('GET /api/auth/me responde 200', me.status === 200)
  check('/me devuelve el correo', me.body?.user?.email === 'admin@test.local')

  const registro = await call('auth', 'POST', '/api/auth/register', {
    body: { name: 'Editor de prueba', email: 'editor@test.local', password: 'Editor2026!' },
  })
  check('registro responde 201', registro.status === 201, `status ${registro.status}`)
  check('segundo usuario es editor', registro.body?.user?.role === 'editor')

  const registroDuplicado = await call('auth', 'POST', '/api/auth/register', {
    body: { name: 'Otro', email: 'editor@test.local', password: 'Editor2026!' },
  })
  check('registro duplicado responde 409', registroDuplicado.status === 409, `status ${registroDuplicado.status}`)

  const tokenEditor = registro.body?.token

  /* --------------------------------------------------------------- CRUD --- */
  console.log('\n[3] CRUD de la entidad principal')

  const catFisica = catByKey.body.data.id
  const primerPais = countries.body.data[0].code

  const invalido = await call('laureates', 'POST', '/api/laureates', {
    token,
    body: { laureate: 'X', gender: 'otro', year: 1800 },
  })
  check('POST inválido responde 422', invalido.status === 422, `status ${invalido.status}`)
  check('errores por campo en la respuesta', Boolean(invalido.body?.error?.details))

  const creado = await call('laureates', 'POST', '/api/laureates', {
    token,
    body: {
      laureate: 'Ada Lovelace Prueba',
      gender: 'female',
      year: 2045,
      categoryId: catFisica,
      countryId: countries.body.data[0].id,
      motivation: 'Registro creado por la prueba automática.',
      affiliation: 'Universidad de Prueba',
      birthCountryRaw: primerPais,
    },
  })
  check('POST con token responde 201', creado.status === 201, `status ${creado.status} ${creado.text?.slice(0, 120)}`)
  check('el registro creado tiene slug', typeof creado.body?.data?.slug === 'string')
  const nuevoId = creado.body?.data?.id

  const verificacion = await call('laureates', 'GET', `/api/laureates/${nuevoId}`)
  check('el registro creado se puede consultar', verificacion.status === 200)

  const actualizado = await call('laureates', 'PUT', `/api/laureates/${nuevoId}`, {
    token,
    body: {
      laureate: 'Ada Lovelace Prueba',
      gender: 'female',
      year: 2046,
      categoryId: catFisica,
      motivation: 'Motivación actualizada por la prueba.',
    },
  })
  check('PUT responde 200', actualizado.status === 200, `status ${actualizado.status}`)
  check('PUT actualiza el año', actualizado.body?.data?.year === 2046)
  check('PUT recalcula el slug', String(actualizado.body?.data?.slug).includes('2046'), actualizado.body?.data?.slug)

  const borradoEditor = await call('laureates', 'DELETE', `/api/laureates/${nuevoId}`, { token: tokenEditor })
  check('DELETE con rol editor responde 403', borradoEditor.status === 403, `status ${borradoEditor.status}`)

  const borradoAdmin = await call('laureates', 'DELETE', `/api/laureates/${nuevoId}`, { token })
  check('DELETE con rol admin responde 200', borradoAdmin.status === 200, `status ${borradoAdmin.status}`)

  const yaNoExiste = await call('laureates', 'GET', `/api/laureates/${nuevoId}`)
  check('el registro eliminado ya no existe', yaNoExiste.status === 404)

  /* ------------------------------------------------- entidades secundarias */
  console.log('\n[4] CRUD de categorías y países')

  const nuevaCat = await call('categories', 'POST', '/api/categories', {
    token,
    body: { key: 'prueba-cat', name: 'Prueba', ordinal: 9, color: '#123456', fullname: 'Categoría de prueba' },
  })
  check('POST /api/categories responde 201', nuevaCat.status === 201, `status ${nuevaCat.status}`)

  const catDuplicada = await call('categories', 'POST', '/api/categories', {
    token,
    body: { key: 'prueba-cat', name: 'Otra', ordinal: 10, color: '#654321' },
  })
  check('categoría duplicada responde 409', catDuplicada.status === 409, `status ${catDuplicada.status}`)

  const borrarEnUso = await call('categories', 'DELETE', '/api/categories/physics', { token })
  check('no se puede borrar una categoría en uso (409)', borrarEnUso.status === 409, `status ${borrarEnUso.status}`)

  const borrarLibre = await call('categories', 'DELETE', '/api/categories/prueba-cat', { token })
  check('se puede borrar una categoría sin uso', borrarLibre.status === 200, `status ${borrarLibre.status}`)

  const nuevoPais = await call('countries', 'POST', '/api/countries', {
    token,
    body: { code: 'ZZ', name: 'País de prueba', region: 'Europa', capital: 'Ninguna' },
  })
  check('POST /api/countries responde 201', nuevoPais.status === 201, `status ${nuevoPais.status}`)
  check('el país obtiene bandera automática', String(nuevoPais.body?.data?.flag).includes('flagcdn'))

  const paisDuplicado = await call('countries', 'POST', '/api/countries', {
    token,
    body: { code: 'ZZ', name: 'Otro país', region: 'Asia' },
  })
  check('país duplicado responde 409', paisDuplicado.status === 409, `status ${paisDuplicado.status}`)

  const borrarPaisLibre = await call('countries', 'DELETE', '/api/countries/ZZ', { token })
  check('se puede borrar un país sin uso', borrarPaisLibre.status === 200, `status ${borrarPaisLibre.status}`)

  /* ------------------------------------------------------------- métodos -- */
  console.log('\n[5] Comportamiento REST')

  const metodoInvalido = await call('laureates', 'POST', `/api/laureates/${lista.body.data[0].id}`, {
    token,
    body: {},
  })
  check('método no permitido en elemento responde 405', metodoInvalido.status === 405, `status ${metodoInvalido.status}`)

  const recolectar = await call('laureates', 'GET', '/api/laureates?limit=100&page=99')
  check('página fuera de rango devuelve lista vacía', (recolectar.body?.data || []).length === 0)
} catch (error) {
  console.error('\n✖ Error inesperado en las pruebas:', error)
  fallidas.push('excepción no controlada')
} finally {
  await mongod.stop()
}

console.log('\n──────────────────────────────────────────')
console.log(`Pruebas correctas: ${pasadas}`)
console.log(`Pruebas fallidas : ${fallidas.length}`)
if (fallidas.length) {
  console.log(`\nFallaron: ${fallidas.join(', ')}`)
  process.exitCode = 1
} else {
  console.log('\n✔ Todas las pruebas pasaron\n')
}
