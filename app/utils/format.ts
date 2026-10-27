/**
 * app/utils/format.ts
 * -------------------
 * Formateadores compartidos por las vistas.
 */

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** "1903-12-07" → "7 de diciembre de 1903" */
export function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const [year, month, day] = String(iso).split('-').map(Number)
  if (!year) return ''
  if (!month || !day) return String(year)
  return `${day} de ${MESES[month - 1]} de ${year}`
}

export function genderLabel(gender?: string | null): string {
  if (gender === 'female') return 'Mujer'
  if (gender === 'org') return 'Organización'
  return 'Hombre'
}

export function initials(name?: string | null): string {
  const parts = String(name || '')
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function lifeSpan(birth?: string | null, death?: string | null): string {
  const from = birth ? String(birth).slice(0, 4) : ''
  const to = death ? String(death).slice(0, 4) : ''
  if (from && to) return `${from} – ${to}`
  return from ? `Nacido en ${from}` : ''
}

export function numberEs(value?: number | null): string {
  return Number(value || 0).toLocaleString('es')
}
