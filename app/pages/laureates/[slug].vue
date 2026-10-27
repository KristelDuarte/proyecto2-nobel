<script setup>
const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))

const registro = ref(null)
const relacionados = ref([])
const pendiente = ref(true)
const error = ref(null)

const { isAuthenticated } = useAuth()

async function cargar() {
  pendiente.value = true
  error.value = null
  try {
    const { data } = await getResource('laureates', slug.value)
    registro.value = data

    const mismoAnio = await listResource('laureates', { year: data.year, limit: 12 })
    relacionados.value = mismoAnio.data.filter((r) => r.id !== data.id).slice(0, 5)
  } catch (e) {
    error.value = e
    registro.value = null
  } finally {
    pendiente.value = false
  }
}

watch(slug, cargar)
onMounted(cargar)

useHead(() => ({ title: registro.value ? `${registro.value.laureate} · Premios Nobel` : 'Galardonado' }))

const categoria = computed(() => registro.value?.category || null)
const pais = computed(() => registro.value?.country || null)
const color = computed(() => categoria.value?.color || '#c9a227')
const nacimiento = computed(() => {
  const partes = []
  if (registro.value?.birthDate) partes.push(formatDate(registro.value.birthDate))
  if (registro.value?.birthPlace) partes.push(registro.value.birthPlace)
  return partes.join(' · ')
})
</script>

<template>
  <div>
    <p v-if="pendiente" class="muted">Consultando el registro…</p>

    <div v-else-if="error" class="empty">
      <h3>No se pudo cargar el registro</h3>
      <p>{{ error.message }}</p>
      <NuxtLink to="/laureates" class="btn btn-sm mt-2">Volver al catálogo</NuxtLink>
    </div>

    <template v-else-if="registro">
      <nav class="breadcrumb" aria-label="Ruta de navegación">
        <NuxtLink to="/">Inicio</NuxtLink>
        <span class="sep">/</span>
        <NuxtLink to="/laureates">Galardonados</NuxtLink>
        <span class="sep">/</span>
        <span>{{ registro.laureate }}</span>
      </nav>

      <section class="detail-hero" :style="{ '--catcolor': color }">
        <div class="detail-flex">
          <img
            v-if="registro.portraitUrl"
            class="detail-portrait"
            :src="registro.portraitUrl"
            :alt="`Retrato de ${registro.laureate}`"
            width="160"
            height="160"
          />

          <div>
            <p class="eyebrow">{{ categoria?.fullname || 'Galardonado' }}</p>
            <h1 class="detail-name">{{ registro.laureate }}</h1>

            <div class="dh-eyebrow">
              <NuxtLink
                v-if="categoria"
                class="chip chip-cat"
                :to="`/categories/${categoria.key}`"
                :style="{ background: color }"
              >
                {{ categoria.name }}
              </NuxtLink>
              <NuxtLink class="chip" :to="`/years/${registro.year}`">Premio de {{ registro.year }}</NuxtLink>
              <span class="chip">{{ genderLabel(registro.gender) }}</span>
              <span v-if="lifeSpan(registro.birthDate, registro.deathDate)" class="chip">
                {{ lifeSpan(registro.birthDate, registro.deathDate) }}
              </span>
            </div>

            <div v-if="registro.motivation" class="quote">
              <p>{{ registro.motivation }}</p>
            </div>
          </div>
        </div>

        <div class="detail-meta">
          <div v-if="categoria" class="meta-item">
            <span class="mi-label">Categoría</span>
            <span class="mi-value">
              <NuxtLink :to="`/categories/${categoria.key}`" style="color: inherit">
                {{ categoria.name }}
              </NuxtLink>
            </span>
          </div>

          <div v-if="pais" class="meta-item">
            <span class="mi-label">País de nacimiento</span>
            <span class="mi-value">
              <NuxtLink :to="`/countries/${pais.code}`" class="country-inline">
                <img :src="pais.flag" :alt="`Bandera de ${pais.name}`" width="22" height="15" loading="lazy" />
                {{ pais.name }}
              </NuxtLink>
            </span>
          </div>

          <div v-else-if="registro.birthCountryRaw" class="meta-item">
            <span class="mi-label">País de nacimiento</span>
            <span class="mi-value">{{ registro.birthCountryRaw }}</span>
          </div>

          <div v-if="registro.affiliation" class="meta-item">
            <span class="mi-label">Institución</span>
            <span class="mi-value">{{ registro.affiliation }}</span>
          </div>

          <div v-if="nacimiento" class="meta-item">
            <span class="mi-label">Nacimiento</span>
            <span class="mi-value">{{ nacimiento }}</span>
          </div>

          <div v-if="registro.deathDate" class="meta-item">
            <span class="mi-label">Fallecimiento</span>
            <span class="mi-value">{{ formatDate(registro.deathDate) }}</span>
          </div>
        </div>

        <p v-if="isAuthenticated" class="mt-2">
          <NuxtLink class="btn btn-ghost btn-sm" :to="`/admin/laureates?edit=${registro.id}`">
            Editar este registro
          </NuxtLink>
        </p>
      </section>

      <div class="detail-lower">
        <section class="related-box">
          <p class="mini-heading">Sobre la categoría</p>
          <p class="mb-0">{{ categoria?.description || 'Sin descripción disponible.' }}</p>
          <NuxtLink
            v-if="categoria"
            :to="`/categories/${categoria.key}`"
            class="btn btn-ghost btn-sm mt-2"
            style="text-decoration: none"
          >
            Ver los {{ numberEs(categoria.laureateCount) }} premios de {{ categoria.name }} →
          </NuxtLink>
        </section>

        <section class="related-box">
          <p class="mini-heading">Premios del mismo año</p>
          <ul v-if="relacionados.length" class="related-list">
            <li v-for="r in relacionados" :key="r.id">
              <NuxtLink :to="`/laureates/${r.slug || r.id}`">
                <span class="rl-name">{{ r.laureate }}</span>
                <span class="rl-year">{{ r.category?.name }}</span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="mb-0 muted">Este premio se concedió en solitario.</p>
          <NuxtLink :to="`/years/${registro.year}`" class="btn btn-ghost btn-sm mt-2">
            Ver la promoción de {{ registro.year }} →
          </NuxtLink>
        </section>
      </div>

      <p class="muted mt-3">
        Identificador en MongoDB: <code>{{ registro.id }}</code> · slug:
        <code>{{ registro.slug }}</code>
      </p>
    </template>
  </div>
</template>
