<script setup>
definePageMeta({ middleware: 'auth' })

useHead({ title: 'Administrar países · Premios Nobel' })

const { isAdmin } = useAuth()

const REGIONES = [
  'América del Norte',
  'América Central y el Caribe',
  'América del Sur',
  'Europa',
  'Asia',
  'África',
  'Oceanía',
  'Oriente Medio',
]

const rows = ref([])
const pendiente = ref(true)
const error = ref(null)
const mensaje = ref('')
const detalles = ref(null)

const editandoId = ref(null)
const guardando = ref(false)

function formularioVacio() {
  return { code: '', name: '', region: 'Europa', capital: '', description: '', flag: '' }
}

const form = ref(formularioVacio())

async function cargar() {
  pendiente.value = true
  error.value = null
  try {
    const { data } = await listResource('countries', { limit: 100 })
    rows.value = data
  } catch (e) {
    error.value = e
  } finally {
    pendiente.value = false
  }
}

onMounted(cargar)

function editar(registro) {
  editandoId.value = registro.id
  form.value = {
    code: registro.code || '',
    name: registro.name || '',
    region: registro.region || 'Europa',
    capital: registro.capital || '',
    description: registro.description || '',
    flag: registro.flag || '',
  }
  mensaje.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function cancelar() {
  editandoId.value = null
  form.value = formularioVacio()
  detalles.value = null
}

async function guardar() {
  guardando.value = true
  mensaje.value = ''
  detalles.value = null
  error.value = null

  const cuerpo = {
    code: form.value.code.trim().toUpperCase(),
    name: form.value.name.trim(),
    region: form.value.region,
    capital: form.value.capital.trim() || null,
    description: form.value.description.trim() || null,
    flag: form.value.flag.trim() || null,
  }

  try {
    let texto = ''
    if (editandoId.value) {
      const res = await updateResource('countries', editandoId.value, cuerpo)
      texto = res.message || 'País actualizado.'
    } else {
      const res = await createResource('countries', cuerpo)
      texto = res.message || 'País creado.'
    }
    cancelar()
    mensaje.value = texto
    await cargar()
  } catch (e) {
    if (e.details) detalles.value = e.details
    error.value = e
  } finally {
    guardando.value = false
  }
}

async function borrar(registro) {
  if (!window.confirm(`¿Eliminar el país «${registro.name}»?`)) return
  try {
    await deleteResource('countries', registro.id)
    mensaje.value = 'País eliminado.'
    error.value = null
    await cargar()
  } catch (e) {
    error.value = e
  }
}
</script>

<template>
  <div>
    <nav class="breadcrumb" aria-label="Ruta de navegación">
      <NuxtLink to="/admin">Panel</NuxtLink>
      <span class="sep">/</span>
      <span>Países</span>
    </nav>

    <div class="section-title">
      <div>
        <p class="eyebrow">Entidad secundaria</p>
        <h2>Países</h2>
        <p class="lead mb-0">
          Si no indicas una bandera, la API genera la URL del CDN a partir del
          código ISO (<code>https://flagcdn.com/w320/xx.png</code>).
        </p>
      </div>
      <NuxtLink to="/countries" class="btn btn-ghost btn-sm">Ver vista pública</NuxtLink>
    </div>

    <AlertBox v-if="error" :message="error.message" :details="detalles" />
    <AlertBox v-if="mensaje" type="success" :message="mensaje" />

    <section class="panel">
      <h3 style="margin-top: 0">{{ editandoId ? 'Editar país' : 'Nuevo país' }}</h3>

      <form class="form-grid form-grid-2" @submit.prevent="guardar">
        <label class="form-field">
          <span>Código ISO * (dos letras)</span>
          <input v-model="form.code" type="text" required maxlength="2" minlength="2" pattern="[A-Za-z]{2}" placeholder="GT" />
        </label>

        <label class="form-field">
          <span>Nombre *</span>
          <input v-model="form.name" type="text" required minlength="2" maxlength="90" />
        </label>

        <label class="form-field">
          <span>Región *</span>
          <select v-model="form.region" required>
            <option v-for="r in REGIONES" :key="r" :value="r">{{ r }}</option>
          </select>
        </label>

        <label class="form-field">
          <span>Capital</span>
          <input v-model="form.capital" type="text" maxlength="90" />
        </label>

        <label class="form-field form-field-full">
          <span>Descripción</span>
          <textarea v-model="form.description" rows="2" maxlength="900"></textarea>
        </label>

        <label class="form-field form-field-full">
          <span>URL de la bandera (opcional)</span>
          <input v-model="form.flag" type="url" maxlength="400" placeholder="https://flagcdn.com/w320/gt.png" />
        </label>

        <div class="form-actions form-field-full">
          <button type="submit" class="btn" :disabled="guardando">
            {{ guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear país' }}
          </button>
          <button v-if="editandoId" type="button" class="btn btn-ghost" @click="cancelar">Cancelar</button>
        </div>
      </form>
    </section>

    <p v-if="pendiente" class="muted mt-3">Consultando la API…</p>

    <div v-else class="table-wrap mt-3">
      <table class="data-table">
        <thead>
          <tr>
            <th>Bandera</th>
            <th>País</th>
            <th>Región</th>
            <th>Premios</th>
            <th class="col-actions">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>
              <img v-if="r.flag" :src="r.flag" :alt="`Bandera de ${r.name}`" width="32" height="22" loading="lazy" />
            </td>
            <td>
              <span class="cell-main">{{ r.name }}</span>
              <span class="cell-sub">{{ r.code }} · {{ r.capital || 'sin capital' }}</span>
            </td>
            <td>{{ r.region }}</td>
            <td>{{ numberEs(r.laureateCount) }}</td>
            <td class="col-actions">
              <button type="button" class="btn btn-ghost btn-sm" @click="editar(r)">Editar</button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                :disabled="!isAdmin"
                :title="isAdmin ? 'Eliminar país' : 'Solo un administrador puede borrar'"
                @click="borrar(r)"
              >
                Borrar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
