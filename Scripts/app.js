// punto de entrada de la aplicacion spa, enrutador y navegacion

import { catalogo, wireCatalogo } from '../Pages/catalogo.js?v=110';
import { authPage } from '../Pages/auth.js?v=114';
import { wireAuth, logout } from './auth.js?v=114';
import { diario, wireDiario } from '../Pages/diario.js?v=110';
import { listas, wireListas } from '../Pages/listas.js?v=110';
import { moderacion, wireModeracion } from '../Pages/moderacion.js?v=110';
import { baneo, wireBaneo } from '../Pages/baneo.js?v=110';
import { perfil, wirePerfil } from '../Pages/perfil.js?v=110';
import { currentUser } from '../Modules/api.js';
import { confirmModal } from '../Modules/ui.js';

const app = document.querySelector('#app');

const routes = {
  catalogo: { render: catalogo, wire: wireCatalogo },
  diario: { render: diario, wire: wireDiario },
  listas: { render: listas, wire: wireListas },
  moderacion: { render: moderacion, wire: wireModeracion },
  baneo: { render: baneo, wire: wireBaneo },
  perfil: { render: perfil, wire: wirePerfil },
};

function getThemeIcon(theme) {
  if (theme === 'dark') {
    // Icono sol para pasar a modo claro
    return `
      <svg class="theme-icon theme-icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
    `;
  }
  // Icono luna para pasar a modo oscuro
  return `
    <svg class="theme-icon theme-icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  `;
}

function toggleTheme() {
  const html = document.documentElement;
  const nextTheme = html.dataset.bsTheme === 'light' ? 'dark' : 'light';
  html.dataset.bsTheme = nextTheme;
  localStorage.setItem('ss_theme', nextTheme);
  document.querySelectorAll('#theme-toggle').forEach(btn => {
    btn.innerHTML = getThemeIcon(nextTheme);
    btn.setAttribute('aria-label', nextTheme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  });
}

document.addEventListener('click', e => {
  if (e.target.closest('#theme-toggle')) {
    e.preventDefault();
    e.stopPropagation();
    toggleTheme();
  }
});

export async function render() {
  const hash = location.hash.slice(1) || '/catalogo';
  const route = hash.replace(/^\//, '').split('?')[0];

  const user = currentUser();

  // ruta especial de autenticacion
  if (route === 'auth') {
    app.innerHTML = `
      ${nav(user)}
      <main class="page-body">${authPage()}</main>
    `;
    wireAuth();
    return;
  }

  // ruta especial de baneo
  if (route === 'baneo') {
    app.innerHTML = `
      ${nav(user)}
      <main class="page-body">${await baneo()}</main>
    `;
    wireBaneo();
    return;
  }

  const handler = routes[route] || routes.catalogo;
  const viewHtml = await handler.render();

  app.innerHTML = `
    ${nav(user)}
    <main class="page-body">${viewHtml}</main>
  `;

  if (handler.wire) {
    handler.wire();
  }
}

function nav(user) {
  const hash = location.hash.slice(1) || '/catalogo';
  const current = hash.replace(/^\//, '').split('?')[0];
  const currentTheme = document.documentElement.dataset.bsTheme || 'dark';

  const canModerate = user && (user.role === 'Moderador' || user.role === 'Administrador' || user.role === 'admin' || user.email === 'villamayorfran7@gmail.com' || user.email === 'franciscoxx458@gmail.com');

  return `
    <nav class="navbar navbar-expand-lg glass">
      <div class="nav-inner container-fluid">
        <a class="brand navbar-brand" href="#/catalogo">
          <span class="brand-icon">S</span>
          <span class="brand-name">SERIESCORE</span>
        </a>

        <div class="nav-mobile-actions">
          <button id="theme-toggle" class="icon theme-toggle" title="Alternar tema claro/oscuro" aria-label="Cambiar tema">
            ${getThemeIcon(currentTheme)}
          </button>
          <button class="navbar-toggler ss-navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavigation" aria-controls="mainNavigation" aria-expanded="false" aria-label="Abrir navegación">
            <span class="navbar-toggler-icon"></span>
          </button>
        </div>

        <div class="collapse navbar-collapse" id="mainNavigation">
          <div class="nav-links ms-lg-auto me-lg-4">
          <a class="${current.includes('catalogo') ? 'active' : ''}" href="#/catalogo">Catálogo</a>
          <a class="${current.includes('diario') ? 'active' : ''}" href="#/diario">Diario</a>
          <a class="${current.includes('listas') ? 'active' : ''}" href="#/listas">Listas</a>
          ${canModerate ? `
            <a class="${current.includes('moderacion') ? 'active mod-link' : 'mod-link'}" href="#/moderacion">
              <svg class="nav-svg-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span>Moderación</span>
            </a>
          ` : ''}
        </div>

        <div class="nav-actions">
          ${user ? `
            <a class="user-chip" href="#/perfil" aria-label="Ver perfil de ${user.name}">
              <span class="user-chip-avatar">${(user.name || 'U')[0].toUpperCase()}</span>
              <span class="user-chip-name">${user.name}</span>
              <span class="user-chip-role">${user.role}</span>
              <button id="btn-logout" class="icon-btn logout-btn" title="Cerrar sesión" aria-label="Cerrar sesión">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </a>
          ` : `
            <a class="btn primary small" href="#/auth">Ingresar</a>
          `}
        </div>
        </div>
      </div>
    </nav>
  `;
}

// listener global de clics en barra de navegacion
app.addEventListener('click', async e => {
  if (e.target.closest('#btn-logout')) {
    confirmModal(
      'Cerrar sesión',
      '¿Estás seguro de que querés cerrar tu sesión?',
      async () => {
        await logout();
        location.hash = '/auth';
        await render();
      },
      { confirmText: 'Cerrar sesión', danger: true }
    );
  }

  const navLink = e.target.closest('.nav-links a');
  if (navLink) {
    const navigation = document.querySelector('#mainNavigation');
    if (navigation?.classList.contains('show')) {
      bootstrap.Collapse.getOrCreateInstance(navigation).hide();
    }
  }

});

// inicializacion de tema y enrutador
const savedTheme = localStorage.getItem('ss_theme') || 'dark';
document.documentElement.dataset.bsTheme = savedTheme;

window.addEventListener('hashchange', render);
render();
