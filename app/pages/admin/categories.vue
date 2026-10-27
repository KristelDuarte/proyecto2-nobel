<script setup>
definePageMeta({ middleware: 'auth' })

useHead({ title: 'Administrar categorías · Premios Nobel' })

const { isAdmin } = useAuth()

const rows = ref([])
const pendiente = ref(true)
const error = ref(null)
const mensaje = ref('')
const detalles = ref(null)

const editandoId = ref(null)
const guardando = ref(false)

function formularioVacio() {
  return {
    key: '',
    name: '',
    fullname: '',
    ordinal: rows.value.length + 1,
    color: '#1f6feb',
    icon: 'medal',
    description: '',
    image: '',
  }
}

const form = ref(formularioVacio())

async function cargar() {
  pendiente.value = true
  error.value = null
  try {
    const { data } = await listResource('categories', { limit: 20 })
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
    key: registro.key || '',
    name: registro.name || '',
    fullname: registro.fullname || '',
    ordinal: registro.ordinal || 1,
    color: registro.color || '#1f6feb',
    icon: registro.icon || 'medal',
    description: registro.description || '',
    image: registro.image || '',
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
    key: form.value.key.trim(),
    name: form.value.name.trim(),
    fullname: form.value.fullname.trim() || null,
    ordinal: Number(form.value.ordinal),
    color: form.value.color,
    icon: form.value.icon.trim() || null,
    description: form.value.description.trim() || null,
    image: form.value.image.trim() || null,
  }

  try {
    let texto = ''
    if (editandoId.value) {
      const res = await updateResource('categories', editandoId.value, cuerpo)
      texto = res.message || 'Categoría actualizada.'
    } else {
      const res = await createResource('categories', cuerpo)
      texto = res.message || 'Categoría creada.'
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
  if (!window.confirm(`¿Eliminar la categoría «${registro.name}»?`)) return
  try {
    await deleteResource('categories', registro.id)
    mensaje.value = 'Categoría eliminada.'
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
      <span>Categorías</span>
    </nav>

    <div class="section-title">
      <div>
        <p class="eyebrow">Entidad secundaria</p>
        <h2>Categorías</h2>
        <p class="lead mb-0">
          No se puede eliminar una categoría que tenga galardonados asociados
          (la API responde <code>409</code>).
        </p>
      </div>
      <NuxtLink to="/categories" class="btn btn-ghost btn-sm">Ver vista pública</NuxtLink>
    </div>

    <AlertBox v-if="error" :message="error.message" :details="detalles" />
    <AlertBox v-if="mensaje" type="success" :message="mensaje" />

    <section class="panel">
      <h3 style="margin-top: 0">{{ editandoId ? 'Editar categoría' : 'Nueva categoría' }}</h3>

      <form class="form-grid form-grid-2" @submit.prevent="guardar">
        <label class="form-field">
          <span>Clave * (slug único)</span>
          <input v-model="form.key" type="text" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="physics" />
        </label>

        <label class="form-field">
          <span>Nombre *</span>
          <input v-model="form.name" type="text" required minlength="2" maxlength="60" />
        </label>

        <label class="form-field">
          <span>Nombre completo</span>
          <input v-model="form.fullname" type="text" maxlength="140" placeholder="Premio Nobel de Física" />
        </label>

        <label class="form-field">
          <span>Orden *</span>
          <input v-model.number="form.ordinal" type="number" required min="1" max="99" />
        </label>

        <label class="form-field">
          <span>Color * (hexadecimal)</span>
          <input v-model="form.color" type="color" required />
        </label>

        <label class="form-field">
          <span>Icono</span>
          <input v-model="form.icon" type="text" maxlength="40" placeholder="atom, flask, heart…" />
        </label>

        <label class="form-field form-field-full">
          <span>Descripción</span>
          <textarea v-model="form.description" rows="3" maxlength="900"></textarea>
        </label>

        <div class="form-actions form-field-full">
          <button type="submit" class="btn" :disabled="guardando">
            {{ guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear categoría' }}
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
            <th>Clave</th>
            <th>Nombre</th>
            <th>Orden</th>
            <th>Premios</th>
            <th class="col-actions">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td><code>{{ r.key }}</code></td>
            <td>
              <span class="cell-main">{{ r.name }}</span>
              <span class="cell-sub">{{ r.fullname }}</span>
            </td>
            <td>{{ r.ordinal }}</td>
            <td>{{ numberEs(r.laureateCount) }}</td>
            <td class="col-actions">
              <button type="button" class="btn btn-ghost btn-sm" @click="editar(r)">Editar</button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                :disabled="!isAdmin"
                :title="isAdmin ? 'Eliminar categoría' : 'Solo un administrador puede borrar'"
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
