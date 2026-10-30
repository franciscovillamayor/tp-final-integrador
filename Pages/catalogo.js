// catalogo principal de peliculas y series

import { request, currentUser } from '../Modules/api.js';
import { esc, toast, modal } from '../Modules/ui.js';
import { openFicha } from './detalle.js?v=105';
import { render } from '../Scripts/app.js';

export async function catalogo() {
  let items = [];
  try {
    items = await request('/catalog');
  } catch {
    toast('No pudimos cargar el catálogo', 'error');
  }

  const user = currentUser();
  const isAdmin = user && (user.role === 'Administrador' || user.role === 'admin' || user.email === 'villamayorfran7@gmail.com' || user.email === 'franciscoxx458@gmail.com');

  const card = (item, index) => `
    <article class="poster-card" data-id="${item.id}" data-title="${esc(item.title)}" data-type="${item.type}" style="--delay:${index * 0.02}s">
      <button class="poster-action" aria-label="Abrir ${esc(item.title)}">
        <div class="poster-shell">
          <img src="${item.image || 'https://placehold.co/500x750/0a0a0a/ffffff?text=' + encodeURIComponent(item.title)}" alt="${esc(item.title)}" loading="lazy" />
          <span class="poster-type">${item.type === 'tv' ? 'SERIE' : 'PELÍCULA'}</span>
          <span class="poster-score">
            <svg class="card-star-svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            ${Number(item.vote_average || 0).toFixed(1)}
          </span>
        </div>
        <div class="poster-info">
          <h3>${esc(item.title)}</h3>
          <p>${item.year || '—'} · ${item.type === 'tv' ? 'Serie' : 'Película'}</p>
        </div>
      </button>
    </article>
  `;

  const series = items.filter(item => item.type === 'tv');
  const movies = items.filter(item => item.type === 'movie');

  return `
    <section class="discovery">
      <div class="graph-hero-wrap">
        <section class="graph-hero">
          <div class="hero-grid" aria-hidden="true"></div>
          <div class="hero-kicker"><span></span> CATÁLOGO DE SERIES & CINE</div>
        <h1>Una historia.<br><em>Muchos momentos.</em></h1>
        <p>Explorá todas las películas y series, compartí tus opiniones, descubrí la evolución de cada temporada con SeriesGraph interactivo y llevá tu registro cinéfilo.</p>
        <div class="hero-actions">
          <button class="btn primary" id="hero-explore">Explorar catálogo</button>
          <button class="btn hero-random" id="hero-random">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="16 3 21 3 21 8"></polyline>
              <line x1="4" y1="20" x2="21" y2="3"></line>
              <polyline points="21 16 21 21 16 21"></polyline>
              <line x1="15" y1="15" x2="21" y2="21"></line>
              <line x1="4" y1="4" x2="9" y2="9"></line>
            </svg>
            <span>Elegir al azar</span>
          </button>
          ${isAdmin ? `
            <button class="btn secondary" id="hero-add-title-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Agregar título</span>
            </button>
          ` : ''}
        </div>
        <div class="hero-stats">
          <div><strong>${series.length}</strong><span>series</span></div>
          <div><strong>${movies.length}</strong><span>películas</span></div>
          <div><strong>${items.length}</strong><span>títulos disponibles</span></div>
        </div>
      </section>
      </div>

      <section class="catalog-section" id="catalog-section">
        <div class="catalog-toolbar">
          <label class="catalog-search">
            <svg class="search-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input id="catalog-search" placeholder="Buscar por título de película o serie..." aria-label="Buscar" />
            <button id="catalog-do-search">Buscar</button>
          </label>
          <div class="toolbar-right">
            <div class="filter-list" aria-label="Filtros">
              <button class="filter active" data-filter="todos">Todos</button>
              <button class="filter" data-filter="tv">Series</button>
              <button class="filter" data-filter="movie">Películas</button>
            </div>
            ${isAdmin ? `
              <button class="btn primary small btn-catalog-add" id="btn-catalog-add">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>Nuevo título</span>
              </button>
            ` : ''}
          </div>
        </div>

        <div class="catalog-group" data-group="tv">
          <div class="catalog-heading">
            <div>
              <span class="eyebrow">01 / SERIES</span>
              <h2>Series</h2>
            </div>
            <p>${series.length} series en el catálogo</p>
          </div>
          <div class="poster-grid">
            ${series.map(card).join('')}
          </div>
        </div>

        <div class="catalog-group" data-group="movie">
          <div class="catalog-heading">
            <div>
              <span class="eyebrow">02 / PELÍCULAS</span>
              <h2>Películas</h2>
            </div>
            <p>${movies.length} películas en el catálogo</p>
          </div>
          <div class="poster-grid">
            ${movies.map(card).join('')}
          </div>
        </div>

        ${items.length ? '' : '<div class="empty glass"><h3>El catálogo está vacío</h3></div>'}
      </section>
    </section>
  `;
}

