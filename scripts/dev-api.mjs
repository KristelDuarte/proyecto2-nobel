/**
 * scripts/dev-api.mjs
 * -------------------
 * Servidor local que emula el enrutamiento de Netlify Functions para poder
 * probar la API REST sin desplegar:
 *
 *   npm run dev:api      → http://127.0.0.1:8787/api/...
 *
 * El servidor de Nuxt (`npm run dev`) reenvía /api a este proceso mediante
 * `nitro.devProxy`, así que el frontend funciona exactamente igual que en
 * producción.
 *
 * Requiere un archivo `.env` con MONGODB_URI y JWT_SECRET.
 */

import 'dotenv/config'

import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.API_PORT || 8787)
const FUNCIONES = new Set(['auth', 'laureates', 'categories', 'countries', 'stats', 'images'])
const DIR_FUNCIONES = new URL('../netlify/functions/', import.meta.url)

const INDICE = {
  name: 'Catálogo Nobel — API REST (entorno local)',
  version: '1.0.0',
  endpoints: {
    auth: ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me'],
    laureates: [
      'GET /api/laureates?page&limit&q&category&country&gender&year&sort',
      'GET /api/laureates/:id|:slug',
      'POST /api/laureates',
      'PUT /api/laureates/:id',
      'DELETE /api/laureates/:id',
    ],
    categories: ['GET /api/categories', 'GET /api/categories/:key', 'POST', 'PUT', 'DELETE'],
    countries: ['GET /api/countries', 'GET /api/countries/:code', 'POST', 'PUT', 'DELETE'],
    stats: ['GET /api/stats'],
    images: ['GET /api/images/laureate.svg?n=...&c=...', 'GET /api/images/category.svg?k=...&c=...'],
  },
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    const trozos = []
    req.on('data', (chunk) => trozos.push(chunk))
    req.on('end', () => resolve(Buffer.concat(trozos)))
    req.on('error', reject)
  })
}

function cabeceras(headers) {
  const out = new Headers()
  for (const [clave, valor] of Object.entries(headers)) {
    if (typeof valor === 'string') out.set(clave, valor)
  }
  return out
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${PORT}`}`)
  const partes = url.pathname.split('/').filter(Boolean)

  const responderJson = (status, payload) => {
    const cuerpo = JSON.stringify(payload, null, 2)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    })
    res.end(cuerpo)
  }

  if (partes[0] !== 'api') {
    return responderJson(404, { error: { code: 'not_found', message: 'Ruta fuera de /api.' } })
  }

  const nombre = partes[1]
  if (!nombre) return responderJson(200, INDICE)

  if (!FUNCIONES.has(nombre)) {
    return responderJson(404, {
      error: {
        code: 'unknown_function',
        message: `No existe /api/${nombre}. Disponibles: ${[...FUNCIONES].join(', ')}.`,
      },
    })
  }

  try {
    const cuerpo = await leerCuerpo(req)
    const destino = fileURLToPath(new URL(`${nombre}.mjs`, DIR_FUNCIONES))
    const { default: handler } = await import(`file://${destino}`)

    const request = new Request(url.toString(), {
      method: req.method,
      headers: cabeceras(req.headers),
      body: ['GET', 'HEAD'].includes(req.method) || cuerpo.length === 0 ? undefined : cuerpo,
    })

    const response = await handler(request, {})
    const buffer = Buffer.from(await response.arrayBuffer())

    const headers = {}
    response.headers.forEach((valor, clave) => {
      headers[clave] = valor
    })

    res.writeHead(response.status, headers)
    res.end(buffer.length ? buffer : undefined)
  } catch (error) {
    console.error(`[dev-api] ${req.method} ${url.pathname} →`, error)
    responderJson(500, {
      error: { code: 'internal_error', message: error.message || 'Error interno' },
    })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n▸ API local disponible en http://127.0.0.1:${PORT}/api`)
  console.log('  (Ctrl+C para detener)\n')
})
