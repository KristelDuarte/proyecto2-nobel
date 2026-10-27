<script setup>
useHead({ title: 'Países · Premios Nobel' })

const paises = ref([])
const regiones = ref([])
const region = ref('')
const q = ref('')
const pendiente = ref(true)
const error = ref(null)

async function cargar() {
  pendiente.value = true
  error.value = null
  try {
    const { data } = await listResource('countries', { limit: 100, q: q.value, region: region.value })
    paises.value = data
    regiones.value = [...new Set(data.map((p) => p.region))].sort()
  } catch (e) {
    error.value = e
  } finally {
    pendiente.value = false
  }
}

let temporizador
watch(q, () => {
  clearTimeout(temporizador)
  temporizador = setTimeout(cargar, 300)
})
watch(region, cargar)
onMounted(cargar)
</script>

<template>
  <div>
    <div class="section-title">
      <div>
        <p class="eyebrow">Procedencias</p>
        <h2>Países de nacimiento</h2>
        <p class="lead mb-0">
          Cada galardonado está vinculado a su país de nacimiento; desde aquí puedes
          ver todos los premios de un país concreto.
        </p>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" stroke-linecap="round" />
        </svg>
        <input v-model="q" type="search" placeholder="Buscar país…" aria-label="Buscar país" />
      </div>

      <div class="field">
        <select v-model="region" aria-label="Filtrar por región">
          <option value="">Todas las regiones</option>
          <option v-for="r in regiones" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>
    </div>

    <AlertBox v-if="error" :message="error.message" />
    <p v-else-if="pendiente" class="muted">Cargando…</p>

    <div v-else-if="paises.length" class="country-grid">
      <CountryCard v-for="p in paises" :key="p.id" :country="p" />
    </div>

    <div v-else class="empty">
      <h3>Sin coincidencias</h3>
      <p>No hay países que coincidan con la búsqueda.</p>
    </div>
  </div>
</template>
