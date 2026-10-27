/**
 * app/composables/useApi.ts
 * -------------------------
 * Cliente HTTP para consumir la API REST (Netlify Functions).
 *
 * Centraliza: URL base, encabezado Authorization, manejo de errores con
 * status/código/detalles por campo y la forma de la respuesta.
 */

import { readToken } from '~/utils/session'

export interface ListMeta {
  page: number
  limit: number
  total: number
  pages: number
  hasNext?: boolean
  hasPrev?: boolean
}

export interface ListResponse<T> {
  data: T[]
  meta: ListMeta
}

export class ApiRequestError extends Error {
  status: number
  code: string
  details: Record<string, string> | null

  constructor(status: number, code: string, message: string, details: Record<string, string> | null = null) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function apiBase(): string {
  const config = useRuntimeConfig()
  return String((config.public.apiBase as string) || '/api').replace(/\/+$/, '')
}

function withQuery(path: string, params?: Record<string, unknown>): string {
  if (!params) return path
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.append(key, String(value))
  }
  const qs = search.toString()
  if (!qs) return path
  return path.includes('?') ? `${path}&${qs}` : `${path}?${qs}`
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: Record<string, unknown>
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options
  const url = `${apiBase()}${withQuery(path, params)}`

  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = readToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiRequestError(0, 'network_error', 'No se pudo contactar con la API. Revisa tu conexión.')
  }

  const text = await response.text()
  let payload: any = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const error = payload?.error ?? {}
    throw new ApiRequestError(
      response.status,
      error.code || 'http_error',
      error.message || `La petición falló con el código ${response.status}.`,
      error.details ?? null,
    )
  }

  return (payload ?? null) as T
}

/* ------------------------------------------------------------------ atajos -- */

export function listResource<T>(resource: string, params?: Record<string, unknown>) {
  return apiFetch<ListResponse<T>>(`/${resource}`, { params })
}

export function getResource<T>(resource: string, id: string) {
  return apiFetch<{ data: T }>(`/${resource}/${encodeURIComponent(id)}`)
}

export function createResource<T>(resource: string, body: unknown) {
  return apiFetch<{ data: T; message?: string }>(`/${resource}`, { method: 'POST', body })
}

export function updateResource<T>(resource: string, id: string, body: unknown) {
  return apiFetch<{ data: T; message?: string }>(`/${resource}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
  })
}

export function deleteResource(resource: string, id: string) {
  return apiFetch<{ message?: string }>(`/${resource}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
