<script setup>
definePageMeta({ middleware: 'auth' })

useHead({ title: 'Administrar galardonados · Premios Nobel' })

const route = useRoute()
const { isAdmin } = useAuth()

const rows = ref([])
const meta = ref({ page: 1, total: 0, pages: 1 })
const page = ref(1)
const perPage = 10
const q = ref('')
const pendiente = ref(true)
const error = ref(null)

const categorias = ref([])
const paises = ref([])

const mensaje = ref('')
const detalles = ref(null)

const editandoId = ref(null)
const guardando = ref(false)

function formularioVacio() {
  return {
    laureate: '',
    gender: 'male',
    year: new Date().getFullYear(),
    categoryId: '',
    countryId: '',
    motivation: '',
    affiliation: '',
    birthDate: '',
    birthPlace: '',
    birthCountryRaw: '',
    deathDate: '',
  }
}

const form = ref(formularioVacio())

async function cargarCatalogos() {
  const [cats, counts] = await Promise.all([
    listResource('categories', { limit: 10 }),
    listResource('countries', { limit: 100 }),
  ])
  categorias.value = cats.data
  paises.value = counts.data
  if (!form.value.categoryId && cats.data.length) form.value.categoryId = cats.data[0].id
}

async function cargar() {
  pendiente.value = true
  error.value = null
  try {
    const res = await listResource('laureates', { page: page.value, limit: perPage, q: q.value })
    rows.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e
  } finally {
    pendiente.value = false
  }
}

let temporizador
watch(q, () => {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    page.value = 1
    cargar()
  }, 350)
})
watch(page, cargar)

onMounted(async () => {
  await cargarCatalogos()
  await cargar()

  const idParaEditar = route.query.edit
  if (typeof idParaEditar === 'string' && idParaEditar) {
    await editarPorId(idParaEditar)
  }
})

async function editarPorId(id) {
  try {
    const { data } = await getResource('laureates', id)
    editar(data)
  } catch (e) {
    error.value = e
  }
}

