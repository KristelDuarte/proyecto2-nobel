<script setup>
const props = defineProps({
  record: { type: Object, required: true },
})

const categoria = computed(() => props.record.category || null)
const pais = computed(() => props.record.country || null)
const color = computed(() => categoria.value?.color || '#13315c')
const retrato = computed(() => props.record.portraitUrl || null)
</script>

<template>
  <article class="laureate-card">
    <div class="lc-head">
      <img
        v-if="retrato"
        class="lc-avatar"
        :src="retrato"
        :alt="`Retrato de ${record.laureate}`"
        width="52"
        height="52"
        loading="lazy"
      />
      <span v-else class="lc-medal" :style="{ background: color }" aria-hidden="true">
        {{ initials(record.laureate) }}
      </span>

      <div class="lc-badges">
        <span class="chip chip-cat" :style="{ background: color }">
          {{ categoria?.name || 'Sin categoría' }}
        </span>
        <span v-if="pais" class="chip">{{ pais.name }}</span>
      </div>
    </div>

    <h3 class="lc-name">{{ record.laureate }}</h3>
    <p class="lc-motivation">
      {{ record.motivation || 'Concedido por sus contribuciones destacadas en esta disciplina.' }}
    </p>

    <div class="lc-foot">
      <span class="lc-year">{{ record.year }}</span>
      <span class="chip">{{ genderLabel(record.gender) }}</span>
      <NuxtLink class="lc-link" :to="`/laureates/${record.slug || record.id}`">
        Ver ficha <span aria-hidden="true">→</span>
      </NuxtLink>
    </div>
  </article>
</template>
