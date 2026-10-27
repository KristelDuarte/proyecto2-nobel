/**
 * lib/slug.mjs
 * ------------
 * Generación de identificadores legibles para las URL (por ejemplo
 * `marie-curie-1903`) y garantía de unicidad dentro de una colección.
 */

const REEMPLAZOS = {
  ł: 'l',
  ø: 'o',
  đ: 'd',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  þ: 'th',
  ð: 'd',
}

/**
 * Convierte un texto en un slug ASCII en minúsculas.
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[łøđßæœþð]/g, (ch) => REEMPLAZOS[ch] ?? '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
}

/**
 * Devuelve un slug único dentro de la colección.
 * @param {import('mongodb').Collection} collection
 * @param {string} base
 * @param {string} [field]
 * @param {object} [extraFilter] filtro adicional (por ejemplo excluir el propio documento)
 */
export async function uniqueSlug(collection, base, field = 'slug', extraFilter = {}) {
  const root = slugify(base) || 'registro'
  let candidate = root

  for (let intento = 2; intento <= 50; intento += 1) {
    const existe = await collection.findOne(
      { [field]: candidate, ...extraFilter },
      { projection: { _id: 1 } },
    )
    if (!existe) return candidate
    candidate = `${root}-${intento}`
  }

  return `${root}-${Date.now().toString(36)}`
}
