/**
 * lib/validate.mjs
 * ----------------
 * Validador declarativo muy pequeño (sin dependencias) para los cuerpos JSON
 * de las peticiones POST/PUT.
 */

import { HttpError } from './http.mjs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ISO2_RE = /^[A-Z]{2}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function asString(value) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

/**
 * Valida `body` contra `schema`.
 *
 * Reglas soportadas:
 *   { type: 'string', required, maxLength, minLength, pattern, patternMessage }
 *   { type: 'number', required, min, max, integer }
 *   { type: 'enum',   required, values: [...] }
 *   { type: 'date',   required }              // YYYY-MM-DD
 *   { type: 'email',  required }
 *   { type: 'hexcolor', required }
 *   { type: 'slug',   required }
 *   { type: 'iso2',   required }
 *   { type: 'id',     required }              // ObjectId en hex
 *
 * Los campos no declarados en el esquema se descartan (evita mass-assignment).
 *
 * @returns {{ values: Record<string, any>, errors: Record<string,string> }}
 */
export function validate(body, schema) {
  const values = {}
  const errors = {}

  if (!isPlainObject(body)) {
    throw new HttpError(400, 'invalid_body', 'El cuerpo debe ser un objeto JSON.')
  }

  for (const [field, rule] of Object.entries(schema)) {
    const raw = body[field]
    const missing = raw === undefined || raw === null || raw === ''

    if (missing) {
      if (rule.required) errors[field] = 'Este campo es obligatorio.'
      else if (rule.default !== undefined) values[field] = rule.default
      continue
    }

    switch (rule.type) {
      case 'string': {
        const value = asString(raw)
        if (value === null) {
          errors[field] = 'Debe ser un texto.'
          break
        }
        if (rule.minLength && value.length < rule.minLength) {
          errors[field] = `Debe tener al menos ${rule.minLength} caracteres.`
          break
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors[field] = `No puede superar ${rule.maxLength} caracteres.`
          break
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors[field] = rule.patternMessage || 'El formato no es válido.'
          break
        }
        values[field] = value
        break
      }

      case 'number': {
        const value = typeof raw === 'number' ? raw : Number(asString(raw))
        if (!Number.isFinite(value)) {
          errors[field] = 'Debe ser un número.'
          break
        }
        if (rule.integer && !Number.isInteger(value)) {
          errors[field] = 'Debe ser un número entero.'
          break
        }
        if (rule.min !== undefined && value < rule.min) {
          errors[field] = `Debe ser mayor o igual a ${rule.min}.`
          break
        }
        if (rule.max !== undefined && value > rule.max) {
          errors[field] = `Debe ser menor o igual a ${rule.max}.`
          break
        }
        values[field] = value
        break
      }

      case 'enum': {
        const value = asString(raw)
        if (!value || !rule.values.includes(value)) {
          errors[field] = `Debe ser uno de: ${rule.values.join(', ')}.`
          break
        }
        values[field] = value
        break
      }

      case 'date': {
        const value = asString(raw)
        if (!value || !DATE_RE.test(value) || Number.isNaN(Date.parse(value))) {
          errors[field] = 'Use el formato AAAA-MM-DD.'
          break
        }
        values[field] = value
        break
      }

      case 'email': {
        const value = asString(raw)
        if (!value || !EMAIL_RE.test(value)) {
          errors[field] = 'Introduce un correo electrónico válido.'
          break
        }
        values[field] = value.toLowerCase()
        break
      }

      case 'hexcolor': {
        const value = asString(raw)
        if (!value || !HEX_COLOR_RE.test(value)) {
          errors[field] = 'Usa un color hexadecimal, por ejemplo #1f6feb.'
          break
        }
        values[field] = value.toLowerCase()
        break
      }

      case 'slug': {
        const value = asString(raw)?.toLowerCase()
        if (!value || !SLUG_RE.test(value)) {
          errors[field] = 'Usa minúsculas, números y guiones (ej.: economic-sciences).'
          break
        }
        values[field] = value
        break
      }

      case 'iso2': {
        const value = asString(raw)?.toUpperCase()
        if (!value || !ISO2_RE.test(value)) {
          errors[field] = 'Usa el código ISO de dos letras (ej.: GT).'
          break
        }
        values[field] = value
        break
      }

      case 'id': {
        const value = asString(raw)
        if (!value || !/^[a-f0-9]{24}$/i.test(value)) {
          errors[field] = 'El identificador no es válido.'
          break
        }
        values[field] = value
        break
      }

      default:
        values[field] = raw
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new HttpError(422, 'validation_error', 'Revisa los campos marcados.', errors)
  }

  return values
}

export { EMAIL_RE, HEX_COLOR_RE, SLUG_RE, ISO2_RE, DATE_RE }