function editar(registro) {
  editandoId.value = registro.id
  form.value = {
    laureate: registro.laureate || '',
    gender: registro.gender || 'male',
    year: registro.year || new Date().getFullYear(),
    categoryId: registro.categoryId || registro.category?.id || '',
    countryId: registro.countryId || registro.country?.id || '',
    motivation: registro.motivation || '',
    affiliation: registro.affiliation || '',
    birthDate: registro.birthDate || '',
    birthPlace: registro.birthPlace || '',
    birthCountryRaw: registro.birthCountryRaw || '',
    deathDate: registro.deathDate || '',
  }
  mensaje.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function cancelar() {
  editandoId.value = null
  form.value = formularioVacio()
  // Deja una categoría preseleccionada para que el formulario siga siendo válido.
  form.value.categoryId = categorias.value[0]?.id || ''
  detalles.value = null
  mensaje.value = ''
}

async function guardar() {
  guardando.value = true
  mensaje.value = ''
  detalles.value = null
  error.value = null

  const cuerpo = {
    laureate: form.value.laureate.trim(),
    gender: form.value.gender,
    year: Number(form.value.year),
    categoryId: form.value.categoryId,
    countryId: form.value.countryId || null,
    motivation: form.value.motivation.trim() || null,
    affiliation: form.value.affiliation.trim() || null,
    birthDate: form.value.birthDate || null,
    birthPlace: form.value.birthPlace.trim() || null,
    birthCountryRaw: form.value.birthCountryRaw.trim() || null,
    deathDate: form.value.deathDate || null,
  }

  try {
    let texto = ''
    if (editandoId.value) {
      const res = await updateResource('laureates', editandoId.value, cuerpo)
      texto = res.message || 'Registro actualizado.'
    } else {
      const res = await createResource('laureates', cuerpo)
      texto = res.message || 'Registro creado.'
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
  if (!window.confirm(`¿Eliminar a «${registro.laureate}» del catálogo? Esta acción no se puede deshacer.`)) {
    return
  }
  try {
    await deleteResource('laureates', registro.id)
    mensaje.value = 'Registro eliminado.'
    error.value = null
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
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
      <span>Galardonados</span>
    </nav>

    <div class="section-title">
      <div>
        <p class="eyebrow">Entidad principal</p>
        <h2>Galardonados</h2>
        <p class="lead mb-0">
          Alta, edición y borrado de registros mediante
          <code>POST</code>, <code>PUT</code> y <code>DELETE</code>.
        </p>
      </div>
      <NuxtLink to="/laureates" class="btn btn-ghost btn-sm">Ver catálogo público</NuxtLink>
    </div>

    <AlertBox v-if="error" :message="error.message" :details="detalles" />
    <AlertBox v-if="mensaje" type="success" :message="mensaje" />

    <!-- Formulario -->
    <section class="panel">
      <h3 style="margin-top: 0">
        {{ editandoId ? 'Editar galardonado' : 'Nuevo galardonado' }}
      </h3>

      <form class="form-grid form-grid-2" @submit.prevent="guardar">
        <label class="form-field">
          <span>Nombre *</span>
          <input v-model="form.laureate" type="text" required minlength="2" maxlength="120" />
        </label>

        <label class="form-field">
          <span>Año del premio *</span>
          <input v-model.number="form.year" type="number" required min="1901" max="2100" />
        </label>

        <label class="form-field">
          <span>Género *</span>
          <select v-model="form.gender" required>
            <option value="male">Hombre</option>
            <option value="female">Mujer</option>
            <option value="org">Organización</option>
          </select>
        </label>

        <label class="form-field">
          <span>Categoría * (referencia)</span>
          <select v-model="form.categoryId" required>
            <option value="" disabled>Selecciona una categoría</option>
            <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>

        <label class="form-field">
          <span>País (referencia)</span>
          <select v-model="form.countryId">
            <option value="">Sin país asignado</option>
            <option v-for="p in paises" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>

        <label class="form-field">
          <span>Institución</span>
          <input v-model="form.affiliation" type="text" maxlength="220" />
        </label>

        <label class="form-field">
          <span>Fecha de nacimiento</span>
          <input v-model="form.birthDate" type="date" />
        </label>

        <label class="form-field">
          <span>Fecha de fallecimiento</span>
          <input v-model="form.deathDate" type="date" />
        </label>

        <label class="form-field">
          <span>Lugar de nacimiento</span>
          <input v-model="form.birthPlace" type="text" maxlength="200" />
        </label>

        <label class="form-field">
          <span>País de nacimiento (texto original)</span>
          <input v-model="form.birthCountryRaw" type="text" maxlength="120" />
        </label>

        <label class="form-field form-field-full">
          <span>Motivación</span>
          <textarea v-model="form.motivation" rows="3" maxlength="1000"></textarea>
        </label>

        <div class="form-actions form-field-full">
          <button type="submit" class="btn" :disabled="guardando">
            {{ guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear registro' }}
          </button>
          <button v-if="editandoId" type="button" class="btn btn-ghost" @click="cancelar">
            Cancelar edición
          </button>
        </div>
      </form>
    </section>

    <!-- Tabla -->
    <div class="toolbar mt-3">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" stroke-linecap="round" />
        </svg>
        <input v-model="q" type="search" placeholder="Buscar en el catálogo…" aria-label="Buscar" />
      </div>
      <p class="result-meta mb-0">
        <strong>{{ numberEs(meta.total) }}</strong> registros
      </p>
    </div>

    <p v-if="pendiente" class="muted">Consultando la API…</p>

    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Galardonado</th>
            <th>Año</th>
            <th>Categoría</th>
            <th>País</th>
            <th class="col-actions">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td>
              <span class="cell-main">{{ r.laureate }}</span>
              <span class="cell-sub">{{ genderLabel(r.gender) }} · <code>{{ r.slug }}</code></span>
            </td>
            <td>{{ r.year }}</td>
            <td>
              <span class="chip chip-cat" :style="{ background: r.category?.color || '#13315c' }">
                {{ r.category?.name || '—' }}
              </span>
            </td>
            <td>{{ r.country?.name || '—' }}</td>
            <td class="col-actions">
              <button type="button" class="btn btn-ghost btn-sm" @click="editar(r)">Editar</button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                :disabled="!isAdmin"
                :title="isAdmin ? 'Eliminar registro' : 'Solo un administrador puede borrar'"
                @click="borrar(r)"
              >
                Borrar
              </button>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="5" class="muted">No hay registros que coincidan con la búsqueda.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <PaginationView v-model="page" :total="meta.total" :per-page="perPage" />
  </div>
</template>
