/**
 * netlify/functions/images.mjs
 * ----------------------------
 * Genera retratos y emblemas en SVG para los documentos que no tienen una
 * imagen propia ("imágenes de las entidades").
 *
 *   GET /api/images/laureate.svg?n=Marie%20Curie&c=c9a227
 *   GET /api/images/category.svg?k=physics&c=1f6feb
 */

import { api, routeParams } from '../../lib/http.mjs'

const SVG_HEADERS = {
  'content-type': 'image/svg+xml; charset=utf-8',
  'cache-control': 'public, max-age=86400, s-maxage=604800',
  'access-control-allow-origin': '*',
}

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function hex(value, fallback = 'c9a227') {
  const clean = String(value || '').replace('#', '')
  return /^[0-9a-fA-F]{6}$/.test(clean) ? clean : fallback
}

/** Oscurece un color hexadecimal para el degradado del fondo. */
function shade(hexColor, factor = 0.55) {
  const n = Number.parseInt(hexColor, 16)
  const r = Math.round(((n >> 16) & 255) * factor)
  const g = Math.round(((n >> 8) & 255) * factor)
  const b = Math.round((n & 255) * factor)
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

function initialsFrom(name) {
  const parts = String(name || '?')
    .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function svg({ label, color, size = 480 }) {
  const fondo = `#${hex(color)}`
  const oscuro = shade(hex(color))
  const texto = esc(label)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${texto}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${fondo}"/>
      <stop offset="100%" stop-color="${oscuro}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.36}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.43}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="${size * 0.32}"
        fill="rgba(255,255,255,.95)" letter-spacing="2">${texto}</text>
</svg>`
}

export default api(async (req) => {
  const { url, params } = routeParams(req, 'images')
  const tipo = String(params[0] || '').replace(/\.svg$/i, '')

  if (tipo === 'laureate') {
    const nombre = url.searchParams.get('n') || 'Galardonado'
    return new Response(svg({ label: initialsFrom(nombre), color: url.searchParams.get('c') }), {
      status: 200,
      headers: SVG_HEADERS,
    })
  }

  if (tipo === 'category') {
    const clave = url.searchParams.get('k') || 'N'
    const label = clave.slice(0, 3).toUpperCase()
    return new Response(svg({ label, color: url.searchParams.get('c') }), {
      status: 200,
      headers: SVG_HEADERS,
    })
  }

  return new Response(svg({ label: '?' }), { status: 200, headers: SVG_HEADERS })
})
