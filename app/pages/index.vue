<script setup>
useHead({ title: 'Premios Nobel — Catálogo de galardonados' })

const stats = ref(null)
const ultimos = ref([])
const categorias = ref([])
const paises = ref([])
const pendiente = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const [s, l, c, p] = await Promise.all([
      apiFetch('/stats'),
      listResource('laureates', { limit: 6, sort: 'year-desc' }),
      listResource('categories', { limit: 10 }),
      listResource('countries', { limit: 6 }),
    ])
    stats.value = s.data
    ultimos.value = l.data
    categorias.value = c.data
    paises.value = p.data
  } catch (e) {
    error.value = e
  } finally {
    pendiente.value = false
  }
})
</script>

<template>
  <div>
    <section class="hero">
      <p class="hero-kicker">
        Proyecto 2 · MongoDB · Netlify Functions · Autenticación JWT
      </p>
      <h1>Un catálogo vivo de los Premios Nobel</h1>
      <p class="lead">
        Galardonados, categorías y países almacenados en MongoDB y expuestos mediante
        una API REST con operaciones de consulta, creación, edición y borrado.
        El sitio consume el servicio en tiempo real.
      </p>
      <div class="hero-actions">
        <NuxtLink to="/laureates" class="btn">Explorar galardonados</NuxtLink>
        <NuxtLink to="/admin" class="btn btn-outline-light">Administrar el catálogo</NuxtLink>
      </div>
    </section>

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
        <strong>{{ stats.totals.years }}</strong>
        <span>años con premio</span>
      </div>
      <div class="stat">
        <strong>{{ stats.range.firstYear }}–{{ stats.range.lastYear }}</strong>
        <span>periodo cubierto</span>
      </div>
    </div>

    <p v-else-if="pendiente" class="muted">Cargando estadísticas desde la API…</p>

    <section class="mt-3">
      <div class="section-title">
        <div>
          <p class="eyebrow">Entidad secundaria</p>
          <h2>Categorías</h2>
          <p class="lead mb-0">
            Cada premio pertenece a una de las seis categorías y cada categoría
            referencia a todos sus galardonados.
          </p>
        </div>
        <NuxtLink to="/categories" class="btn btn-ghost btn-sm">Ver todas →</NuxtLink>
      </div>

      <div class="cat-grid">
        <NuxtLink
          v-for="c in categorias"
          :key="c.id"
          class="cat-card"
          :to="`/categories/${c.key}`"
          :style="{ '--catcolor': c.color }"
        >
          <h3>{{ c.name }}</h3>
          <p class="cat-count">{{ numberEs(c.laureateCount) }} premios</p>
          <p class="cat-desc">{{ c.description }}</p>
          <span class="cat-cta">Explorar →</span>
        </NuxtLink>
      </div>
    </section>

    <section class="mt-3">
      <div class="section-title">
        <div>
          <p class="eyebrow">Entidad secundaria</p>
          <h2>Países</h2>
          <p class="lead mb-0">Los países de nacimiento más frecuentes del catálogo.</p>
        </div>
        <NuxtLink to="/countries" class="btn btn-ghost btn-sm">Ver todos →</NuxtLink>
      </div>

      <div class="country-grid">
        <CountryCard v-for="p in paises" :key="p.id" :country="p" />
      </div>
    </section>

    <section class="mt-3">
      <div class="section-title">
        <div>
          <p class="eyebrow">Entidad principal</p>
          <h2>Últimos premios</h2>
          <p class="lead mb-0">Los galardonados más recientes del catálogo.</p>
        </div>
        <NuxtLink to="/laureates" class="btn btn-ghost btn-sm">Ver todos →</NuxtLink>
      </div>

      <div class="card-grid">
        <LaureateCard v-for="r in ultimos" :key="r.id" :record="r" />
      </div>
    </section>

    <section class="mt-3 panel">
      <p class="eyebrow">Servicio REST</p>
      <h2 style="margin-top: 0">Endpoints publicados</h2>
      <p class="lead">
        La aplicación y el servicio están separados: el frontend (Vue 3) consume
        estas rutas, protegidas con JWT las que modifican datos.
      </p>
      <ul class="endpoint-list">
        <li><code>GET</code> <span>/api/laureates</span> — listado con filtros y paginación</li>
        <li><code>GET</code> <span>/api/laureates/:slug</span> — consulta individual</li>
        <li><code>POST</code> <span>/api/laureates</span> — crear (token requerido)</li>
        <li><code>PUT</code> <span>/api/laureates/:id</span> — editar (token requerido)</li>
        <li><code>DELETE</code> <span>/api/laureates/:id</span> — borrar (rol admin)</li>
        <li><code>GET</code> <span>/api/categories</span> · <span>/api/countries</span> — entidades secundarias</li>
        <li><code>POST</code> <span>/api/auth/register</span> · <span>/api/auth/login</span> — autenticación</li>
      </ul>
    </section>
  </div>
</template>
