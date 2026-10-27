/**
 * scripts/check-connection.mjs
 * ----------------------------
 * Diagnóstico de la conexión a MongoDB Atlas. No escribe nada: solo comprueba
 * que la cadena del .env sirva y muestra qué contiene la base de datos.
 *
 *   npm run db:check
 */

import 'dotenv/config'
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI

function salir(mensaje, ayuda = []) {
  console.error(`\n✖ ${mensaje}`)
  for (const linea of ayuda) console.error(`   · ${linea}`)
  console.error('')
  process.exit(1)
}

if (!uri) {
  salir('No existe MONGODB_URI.', [
    'Copia .env.example a .env y pega ahí la cadena de conexión de Atlas.',
  ])
}

if (/[<>]/.test(uri)) {
  salir('La cadena todavía contiene los marcadores < > (por ejemplo <password>).', [
    'Reemplaza <password> por tu contraseña real, sin los signos < >.',
  ])
}

// Análisis de la cadena (sin exponer la contraseña).
let analizada
try {
  analizada = new URL(uri)
} catch {
  salir('La cadena de conexión no es una URL válida.', [
    'Debe empezar por mongodb+srv:// y no tener espacios ni saltos de línea.',
    'Si tu contraseña tiene @ : / ? # [ ] %, escríbela codificada (por ejemplo @ → %40).',
  ])
}

const usuario = decodeURIComponent(analizada.username || '(sin usuario)')
const hosts = analizada.hostname
const base = process.env.MONGODB_DB || analizada.pathname.replace(/^\//, '') || 'nobel'

console.log('\n▸ Cadena detectada')
console.log(`   usuario : ${usuario}`)
console.log(`   servidor: ${hosts}`)
console.log(`   base    : ${base}`)
console.log(`   opciones: ${analizada.search || '(ninguna)'}`)

if (analizada.password && /[@:/?#[\]%]/.test(decodeURIComponent(analizada.password))) {
  console.log('\n⚠ La contraseña contiene caracteres especiales. Si falla la autenticación,')
  console.log('  cámbiala en Atlas por una solo con letras y números.')
}

const cliente = new MongoClient(uri, { serverSelectionTimeoutMS: 12000 })

console.log('\n▸ Conectando…')

try {
  await cliente.connect()
  await cliente.db('admin').command({ ping: 1 })
  console.log('✔ Conexión establecida y ping correcto')

  const version = await cliente.db('admin').command({ buildInfo: 1 })
  console.log(`   MongoDB ${version.version}`)

  const db = cliente.db(base)
  const colecciones = await db.listCollections().toArray()

  if (colecciones.length === 0) {
    console.log(`\n▸ La base «${base}» está vacía: ejecuta \`npm run seed\`.`)
  } else {
    console.log(`\n▸ Contenido de «${base}»`)
    for (const { name } of colecciones.sort((a, b) => a.name.localeCompare(b.name))) {
      const total = await db.collection(name).countDocuments()
      console.log(`   ${name.padEnd(12)} ${total} documentos`)
    }
  }

  console.log('\n✔ Todo listo para sembrar y desplegar.\n')
} catch (error) {
  const texto = String(error?.message || error)

  if (/bad auth|authentication failed|SCRAM/i.test(texto)) {
    salir('Atlas rechazó el usuario o la contraseña.', [
      'Revisa el usuario en Database Access (debe existir ese usuario exacto).',
      'Si cambiaste la contraseña, actualiza también la cadena del .env.',
      'Recuerda sustituir <password> por la contraseña real.',
    ])
  }

  if (/Server selection timed out|ETIMEOUT|getaddrinfo|ENOTFOUND|querySrv/i.test(texto)) {
    salir('No se pudo alcanzar el clúster.', [
      'Network Access debe permitir 0.0.0.0/0 (o tu IP actual).',
      'En clústeres nuevos tarda 1–3 minutos en quedar disponible.',
      'Comprueba que copiaste el nombre de host completo (cluster0.xxxxx.mongodb.net).',
      `Detalle: ${texto}`,
    ])
  }

  salir('Error inesperado al conectar.', [texto])
} finally {
  await cliente.close().catch(() => {})
}
