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
      <p class="hero-kicker">Catálogo de los Premios Nobel · 1901 – 2025</p>
      <h1>Un catálogo vivo de los Premios Nobel</h1>
      <p class="lead">
        Recorre más de un siglo de reconocimientos: descubre quiénes fueron los
        galardonados, en qué disciplina destacaron y de qué países provinieron
        las mentes que cambiaron su época.
      </p>
      <div class="hero-actions">
        <NuxtLink to="/laureates" class="btn">Explorar galardonados</NuxtLink>
        <NuxtLink to="/years" class="btn btn-outline-light">Recorrer por año</NuxtLink>
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

    <p v-else-if="pendiente" class="muted">Cargando…</p>

    <section class="mt-3">
      <div class="section-title">
        <div>
          <p class="eyebrow">Disciplinas</p>
          <h2>Categorías</h2>
          <p class="lead mb-0">
            Seis campos del conocimiento que, desde 1901, reconocen los aportes más
            importantes a la humanidad.
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
          <p class="eyebrow">Procedencias</p>
          <h2>Países</h2>
          <p class="lead mb-0">Los países de nacimiento más frecuentes entre los galardonados.</p>
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
          <p class="eyebrow">Novedades</p>
          <h2>Últimos premios</h2>
          <p class="lead mb-0">Las distinciones más recientes del catálogo.</p>
        </div>
        <NuxtLink to="/laureates" class="btn btn-ghost btn-sm">Ver todos →</NuxtLink>
      </div>

      <div class="card-grid">
        <LaureateCard v-for="r in ultimos" :key="r.id" :record="r" />
      </div>
    </section>

    <section class="mt-3 panel">
      <p class="eyebrow">Sobre el catálogo</p>
      <h2 style="margin-top: 0">Más de un siglo de reconocimientos</h2>
      <p class="lead mb-0">
        Este catálogo reúne los premios concedidos desde 1901, organizados por
        disciplina, año y país de nacimiento. Cada ficha incluye la motivación
        oficial, la institución del galardonado y sus datos biográficos, para que
        puedas recorrer la historia del premio desde distintos puntos de entrada.
      </p>
    </section>
  </div>
</template>
