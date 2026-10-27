<script setup>
useHead({ title: 'Categorías · Premios Nobel' })

const categorias = ref([])
const pendiente = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const { data } = await listResource('categories', { limit: 10 })
    categorias.value = data
  } catch (e) {
    error.value = e
  } finally {
    pendiente.value = false
  }
})
</script>

<template>
  <div>
    <div class="section-title">
      <div>
        <p class="eyebrow">Entidad secundaria</p>
        <h2>Categorías del premio</h2>
        <p class="lead mb-0">
          Seis categorías que agrupan los {{ numberEs(categorias.reduce((a, c) => a + (c.laureateCount || 0), 0)) }}
          premios del catálogo.
        </p>
      </div>
    </div>

    <AlertBox v-if="error" :message="error.message" />
    <p v-else-if="pendiente" class="muted">Consultando la API…</p>

    <div v-else class="cat-grid">
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
  </div>
</template>
