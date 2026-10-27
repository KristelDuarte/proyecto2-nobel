<script setup>
useHead({ title: 'Crear cuenta · Premios Nobel' })

const { register, isAuthenticated, restore } = useAuth()

const nombre = ref('')
const email = ref('')
const password = ref('')
const confirmar = ref('')
const enviando = ref(false)
const error = ref(null)

onMounted(async () => {
  await restore()
  if (isAuthenticated.value) navigateTo('/admin')
})

async function enviar() {
  error.value = null
  if (password.value !== confirmar.value) {
    error.value = new Error('Las contraseñas no coinciden.')
    return
  }

  enviando.value = true
  try {
    await register(nombre.value.trim(), email.value.trim(), password.value)
    await navigateTo('/admin')
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
      <p class="eyebrow">Cuenta nueva</p>
      <h1 class="auth-title">Crear cuenta</h1>
      <p class="lead">
        Con una cuenta puedes añadir y corregir registros del catálogo. Solo la cuenta
        administradora puede eliminar.
      </p>

      <AlertBox v-if="error" :message="error.message" :details="error.details" />

      <form class="form-grid" @submit.prevent="enviar">
        <label class="form-field">
          <span>Nombre completo</span>
          <input v-model="nombre" type="text" required minlength="2" autocomplete="name" />
        </label>

        <label class="form-field">
          <span>Correo electrónico</span>
          <input v-model="email" type="email" required autocomplete="username" />
        </label>

        <label class="form-field">
          <span>Contraseña (mínimo 8 caracteres)</span>
          <input v-model="password" type="password" required minlength="8" autocomplete="new-password" />
        </label>

        <label class="form-field">
          <span>Repetir contraseña</span>
          <input v-model="confirmar" type="password" required minlength="8" autocomplete="new-password" />
        </label>

        <button type="submit" class="btn" :disabled="enviando">
          {{ enviando ? 'Creando cuenta…' : 'Registrarme' }}
        </button>
      </form>

      <p class="auth-alt">
        ¿Ya tienes cuenta? <NuxtLink to="/login">Iniciar sesión</NuxtLink>
      </p>
    </div>
  </div>
</template>