export function wireCatalogo() {
  const search = document.querySelector('#catalog-search');

  const apply = () => {
    const q = (search?.value || '').toLowerCase().trim();
    document.querySelectorAll('.poster-card').forEach(card => {
      const match = card.textContent.toLowerCase().includes(q);
      card.hidden = !match;
    });
  };

  const filterCards = filter => {
    document.querySelectorAll('.poster-card').forEach(card => {
      card.hidden = filter !== 'todos' && card.dataset.type !== filter;
    });
    document.querySelectorAll('.catalog-group').forEach(group => {
      group.hidden = filter !== 'todos' && group.dataset.group !== filter;
    });
  };

  document.querySelector('#catalog-do-search')?.addEventListener('click', apply);
  search?.addEventListener('input', apply);
  search?.addEventListener('keydown', event => { if (event.key === 'Enter') apply(); });

  document.querySelector('#hero-explore')?.addEventListener('click', () => {
    document.querySelector('#catalog-section')?.scrollIntoView({ behavior: 'smooth' });
  });

  // elegir al azar y abrir la ficha directamente
  document.querySelector('#hero-random')?.addEventListener('click', () => {
    const cards = [...document.querySelectorAll('.poster-card')];
    if (!cards.length) return;
    const picked = cards[Math.floor(Math.random() * cards.length)];
    picked.scrollIntoView({ behavior: 'smooth', block: 'center' });
    picked.animate(
      [{ transform: 'scale(0.95)', filter: 'brightness(1.5)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }],
      { duration: 500 }
    );
    setTimeout(() => {
      openFicha(picked.dataset.id);
    }, 400);
  });

  // filtros
  document.querySelectorAll('.filter').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      filterCards(button.dataset.filter);
      if (search?.value) search.value = '';
    });
  });

  // abrir ficha al hacer click en cualquier poster
  document.querySelectorAll('.poster-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      if (id) openFicha(id);
    });
  });

  // Todas las altas se realizan con el importador unificado (link IMDb, nombre o carga manual).
  const openAddTitleModal = () => {
    location.hash = '/moderacion';
    setTimeout(() => {
      document.querySelector('#btn-manual-title-add')?.click();
    }, 350);
    return;
    modal(
      'Agregar nueva serie o película',
      `
        <div class="form-group">
          <label>Título de la obra *</label>
          <input type="text" id="add-title-name" placeholder="Ej: Oppenheimer, Severance, Arcane..." required />
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
          <div class="form-group">
            <label>Tipo</label>
            <select id="add-title-type">
              <option value="movie">Película</option>
              <option value="tv">Serie (con SeriesGraph)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Año de estreno</label>
            <input type="number" id="add-title-year" value="${new Date().getFullYear()}" />
          </div>
        </div>
        <div class="form-group">
          <label>Calificación IMDb inicial (1.0 a 10.0)</label>
          <input type="number" step="0.1" id="add-title-score" placeholder="8.5" value="8.5" min="1" max="10" />
        </div>
        <div id="add-series-options" style="display: none; padding: 0.8rem; background: var(--bg-card-2); border-radius: 8px; margin-bottom: 0.8rem; border: 1px solid var(--border);">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
            <div class="form-group" style="margin: 0;">
              <label>Cantidad de temporadas</label>
              <input type="number" id="add-title-seasons" value="2" min="1" max="12" />
            </div>
            <div class="form-group" style="margin: 0;">
              <label>Capítulos por temporada</label>
              <input type="number" id="add-title-episodes" value="8" min="1" max="24" />
            </div>
          </div>
          <small style="display: block; margin-top: 0.4rem; color: var(--text-dim);">Se generará la grilla 2D de SeriesGraph interactiva para cada capítulo.</small>
        </div>
        <div class="form-group">
          <label>URL de imagen póster (opcional)</label>
          <input type="url" id="add-title-poster" placeholder="https://image.tmdb.org/... o https://m.media-amazon.com/..." />
        </div>
        <div class="form-group">
          <label>Sinopsis</label>
          <textarea id="add-title-overview" rows="3" placeholder="Descripción general de la trama..."></textarea>
        </div>
      `,
      async () => {
        const title = document.querySelector('#add-title-name')?.value.trim();
        const type = document.querySelector('#add-title-type')?.value;
        const year = document.querySelector('#add-title-year')?.value;
        const score = document.querySelector('#add-title-score')?.value;
        const poster = document.querySelector('#add-title-poster')?.value.trim();
        const overview = document.querySelector('#add-title-overview')?.value.trim();
        const seasons_count = document.querySelector('#add-title-seasons')?.value;
        const episodes_per_season = document.querySelector('#add-title-episodes')?.value;

        if (!title) {
          toast('El título es obligatorio', 'error');
          return false;
        }

        try {
          await request('/catalog', {
            method: 'POST',
            body: JSON.stringify({
              title,
              type,
              year,
              vote_average: score,
              poster,
              overview,
              seasons_count,
              episodes_per_season
            }),
          });
          toast(`"${title}" agregado exitosamente al catálogo`, 'ok');
          render();
        } catch (err) {
          toast(err.data?.error || err.message || 'No se pudo agregar el título', 'error');
          return false;
        }
      }
    );

    // Toggle de opciones de series en el modal
    setTimeout(() => {
      const typeSelect = document.querySelector('#add-title-type');
      const seriesOpt = document.querySelector('#add-series-options');
      if (typeSelect && seriesOpt) {
        typeSelect.addEventListener('change', () => {
          seriesOpt.style.display = typeSelect.value === 'tv' ? 'block' : 'none';
        });
      }
    }, 50);
  };

  document.querySelector('#btn-catalog-add')?.addEventListener('click', openAddTitleModal);
  document.querySelector('#hero-add-title-btn')?.addEventListener('click', openAddTitleModal);
}
