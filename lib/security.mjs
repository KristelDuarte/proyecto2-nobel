/**
 * lib/security.mjs
 * ----------------
 * Implementación propia de JWT (HS256) y de hashing de contraseñas (scrypt),
 * sin dependencias externas, usando únicamente el módulo `node:crypto`.
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_SECONDS = 60 * 60 * 8 // 8 horas

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('Falta la variable de entorno JWT_SECRET (mínimo 16 caracteres).')
  }
  return secret
}

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function hmac(data, secret) {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Firma un JWT HS256.
 * @param {{ sub: string, email: string, name?: string, role?: string }} claims
 * @param {number} ttlSeconds
 */
export function signToken(claims, ttlSeconds = TOKEN_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    ...claims,
    iat: now,
    exp: now + ttlSeconds,
    iss: 'catalogo-nobel',
  }

  const head = base64url(JSON.stringify(header))
  const body = base64url(JSON.stringify(payload))
  const signature = hmac(`${head}.${body}`, getJwtSecret())

  return `${head}.${body}.${signature}`
}

/**
 * Verifica firma y expiración del token.
 * @param {string} token
 * @returns {{ sub: string, email: string, name?: string, role: string, iat: number, exp: number }}
 */
export function verifyToken(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) {
    throw new Error('Token mal formado')
  }
  const [head, body, signature] = parts

  const expected = hmac(`${head}.${body}`, getJwtSecret())
  if (!safeEqual(signature, expected)) {
    throw new Error('Firma del token inválida')
  }

  let payload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Contenido del token inválido')
  }

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw new Error('Token expirado')
  }

  return payload
}

const SCRYPT_KEYLEN = 64

/** Deriva la contraseña con scrypt y devuelve `scrypt$<salt>$<hash>`. */
export function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(String(password), salt, SCRYPT_KEYLEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

/** Compara una contraseña en claro con el valor almacenado (tiempo constante). */
export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false

  try {
    const hash = scryptSync(String(password), Buffer.from(saltHex, 'hex'), SCRYPT_KEYLEN)
    const expected = Buffer.from(hashHex, 'hex')
    if (hash.length !== expected.length) return false
    return timingSafeEqual(hash, expected)
  } catch {
    return false
  }
}

export const TOKEN_TTL = TOKEN_TTL_SECONDS
