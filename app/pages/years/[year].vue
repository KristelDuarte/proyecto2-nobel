<script setup>
const route = useRoute()
const anio = computed(() => Number(route.params.year))

const laureados = ref([])
const meta = ref({ total: 0 })
const page = ref(1)
const perPage = 12
const pendiente = ref(true)
const error = ref(null)

const porCategoria = computed(() => {
  const mapa = new Map()
  for (const r of laureados.value) {
    const clave = r.category?.name || 'Sin categoría'
    mapa.set(clave, (mapa.get(clave) || 0) + 1)
  }
  return [...mapa.entries()]
})

async function cargar() {
  pendiente.value = true
  error.value = null
  try {
    const lista = await listResource('laureates', {
      year: anio.value,
      limit: perPage,
      page: page.value,
      sort: 'name-asc',
    })
    laureados.value = lista.data
    meta.value = lista.meta
  } catch (e) {
    error.value = e
  } finally {
    pendiente.value = false
  }
}

watch(anio, () => {
  page.value = 1
  cargar()
})
watch(page, cargar)
onMounted(cargar)

useHead(() => ({ title: `Premios Nobel de ${anio.value}` }))
</script>

<template>
  <div>
    <nav class="breadcrumb" aria-label="Ruta de navegación">
      <NuxtLink to="/">Inicio</NuxtLink>
      <span class="sep">/</span>
      <NuxtLink to="/years">Años</NuxtLink>
      <span class="sep">/</span>
      <span>{{ anio }}</span>
    </nav>

    <div class="section-title">
      <div>
        <p class="eyebrow">Ceremonia de {{ anio }}</p>
        <h2>Premios Nobel de {{ anio }}</h2>
        <p class="lead mb-0">
          {{ numberEs(meta.total) }} galardonado{{ meta.total === 1 ? '' : 's' }}
          <template v-if="porCategoria.length">
            en {{ porCategoria.map(([nombre]) => nombre).join(', ') }}
          </template>.
        </p>
      </div>
      <NuxtLink to="/years" class="btn btn-ghost btn-sm">Cambiar de año</NuxtLink>
    </div>

    <AlertBox v-if="error" :message="error.message" />
    <p v-else-if="pendiente" class="muted">Cargando…</p>

    <div v-else-if="laureados.length" class="card-grid">
      <LaureateCard v-for="r in laureados" :key="r.id" :record="r" />
    </div>

    <div v-else class="empty">
      <h3>Sin premios en {{ anio }}</h3>
      <p>No se concedieron premios ese año o aún no están registrados.</p>
      <NuxtLink to="/years" class="btn btn-sm mt-2">Ver otros años</NuxtLink>
    </div>

    <PaginationView v-model="page" :total="meta.total" :per-page="perPage" />
  </div>
</template>
