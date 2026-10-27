<script setup>
definePageMeta({ middleware: 'auth' })

useHead({ title: 'Panel de administración · Premios Nobel' })

const { user, isAdmin, logout } = useAuth()

const stats = ref(null)
const pendiente = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const res = await apiFetch('/stats')
    stats.value = res.data
  } catch (e) {
    error.value = e
  } finally {
    pendiente.value = false
  }
})

const tarjetas = [
  {
    to: '/admin/laureates',
    titulo: 'Galardonados',
    descripcion: 'Entidad principal: crear, editar y borrar premios.',
  },
  {
    to: '/admin/categories',
    titulo: 'Categorías',
    descripcion: 'Entidad secundaria: las seis disciplinas del premio.',
  },
  {
    to: '/admin/countries',
    titulo: 'Países',
    descripcion: 'Entidad secundaria: país de nacimiento de cada galardonado.',
  },
]
</script>

<template>
  <div>
    <div class="section-title">
      <div>
        <p class="eyebrow">Sesión iniciada</p>
        <h2>Panel de administración</h2>
        <p class="lead mb-0">
          {{ user?.name }} · {{ user?.email }}
          <span v-if="isAdmin" class="role-badge">admin</span>
          <span v-else class="role-badge role-editor">editor</span>
        </p>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" @click="logout(); navigateTo('/')">
        Cerrar sesión
      </button>
    </div>

    <AlertBox v-if="error" :message="error.message" />

    <div v-if="stats" class="stat-band">
      <div class="stat">
        <strong>{{ numberEs(stats.totals.laureates) }}</strong>
        <span>galardonados</span>
      </div>
      <div class="stat">
        <strong>{{ stats.totals.categories }}</strong>
        <span>categorías</span>
      </div>
      <div class="stat">
        <strong>{{ stats.totals.countries }}</strong>
        <span>países</span>
      </div>
      <div class="stat">
        <strong>{{ stats.totals.users }}</strong>
        <span>usuarios</span>
      </div>
    </div>
    <p v-else-if="pendiente" class="muted">Consultando la API…</p>

    <div class="admin-grid">
      <NuxtLink v-for="t in tarjetas" :key="t.to" class="admin-card" :to="t.to">
        <h3>{{ t.titulo }}</h3>
        <p>{{ t.descripcion }}</p>
        <span class="cat-cta">Administrar →</span>
      </NuxtLink>
    </div>

    <section class="panel mt-3">
      <p class="eyebrow">Permisos del rol</p>
      <h3 style="margin-top: 0">
        {{ isAdmin ? 'Administrador: lectura, creación, edición y borrado' : 'Editor: lectura, creación y edición' }}
      </h3>
      <p class="mb-0">
        Las rutas de escritura exigen un token válido (<code>401</code> sin token) y el
        borrado requiere el rol <code>admin</code> (<code>403</code> para editores). El
        primer usuario registrado en una base vacía obtiene el rol de administrador.
      </p>
    </section>
  </div>
</template>
