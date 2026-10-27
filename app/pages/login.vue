<script setup>
useHead({ title: 'Iniciar sesión · Premios Nobel' })

const route = useRoute()
const { login, isAuthenticated, restore } = useAuth()

const email = ref('')
const password = ref('')
const enviando = ref(false)
const error = ref(null)

onMounted(async () => {
  await restore()
  if (isAuthenticated.value) navigateTo('/admin')
})

async function enviar() {
  enviando.value = true
  error.value = null
  try {
    await login(email.value.trim(), password.value)
    const destino = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'
    await navigateTo(destino)
  } catch (e) {
    error.value = e
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <p class="eyebrow">Acceso</p>
      <h1 class="auth-title">Iniciar sesión</h1>
      <p class="lead">
        Accede para añadir, corregir o eliminar registros del catálogo.
      </p>

      <AlertBox v-if="error" :message="error.message" :details="error.details" />

      <form class="form-grid" @submit.prevent="enviar">
        <label class="form-field">
          <span>Correo electrónico</span>
          <input v-model="email" type="email" required autocomplete="username" placeholder="tu@correo.com" />
        </label>

        <label class="form-field">
          <span>Contraseña</span>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="••••••••"
          />
        </label>

        <button type="submit" class="btn" :disabled="enviando">
          {{ enviando ? 'Verificando…' : 'Entrar' }}
        </button>
      </form>

      <p class="auth-alt">
        ¿No tienes cuenta? <NuxtLink to="/register">Crear una cuenta</NuxtLink>
      </p>
    </div>
  </div>
</template>
