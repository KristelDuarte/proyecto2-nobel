<script setup>
const props = defineProps({
  country: { type: Object, required: true },
})

const bandera = computed(() => props.country.flag || '')
</script>

<template>
  <NuxtLink class="country-card" :to="`/countries/${country.code}`">
    <img
      v-if="bandera"
      class="cc-flag"
      :src="bandera"
      :alt="`Bandera de ${country.name}`"
      width="56"
      height="38"
      loading="lazy"
    />
    <span v-else class="cc-flag cc-flag-empty" aria-hidden="true">{{ country.code }}</span>

    <span class="cc-body">
      <span class="cc-name">{{ country.name }}</span>
      <span class="cc-meta">
        {{ country.region }}
        <template v-if="typeof country.laureateCount === 'number'">
          · {{ country.laureateCount }} premio{{ country.laureateCount === 1 ? '' : 's' }}
        </template>
      </span>
    </span>
  </NuxtLink>
</template>
