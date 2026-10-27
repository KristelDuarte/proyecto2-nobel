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
    descripcion: 'Añade, corrige o elimina premios del catálogo.',
  },
  {
    to: '/admin/categories',
    titulo: 'Categorías',
    descripcion: 'Las seis disciplinas en las que se agrupan los premios.',
  },
  {
    to: '/admin/countries',
    titulo: 'Países',
    descripcion: 'Los países de origen de los galardonados.',
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
          <span v-if="isAdmin" class="role-badge">Administrador</span>
          <span v-else class="role-badge role-editor">Editor</span>
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
    <p v-else-if="pendiente" class="muted">Cargando…</p>

    <div class="admin-grid">
      <NuxtLink v-for="t in tarjetas" :key="t.to" class="admin-card" :to="t.to">
        <h3>{{ t.titulo }}</h3>
        <p>{{ t.descripcion }}</p>
        <span class="cat-cta">Administrar →</span>
      </NuxtLink>
    </div>

    <section class="panel mt-3">
      <p class="eyebrow">Tu cuenta</p>
      <h3 style="margin-top: 0">
        {{ isAdmin ? 'Puedes añadir, editar y eliminar registros' : 'Puedes añadir y editar registros' }}
      </h3>
      <p class="mb-0">
        Cualquier visitante puede consultar el catálogo. Para modificarlo hay que
        iniciar sesión: las cuentas nuevas pueden añadir y corregir registros, y solo
        la cuenta administradora puede eliminarlos.
      </p>
    </section>
  </div>
</template>
