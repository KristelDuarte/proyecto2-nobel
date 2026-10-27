<script setup>
const links = [
  { to: '/', label: 'Inicio' },
  { to: '/categories', label: 'Categorías' },
  { to: '/countries', label: 'Países' },
  { to: '/years', label: 'Años' },
  { to: '/laureates', label: 'Galardonados' },
]

const { isAuthenticated, isAdmin, user, restore, logout } = useAuth()

onMounted(() => {
  restore()
})

function cerrarSesion() {
  logout()
  navigateTo('/')
}
</script>

<template>
  <header class="site-header">
    <div class="container header-inner">
      <NuxtLink to="/" class="brand" aria-label="Premios Nobel — Inicio">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9.5" stroke="#c9a227" stroke-width="1.6" />
            <path d="M12 4.5v15M4.5 12h15" stroke="#e7d6a1" stroke-width="0.8" />
            <path d="M7 7l10 10M17 7L7 17" stroke="#e7d6a1" stroke-width="0.8" />
            <circle cx="12" cy="12" r="1.4" fill="#c9a227" />
          </svg>
        </span>
        <span class="brand-text">
          <span class="brand-name">Premios Nobel</span>
          <span class="brand-sub">Catálogo 1901 – 2025</span>
        </span>
      </NuxtLink>

      <nav class="main-nav" aria-label="Navegación principal">
        <NuxtLink v-for="l in links" :key="l.to" :to="l.to">{{ l.label }}</NuxtLink>
      </nav>

      <div class="nav-auth">
        <template v-if="isAuthenticated">
          <NuxtLink to="/admin" class="nav-admin">Panel</NuxtLink>
          <span class="user-chip" :title="`${user?.name || ''} · ${user?.email || ''}`">
            <span class="user-avatar" aria-hidden="true">
              {{ initials(user?.name || user?.email || '?') }}
            </span>
            <span class="user-name">{{ user?.name || user?.email }}</span>
            <span v-if="isAdmin" class="role-badge">Administrador</span>
          </span>
          <button type="button" class="btn btn-ghost btn-sm" @click="cerrarSesion">Salir</button>
        </template>
        <template v-else>
          <NuxtLink to="/login" class="btn btn-ghost btn-sm">Entrar</NuxtLink>
          <NuxtLink to="/admin" class="btn btn-sm">Administrar</NuxtLink>
        </template>
      </div>
    </div>
  </header>
</template>
