// gestion y exploracion de listas del usuario

import { request, currentUser } from '../Modules/api.js';
import { toast, modal, confirmModal, esc } from '../Modules/ui.js';
import { openFicha } from './detalle.js';

let activeListId = null;

export async function listas() {
  const user = currentUser();
  if (!user) {
    return `
      <section class="workspace-page">
        <header class="page-header">
          <span class="eyebrow">TU COLECCIÓN</span>
          <h1>Mis listas</h1>
          <p>Organizá lo que ya viste y lo que todavía querés descubrir.</p>
        </header>
        <div class="empty-state glass">
          <div class="empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <h2>Iniciá sesión para armar tus listas</h2>
          <p>Guardá tus pendientes en "Quiero ver", organizá tus favoritas y creá listas temáticas personalizadas.</p>
          <a href="#/auth" class="btn primary">Iniciar sesión</a>
        </div>
      </section>
    `;
  }

  let lists = [];
  try {
    lists = await request('/lists');
  } catch {
    toast('No pudimos cargar tus listas', 'error');
  }

  if (!activeListId || !lists.some(l => l.id == activeListId)) {
    activeListId = lists[0]?.id || null;
  }

  const selectedList = lists.find(l => l.id == activeListId) || lists[0];
  const items = selectedList?.items || [];

  return `
    <section class="workspace-page">
      <header class="page-header">
        <div class="header-main">
          <span class="eyebrow">COLECCIONES & WATCHLISTS</span>
          <h1>Mis listas</h1>
          <p>Armá listas temáticas, organizá tus imprescindibles y compartí tu pasión cinéfila.</p>
        </div>
        <div class="header-actions">
          <button class="btn primary" id="btn-create-list">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Crear lista personalizada</span>
          </button>
        </div>
      </header>

      <div class="list-tabs-row">
        ${lists.map(l => `
          <button class="list-tab-card glass ${l.id == activeListId ? 'active' : ''}" data-listid="${l.id}">
            <div class="list-tab-type">${l.tipo.toUpperCase()}</div>
            <strong class="list-tab-name">${esc(l.nombre)}</strong>
            <span class="list-tab-count">${(l.items || []).length} títulos</span>
          </button>
        `).join('')}
      </div>

      ${selectedList ? `
        <div class="selected-list-view">
          <div class="list-header-banner glass">
            <div>
              <span class="eyebrow">${selectedList.tipo.toUpperCase()}</span>
              <h2>${esc(selectedList.nombre)}</h2>
              <p>${esc(selectedList.descripcion || 'Sin descripción.')}</p>
            </div>
            <div class="list-banner-actions">
              <button class="btn secondary" id="btn-add-item-to-list">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>Agregar título</span>
              </button>
              ${selectedList.tipo === 'personalizada' ? `
                <button class="btn ghost danger" id="btn-delete-active-list">Eliminar lista</button>
              ` : ''}
            </div>
          </div>

          <div class="list-items-grid">
            ${items.length === 0 ? `
              <div class="empty glass">
                <h3>Esta lista está vacía</h3>
                <p>Hacé click en "Agregar título" o guardá películas y series directamente desde el catálogo.</p>
              </div>
            ` : items.map(item => `
              <article class="poster-card list-poster-card" data-titleid="${item.id}">
                <button class="poster-action" aria-label="Abrir ${esc(item.title)}">
                  <div class="poster-shell">
                    <img src="${item.image || 'https://placehold.co/500x750/0f172a/22d3ee?text=' + encodeURIComponent(item.title)}" alt="${esc(item.title)}" loading="lazy" />
                    <span class="poster-type">${item.tipo === 'serie' ? 'SERIE' : 'PELÍCULA'}</span>
                    <span class="poster-score">
                      <svg class="card-star-svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                      ${Number(item.vote_average || 0).toFixed(1)}
                    </span>
                  </div>
                  <div class="poster-info">
                    <h3>${esc(item.title)}</h3>
                    <p>${item.year || '—'}</p>
                  </div>
                </button>
                <button class="btn-remove-from-list" data-titleid="${item.id}" title="Quitar de esta lista">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </article>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </section>
  `;
}

export function wireListas() {
  const user = currentUser();
  if (!user) return;

  // cambio de lista activa
  document.querySelectorAll('.list-tab-card').forEach(tab => {
    tab.addEventListener('click', async () => {
      activeListId = tab.dataset.listid;
      const main = document.querySelector('main.page-body');
      if (main) {
        main.innerHTML = await listas();
        wireListas();
      }
    });
  });

  // abrir ficha al hacer click en el poster
  document.querySelectorAll('.poster-action').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const card = btn.closest('.list-poster-card');
      const titleId = card?.dataset.titleid;
      if (titleId) openFicha(titleId);
    });
  });

  // quitar titulo de la lista activa
  document.querySelectorAll('.btn-remove-from-list').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const titleId = btn.dataset.titleid;
      confirmModal(
        'Quitar de la lista',
        '¿Deseás remover este título de la lista actual?',
        async () => {
          try {
            await request(`/lists/${activeListId}/items/${titleId}`, { method: 'DELETE' });
            toast('Título removido de la lista', 'ok');
            btn.closest('.list-poster-card')?.remove();
          } catch {
            toast('Error al quitar de la lista', 'error');
          }
        }
      );
    });
  });

  // crear nueva lista personalizada
  document.querySelector('#btn-create-list')?.addEventListener('click', () => {
    modal(
      'Crear nueva lista personalizada',
      `
        <div class="form-group">
          <label>Nombre de la lista:</label>
          <input type="text" id="new-list-name" placeholder="Ej: Películas de culto" required />
        </div>
        <div class="form-group">
          <label>Descripción:</label>
          <textarea id="new-list-desc" placeholder="Breve descripción o temática..."></textarea>
        </div>
      `,
      async () => {
        const name = document.querySelector('#new-list-name')?.value.trim();
        const desc = document.querySelector('#new-list-desc')?.value.trim();
        if (!name) {
          toast('Ingresá un nombre para la lista', 'error');
          return false;
        }
        try {
          const created = await request('/lists', {
            method: 'POST',
            body: JSON.stringify({ name, description: desc, type: 'personalizada' }),
          });
          activeListId = created.id;
          toast(`Lista "${name}" creada`, 'ok');
          location.hash = '/catalogo';
          setTimeout(() => { location.hash = '/listas'; }, 20);
        } catch {
          toast('Error al crear la lista', 'error');
        }
      }
    );
  });

  // eliminar lista personalizada actual
  document.querySelector('#btn-delete-active-list')?.addEventListener('click', () => {
    confirmModal(
      'Eliminar lista',
      '¿Estás seguro de que deseás eliminar esta lista personalizada? Los títulos permanecerán en el catálogo.',
      async () => {
        try {
          await request(`/lists/${activeListId}`, { method: 'DELETE' });
          toast('Lista eliminada', 'ok');
          activeListId = null;
          location.hash = '/catalogo';
          setTimeout(() => { location.hash = '/listas'; }, 20);
        } catch {
          toast('Error al eliminar la lista', 'error');
        }
      }
    );
  });

  // agregar titulo a la lista activa
  document.querySelector('#btn-add-item-to-list')?.addEventListener('click', async () => {
    try {
      const titles = await request('/catalog');
      const optionsHtml = titles.map(t => `<option value="${t.id}">${esc(t.title)} (${t.year || '—'})</option>`).join('');
      modal(
        'Agregar título a esta lista',
        `
          <div class="form-group">
            <label>Seleccionar película o serie:</label>
            <select id="modal-select-item">${optionsHtml}</select>
          </div>
        `,
        async () => {
          const titleId = document.querySelector('#modal-select-item')?.value;
          if (!titleId) return;
          try {
            await request(`/lists/${activeListId}/items`, {
              method: 'POST',
              body: JSON.stringify({ titleId }),
            });
            toast('Título agregado a la lista', 'ok');
            location.hash = '/catalogo';
            setTimeout(() => { location.hash = '/listas'; }, 20);
          } catch (err) {
            toast(err.data?.error === 'YA_EN_LISTA' ? 'Ya está en esta lista' : 'Error al agregar a la lista', 'error');
          }
        }
      );
    } catch {
      toast('No pudimos cargar el catálogo', 'error');
    }
  });
}