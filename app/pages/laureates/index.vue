<script setup>
useHead({ title: 'Galardonados · Premios Nobel' })

const { isAuthenticated } = useAuth()

const q = ref('')
const category = ref('')
const country = ref('')
const gender = ref('')
const sort = ref('year-desc')
const page = ref(1)
const perPage = 12

const rows = ref([])
const meta = ref({ page: 1, limit: perPage, total: 0, pages: 1 })
const pendiente = ref(true)
const error = ref(null)

const categorias = ref([])
const paises = ref([])

async function cargar() {
  pendiente.value = true
  error.value = null
  try {
    const res = await listResource('laureates', {
      page: page.value,
      limit: perPage,
      q: q.value,
      category: category.value,
      country: country.value,
      gender: gender.value,
      sort: sort.value,
    })
    rows.value = res.data
    meta.value = res.meta
  } catch (e) {
    error.value = e
    rows.value = []
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

watch([category, country, gender, sort], () => {
  page.value = 1
  cargar()
})

watch(page, () => cargar())

onMounted(async () => {
  const [cats, counts] = await Promise.allSettled([
    listResource('categories', { limit: 10 }),
    listResource('countries', { limit: 100 }),
  ])
  if (cats.status === 'fulfilled') categorias.value = cats.value.data
  if (counts.status === 'fulfilled') paises.value = counts.value.data
  cargar()
})

const hayFiltros = computed(
  () => Boolean(q.value || category.value || country.value || gender.value || sort.value !== 'year-desc'),
)

function limpiar() {
  q.value = ''
  category.value = ''
  country.value = ''
  gender.value = ''
  sort.value = 'year-desc'
  page.value = 1
  cargar()
}
</script>

<template>
  <div>
    <div class="section-title">
      <div>
        <p class="eyebrow">Entidad principal · {{ numberEs(meta.total) }} registros</p>
        <h2>Buscar galardonados</h2>
        <p class="lead mb-0">
          Los filtros se resuelven en el servidor: cada cambio envía una nueva
          consulta a <code>/api/laureates</code>.
        </p>
      </div>
      <NuxtLink v-if="isAuthenticated" to="/admin/laureates" class="btn btn-sm">
        + Nuevo galardonado
      </NuxtLink>
    </div>

    <div class="toolbar">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" stroke-linecap="round" />
        </svg>
        <input
          v-model="q"
          type="search"
          placeholder="Buscar por nombre, institución o motivación…"
          aria-label="Buscar galardonados"
        />
      </div>

      <div class="field">
        <select v-model="category" aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          <option v-for="c in categorias" :key="c.id" :value="c.key">{{ c.name }}</option>
        </select>
      </div>

      <div class="field">
        <select v-model="country" aria-label="Filtrar por país">
          <option value="">Todos los países</option>
          <option v-for="p in paises" :key="p.id" :value="p.code">{{ p.name }}</option>
        </select>
      </div>

      <div class="field">
        <select v-model="gender" aria-label="Filtrar por género">
          <option value="">Todos (personas y org.)</option>
          <option value="male">Hombre</option>
          <option value="female">Mujer</option>
          <option value="org">Organización</option>
        </select>
      </div>

      <div class="field">
        <select v-model="sort" aria-label="Ordenar resultados">
          <option value="year-desc">Más recientes primero</option>
          <option value="year-asc">Más antiguos primero</option>
          <option value="name-asc">Nombre (A → Z)</option>
          <option value="name-desc">Nombre (Z → A)</option>
          <option value="recent">Editados recientemente</option>
        </select>
      </div>
    </div>

    <p class="result-meta">
      <span>
        <strong>{{ numberEs(meta.total) }}</strong>
        {{ meta.total === 1 ? 'resultado' : 'resultados' }}
      </span>
      <button v-if="hayFiltros" type="button" class="btn btn-ghost btn-sm" @click="limpiar">
        Limpiar filtros
      </button>
    </p>

    <AlertBox v-if="error" :message="error.message" :details="error.details" />

    <p v-else-if="pendiente" class="muted">Consultando la API…</p>

    <div v-else-if="rows.length" class="card-grid">
      <LaureateCard v-for="r in rows" :key="r.id" :record="r" />
    </div>

    <div v-else class="empty">
      <h3>Sin resultados</h3>
      <p>Ningún galardonado coincide con los filtros seleccionados.</p>
      <button type="button" class="btn btn-sm mt-2" @click="limpiar">Mostrar todo el catálogo</button>
    </div>

    <PaginationView v-model="page" :total="meta.total" :per-page="perPage" />
  </div>
</template>
