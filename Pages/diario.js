// pagina del diario personal de visualizaciones

import { request, currentUser } from '../Modules/api.js';
import { toast, modal, confirmModal, esc, formatDate } from '../Modules/ui.js';
import { openFicha } from './detalle.js';

export async function diario() {
  const user = currentUser();
  if (!user) {
    return `
      <section class="workspace-page">
        <header class="page-header">
          <span class="eyebrow">HISTORIAL PERSONAL</span>
          <h1>Mi diario de visualizaciones</h1>
          <p>Un registro cronológico de cada película y episodio que pasó por tu pantalla.</p>
        </header>
        <div class="empty-state glass">
          <div class="empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>
          </div>
          <h2>Iniciá sesión para llevar tu diario</h2>
          <p>Registrá tus noches de cine, guardá las fechas en que viste cada obra y calificá tus historias favoritas.</p>
          <a href="#/auth" class="btn primary">Iniciar sesión</a>
        </div>
      </section>
    `;
  }

  let entries = [];
  try {
    entries = await request('/diary');
  } catch {
    toast('No pudimos cargar tu diario', 'error');
  }

  const movieCount = entries.filter(e => e.tipo === 'pelicula' || e.tipo === 'movie').length;
  const seriesCount = entries.filter(e => e.tipo === 'serie' || e.tipo === 'tv').length;

  return `
    <section class="workspace-page">
      <header class="page-header">
        <div class="header-main">
          <span class="eyebrow">HISTORIAL CINEMATOGRÁFICO</span>
          <h1>Mi diario</h1>
          <p>Llevá la cuenta de todo lo que mirás con fecha, notas y valoraciones.</p>
        </div>
        <div class="header-actions">
          <button class="btn primary" id="btn-add-diary-entry">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Registrar visualización</span>
          </button>
        </div>
      </header>

      <div class="diary-metrics-grid">
        <div class="metric-card glass">
          <span class="metric-label">TOTAL VISUALIZACIONES</span>
          <strong class="metric-value">${entries.length}</strong>
        </div>
        <div class="metric-card glass">
          <span class="metric-label">PELÍCULAS VISTAS</span>
          <strong class="metric-value">${movieCount}</strong>
        </div>
        <div class="metric-card glass">
          <span class="metric-label">SERIES VISTAS</span>
          <strong class="metric-value">${seriesCount}</strong>
        </div>
      </div>

      <div class="diary-layout">
        <div class="diary-feed">
          ${entries.length === 0 ? `
            <div class="empty glass">
              <div class="empty-rule"></div>
              <span>TIEMPO DE PANTALLA</span>
              <h2>Tu diario está en blanco</h2>
              <p>Hacé click en "Registrar visualización" o abrí un título del catálogo para agregarlo a tu registro.</p>
            </div>
          ` : `
            <div class="diary-timeline">
              ${entries.map(e => `
                <article class="diary-item glass" data-id="${e.id}">
                  <div class="diary-poster" data-titleid="${e.titulo_id}">
                    <img src="${e.image || 'https://placehold.co/120x180/0f172a/22d3ee?text=Poster'}" alt="${esc(e.title)}" />
                  </div>
                  <div class="diary-content">
                    <div class="diary-title-row">
                      <h3 class="diary-title" data-titleid="${e.titulo_id}">${esc(e.title)}</h3>
                      <span class="badge ${e.tipo === 'serie' ? 'badge-series' : 'badge-movie'}">${e.tipo === 'serie' ? 'Serie' : 'Película'}</span>
                    </div>
                    <div class="diary-meta-row">
                      <span class="diary-date">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        Visto el ${formatDate(e.fecha_visto)}
                      </span>
                    </div>
                  </div>
                  <div class="diary-actions">
                    <button class="btn icon-btn danger btn-delete-diary" data-id="${e.id}" title="Eliminar entrada">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>
                    </button>
                  </div>
                </article>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </section>
  `;
}

export function wireDiario() {
  const user = currentUser();
  if (!user) return;

  // abrir ficha al tocar poster o titulo
  document.querySelectorAll('[data-titleid]').forEach(el => {
    el.addEventListener('click', () => {
      openFicha(el.dataset.titleid);
    });
  });

  // eliminar entrada de diario
  document.querySelectorAll('.btn-delete-diary').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      confirmModal(
        'Eliminar del diario',
        '¿Deseás borrar esta visualización de tu historial?',
        async () => {
          try {
            await request(`/diary/${id}`, { method: 'DELETE' });
            toast('Visualización eliminada', 'ok');
            btn.closest('.diary-item')?.remove();
          } catch {
            toast('Error al eliminar visualización', 'error');
          }
        }
      );
    });
  });

  // agregar visualizacion
  document.querySelector('#btn-add-diary-entry')?.addEventListener('click', async () => {
    try {
      const titles = await request('/catalog');
      const today = new Date().toISOString().slice(0, 10);
      const optionsHtml = titles.map(t => `<option value="${t.id}">${esc(t.title)} (${t.year || '—'})</option>`).join('');

      modal(
        'Registrar nueva visualización',
        `
          <div class="form-group">
            <label>Seleccioná película o serie:</label>
            <select id="diary-select-title">${optionsHtml}</select>
          </div>
          <div class="form-group">
            <label>Fecha de visualización:</label>
            <input type="date" id="diary-modal-date" value="${today}" />
          </div>
        `,
        async () => {
          const titleId = document.querySelector('#diary-select-title')?.value;
          const watchedAt = document.querySelector('#diary-modal-date')?.value || today;
          if (!titleId) return;
          try {
            await request('/diary', {
              method: 'POST',
              body: JSON.stringify({ titleId, watchedAt }),
            });
            toast('Visualización registrada con éxito', 'ok');
            location.hash = '/catalogo';
            setTimeout(() => { location.hash = '/diario'; }, 50);
          } catch {
            toast('Error al registrar visualización', 'error');
          }
        }
      );
    } catch {
      toast('No se pudo cargar el catálogo', 'error');
    }
  });
}