<script setup>
const route = useRoute()
const clave = computed(() => String(route.params.key || ''))

const categoria = ref(null)
const laureados = ref([])
const meta = ref({ total: 0 })
const page = ref(1)
const perPage = 12
const pendiente = ref(true)
const error = ref(null)

async function cargar() {
  pendiente.value = true
  error.value = null
  try {
    const { data } = await getResource('categories', clave.value)
    categoria.value = data

    const lista = await listResource('laureates', {
      category: clave.value,
      limit: perPage,
      page: page.value,
      sort: 'year-desc',
    })
    laureados.value = lista.data
    meta.value = lista.meta
  } catch (e) {
    error.value = e
    categoria.value = null
  } finally {
    pendiente.value = false
  }
}

watch(clave, () => {
  page.value = 1
  cargar()
})
watch(page, cargar)
onMounted(cargar)

useHead(() => ({ title: categoria.value ? `${categoria.value.name} · Premios Nobel` : 'Categoría' }))
</script>

<template>
  <div>
    <p v-if="pendiente && !categoria" class="muted">Consultando la categoría…</p>

    <div v-else-if="error" class="empty">
      <h3>Categoría no disponible</h3>
      <p>{{ error.message }}</p>
      <NuxtLink to="/categories" class="btn btn-sm mt-2">Ver todas las categorías</NuxtLink>
    </div>

    <template v-else-if="categoria">
      <nav class="breadcrumb" aria-label="Ruta de navegación">
        <NuxtLink to="/">Inicio</NuxtLink>
        <span class="sep">/</span>
        <NuxtLink to="/categories">Categorías</NuxtLink>
        <span class="sep">/</span>
        <span>{{ categoria.name }}</span>
      </nav>

      <div class="section-title">
        <div>
          <p class="eyebrow">{{ categoria.fullname || 'Categoría' }}</p>
          <h2>{{ categoria.name }}</h2>
          <p class="lead mb-0">{{ categoria.description }}</p>
        </div>
        <span class="chip chip-cat" :style="{ background: categoria.color }">
          {{ numberEs(categoria.laureateCount) }} premios
        </span>
      </div>

      <div v-if="laureados.length" class="card-grid">
        <LaureateCard v-for="r in laureados" :key="r.id" :record="r" />
      </div>
      <div v-else class="empty">
        <h3>Sin galardonados</h3>
        <p>Esta categoría todavía no tiene registros asociados.</p>
      </div>

      <PaginationView v-model="page" :total="meta.total" :per-page="perPage" />
    </template>
  </div>
</template>
