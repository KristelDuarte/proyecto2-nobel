<script setup>
useHead({ title: 'Por año · Premios Nobel' })

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

/** Agrupa los años por década para facilitar la navegación. */
const decadas = computed(() => {
  const anios = stats.value?.byYear || []
  const mapa = new Map()
  for (const item of anios) {
    const decada = Math.floor(item.year / 10) * 10
    if (!mapa.has(decada)) mapa.set(decada, [])
    mapa.get(decada).push(item)
  }
  return [...mapa.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([decada, items]) => ({ decada, items }))
})
</script>

<template>
  <div>
    <div class="section-title">
      <div>
        <p class="eyebrow">Navegación temporal</p>
        <h2>Premios por año</h2>
        <p class="lead mb-0">
          Vista derivada de las estadísticas de la API: {{ stats?.totals.years || 0 }} años
          con al menos un premio concedido.
        </p>
      </div>
    </div>

    <AlertBox v-if="error" :message="error.message" />
    <p v-else-if="pendiente" class="muted">Consultando la API…</p>

    <div v-else class="decade-list">
      <section v-for="bloque in decadas" :key="bloque.decada" class="decade-block">
        <h3>Década de {{ bloque.decada }}</h3>
        <div class="year-chips">
          <NuxtLink
            v-for="item in bloque.items.slice().reverse()"
            :key="item.year"
            class="year-chip"
            :to="`/years/${item.year}`"
          >
            {{ item.year }} <small>{{ item.count }}</small>
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
