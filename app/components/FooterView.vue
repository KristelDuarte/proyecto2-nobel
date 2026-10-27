<script setup>
const year = new Date().getFullYear()

const categorias = ref([])

onMounted(async () => {
  try {
    const { data } = await listResource('categories', { limit: 10 })
    categorias.value = data
  } catch {
    categorias.value = []
  }
})
</script>

<template>
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <h4>Premios Nobel</h4>
          <p class="mb-0" style="max-width: 42ch">
            Un recorrido por más de un siglo de premios Nobel: quiénes los recibieron,
            en qué disciplinas y de dónde vinieron.
          </p>
        </div>
        <div>
          <h4>Explorar</h4>
          <ul>
            <li><NuxtLink to="/">Inicio</NuxtLink></li>
            <li><NuxtLink to="/categories">Categorías</NuxtLink></li>
            <li><NuxtLink to="/countries">Países</NuxtLink></li>
            <li><NuxtLink to="/years">Años</NuxtLink></li>
            <li><NuxtLink to="/laureates">Galardonados</NuxtLink></li>
          </ul>
        </div>
        <div>
          <h4>Categorías</h4>
          <ul>
            <li v-for="c in categorias" :key="c.key">
              <NuxtLink :to="`/categories/${c.key}`">{{ c.name }}</NuxtLink>
            </li>
          </ul>
        </div>
        <div>
          <h4>Tu cuenta</h4>
          <ul>
            <li><NuxtLink to="/login">Iniciar sesión</NuxtLink></li>
            <li><NuxtLink to="/register">Crear una cuenta</NuxtLink></li>
            <li><NuxtLink to="/admin">Gestionar el catálogo</NuxtLink></li>
          </ul>
        </div>
      </div>

      <div class="footer-note">
        <span>
          Datos: Nobel Prize Outreach AB · © The Nobel Foundation. Contenido bajo licencia
          <a
            href="https://www.nobelprize.org/about/terms-of-use-for-api-nobelprize-org-and-data-nobelprize-org/"
            target="_blank"
            rel="noopener noreferrer"
            >CC BY 4.0</a
          >.
        </span>
        <span>© {{ year }} Catálogo de los Premios Nobel</span>
      </div>
    </div>
  </footer>
</template>
