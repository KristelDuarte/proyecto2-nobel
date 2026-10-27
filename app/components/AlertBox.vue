<script setup>
const props = defineProps({
  type: { type: String, default: 'error' }, // error | success | info
  message: { type: String, default: '' },
  details: { type: Object, default: null },
})

const visible = computed(() => Boolean(props.message))
</script>

<template>
  <div v-if="visible" class="alert" :class="`alert-${type}`" role="status">
    <strong class="alert-msg">{{ message }}</strong>
    <ul v-if="details && Object.keys(details).length" class="alert-details">
      <li v-for="(texto, campo) in details" :key="campo">
        <span class="alert-field">{{ campo }}</span> {{ texto }}
      </li>
    </ul>
  </div>
</template>
