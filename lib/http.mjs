/**
 * lib/http.mjs
 * ------------
 * Utilidades HTTP compartidas por todas las Netlify Functions (API v2: Request/Response).
 */

export class HttpError extends Error {
  constructor(status, code, message, details = null) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

export function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...BASE_HEADERS, ...extraHeaders },
  })
}

export function sendError(error) {
  if (error instanceof HttpError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      error.status,
    )
  }
  console.error('[api] error inesperado:', error)
  return json(
    { error: { code: 'internal_error', message: 'Ocurrió un error inesperado en el servidor.' } },
    500,
  )
}

/**
 * Envuelve un handler para: responder al preflight CORS y traducir errores a JSON.
 * @param {(req: Request, ctx: any) => Promise<Response>} handler
 */
export function api(handler) {
  return async (req, ctx) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: BASE_HEADERS })
    }
    try {
      return await handler(req, ctx)
    } catch (error) {
      return sendError(error)
    }
  }
}

/**
 * Devuelve la URL y los segmentos de ruta que siguen al nombre de la función.
 * Funciona tanto con la URL original (/api/laureates/981) como con la reescrita
 * por Netlify (/.netlify/functions/laureates/981).
 *
 * @param {Request} req
 * @param {string} functionName
 * @returns {{ url: URL, params: string[] }}
 */
export function routeParams(req, functionName) {
  const url = new URL(req.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const index = parts.lastIndexOf(functionName)
  const params = index === -1 ? [] : parts.slice(index + 1)
  return { url, params }
}

export async function readJsonBody(req) {
  const raw = await req.text()
  if (!raw || !raw.trim()) {
    throw new HttpError(400, 'empty_body', 'El cuerpo de la petición está vacío.')
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    return parsed
  } catch {
    throw new HttpError(400, 'invalid_json', 'El cuerpo debe ser un objeto JSON válido.')
  }
}

export function requireMethod(req, allowed) {
  const list = Array.isArray(allowed) ? allowed : [allowed]
  if (!list.includes(req.method)) {
    throw new HttpError(
      405,
      'method_not_allowed',
      `Método ${req.method} no permitido. Use: ${list.join(', ')}.`,
    )
  }
}

/** Convierte un string de query en entero dentro de un rango. */
export function intParam(url, name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = url.searchParams.get(name)
  if (raw === null || raw === '') return fallback
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(value, min), max)
}

/** Escapa un texto para usarlo dentro de una expresión regular. */
export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
