<script setup>
const route = useRoute()
const code = computed(() => String(route.params.code || '').toUpperCase())

const pais = ref(null)
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
    const { data } = await getResource('countries', code.value)
    pais.value = data

    const lista = await listResource('laureates', {
      country: code.value,
      limit: perPage,
      page: page.value,
      sort: 'year-desc',
    })
    laureados.value = lista.data
    meta.value = lista.meta
  } catch (e) {
    error.value = e
    pais.value = null
  } finally {
    pendiente.value = false
  }
}

watch(code, () => {
  page.value = 1
  cargar()
})
watch(page, cargar)
onMounted(cargar)

useHead(() => ({ title: pais.value ? `${pais.value.name} · Premios Nobel` : 'País' }))
</script>

<template>
  <div>
    <p v-if="pendiente && !pais" class="muted">Consultando el país…</p>

    <div v-else-if="error" class="empty">
      <h3>País no disponible</h3>
      <p>{{ error.message }}</p>
      <NuxtLink to="/countries" class="btn btn-sm mt-2">Ver todos los países</NuxtLink>
    </div>

    <template v-else-if="pais">
      <nav class="breadcrumb" aria-label="Ruta de navegación">
        <NuxtLink to="/">Inicio</NuxtLink>
        <span class="sep">/</span>
        <NuxtLink to="/countries">Países</NuxtLink>
        <span class="sep">/</span>
        <span>{{ pais.name }}</span>
      </nav>

      <section class="detail-hero detail-hero-country">
        <div class="detail-flex">
          <img
            v-if="pais.flag"
            class="detail-flag"
            :src="pais.flag"
            :alt="`Bandera de ${pais.name}`"
            width="150"
            height="100"
          />
          <div>
            <p class="eyebrow">{{ pais.region }}</p>
            <h1 class="detail-name">{{ pais.name }}</h1>
            <div class="dh-eyebrow">
              <span class="chip">Código ISO {{ pais.code }}</span>
              <span v-if="pais.capital" class="chip">Capital: {{ pais.capital }}</span>
              <span class="chip chip-cat">{{ numberEs(pais.laureateCount) }} premios</span>
            </div>
            <p v-if="pais.description" class="lead mt-2 mb-0">{{ pais.description }}</p>
          </div>
        </div>
      </section>

      <div class="section-title mt-3">
        <div>
          <h2>Galardonados de {{ pais.name }}</h2>
          <p class="lead mb-0">Todos los premios concedidos a personas nacidas en {{ pais.name }}.</p>
        </div>
      </div>

      <div v-if="laureados.length" class="card-grid">
        <LaureateCard v-for="r in laureados" :key="r.id" :record="r" />
      </div>
      <div v-else class="empty">
        <h3>Sin galardonados</h3>
        <p>Este país todavía no tiene registros asociados.</p>
      </div>

      <PaginationView v-model="page" :total="meta.total" :per-page="perPage" />
    </template>
  </div>
</template>
