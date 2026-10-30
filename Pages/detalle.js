// ficha detallada de pelicula o serie con seriesgraph, calificaciones y resenas

import { request, currentUser } from '../Modules/api.js';
import { toast, modal, confirmModal, renderSeriesGraph, esc, formatDate } from '../Modules/ui.js?v=5';

export async function openFicha(titleId) {
  try {
    const item = await request(`/catalog/${titleId}`);
    renderFichaModal(item);
  } catch (err) {
    toast('No pudimos cargar la información del título', 'error');
  }
}

function renderFichaModal(item) {
  const existing = document.querySelector('.ficha-modal-backdrop');
  if (existing) existing.remove();

  const user = currentUser();
  const isSeries = item.type === 'tv' || item.tipo === 'serie';

  const modalEl = document.createElement('div');
  modalEl.className = 'ficha-modal-backdrop';

  modalEl.innerHTML = `
    <div class="ficha-container glass" role="dialog" aria-modal="true" style="${item.backdrop ? `background-image: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(10,10,10,0.98) 60%), url('${item.backdrop}'); background-size: cover; background-position: center top;` : ''}">
      <button class="icon ficha-close" aria-label="Cerrar ficha"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>

      ${isSeries ? `
        <!-- FICHA DE SERIE ESTILO SERIESGRAPH -->
        <div class="ficha-series-hero">
          <div id="series-graph-container"></div>
        </div>

        <section class="ficha-section">
          <div class="section-title-wrap">
            <span class="eyebrow">EPISODIOS</span>
            <h3>Todos los capítulos de la serie (${(item.episodes || []).length})</h3>
          </div>
          <div class="episodes-list">
            ${(item.episodes || []).map(ep => `
              <div class="episode-row glass">
                <div class="ep-num">T${ep.temporada_numero || 1} · E${ep.numero}</div>
                <div class="ep-info">
                  <strong>${esc(ep.nombre)}</strong>
                  <p>${esc(ep.sinopsis || '')}</p>
                </div>
                <div class="ep-score">
                  <svg class="card-star-svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                  ${Number(ep.nota_tmdb || 0).toFixed(1)} <small>IMDb</small>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      ` : `
        <!-- FICHA DE PELÍCULA ESTILO MINIMALISTA -->
        <div class="ficha-hero">
          <div class="ficha-hero-content">
            <div class="ficha-poster">
              <img src="${item.image || 'https://placehold.co/500x750/0a0a0a/ffffff?text=' + encodeURIComponent(item.title)}" alt="${esc(item.title)}" />
            </div>
            <div class="ficha-meta">
              <span class="badge badge-movie">PELÍCULA</span>
              <h1 class="ficha-title">${esc(item.title)}</h1>
              <div class="ficha-subline">
                <span>${item.year || '—'}</span>
                <span>·</span>
                <span class="ficha-tmdb-score">
                  <svg class="card-star-svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                  ${Number(item.vote_average || 0).toFixed(1)} <small>IMDb</small>
                </span>
              </div>
              <p class="ficha-overview">${esc(item.overview || 'Sin descripción disponible.')}</p>

              <div class="ficha-actions">
                <div class="action-buttons">
                  <button class="btn secondary" id="btn-add-diary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Registrar en Diario
                  </button>
                  <button class="btn secondary" id="btn-add-list">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    Guardar en Lista
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `}

      <section class="ficha-section">
        <div class="section-title-wrap">
          <span class="eyebrow">COMUNIDAD</span>
          <h3>Reseñas y comentarios (${(item.reviews || []).length})</h3>
        </div>

        <div class="review-compose glass">
          <h4>Escribir tu reseña</h4>
          <textarea id="review-body" placeholder="¿Qué te pareció ${esc(item.title)}? Compartí tu opinión..."></textarea>
          <div class="compose-footer">
            <button class="btn primary" id="btn-post-review">Publicar reseña</button>
          </div>
        </div>

        <div class="reviews-feed" id="reviews-feed">
          ${(item.reviews || []).length === 0 ? '<div class="glass empty-reviews"><p>Sé el primero en escribir una reseña sobre este título.</p></div>' : ''}
          ${(item.reviews || []).map(r => renderReviewItem(r, user)).join('')}
        </div>
      </section>
    </div>
  `;

  document.body.classList.add('modal-open');
  document.body.appendChild(modalEl);

  const close = () => {
    modalEl.classList.add('modal-closing');
    setTimeout(() => {
      modalEl.remove();
      if (!document.querySelector('.modal-backdrop, .ficha-modal-backdrop')) {
        document.body.classList.remove('modal-open');
      }
    }, 200);
  };
  modalEl.querySelector('.ficha-close').onclick = close;
  modalEl.addEventListener('click', e => {
    if (e.target === modalEl) close();
  });

  // renderizar matriz seriesgraph si es serie
  if (isSeries) {
    const graphContainer = modalEl.querySelector('#series-graph-container');
    renderSeriesGraph(graphContainer, item.episodes || [], item);
  }

  // registrar en diario
  modalEl.querySelector('#btn-add-diary')?.addEventListener('click', () => {
    if (!user) {
      toast('Iniciá sesión para registrar visualizaciones', 'error');
      location.hash = '/auth';
      close();
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    modal(
      `Registrar "${item.title}" en Diario`,
      `
        <div class="form-group">
          <label>Fecha en que lo viste:</label>
          <input type="date" id="diary-date" value="${today}" />
        </div>
        <div class="form-group">
        </div>
      `,
      async () => {
        const date = document.querySelector('#diary-date')?.value || today;
        const score = document.querySelector('#diary-score')?.value || 5;
        try {
          await request('/diary', {
            method: 'POST',
            body: JSON.stringify({ titleId: item.id, watchedAt: date, score }),
          });
          toast(`Agregado a tu diario (${date})`, 'ok');
        } catch {
          toast('Error al guardar en diario', 'error');
        }
      }
    );
  });

  // guardar en lista
  modalEl.querySelector('#btn-add-list')?.addEventListener('click', async () => {
    if (!user) {
      toast('Iniciá sesión para gestionar listas', 'error');
      location.hash = '/auth';
      close();
      return;
    }
    try {
      const lists = await request('/lists');
      const optionsHtml = lists.map(l => `<option value="${l.id}">${esc(l.nombre)} (${l.tipo})</option>`).join('');
      modal(
        `Guardar "${item.title}" en lista`,
        `
          <div class="form-group">
            <label>Seleccioná la lista:</label>
            <select id="select-target-list">${optionsHtml}</select>
          </div>
        `,
        async () => {
          const listId = document.querySelector('#select-target-list')?.value;
          if (!listId) return;
          try {
            await request(`/lists/${listId}/items`, {
              method: 'POST',
              body: JSON.stringify({ titleId: item.id }),
            });
            toast('Título guardado en la lista', 'ok');
          } catch (err) {
            toast(err.data?.error === 'YA_EN_LISTA' ? 'Ya estaba en esa lista' : 'Error al guardar en lista', 'error');
          }
        }
      );
    } catch {
      toast('No pudimos cargar tus listas', 'error');
    }
  });


  // publicar resena
  modalEl.querySelector('#btn-post-review')?.addEventListener('click', async () => {
    if (!user) {
      toast('Iniciá sesión para publicar reseñas', 'error');
      location.hash = '/auth';
      close();
      return;
    }
    const txt = modalEl.querySelector('#review-body')?.value.trim();
    if (!txt) {
      toast('Escribí algo en tu reseña', 'error');
      return;
    }
    try {
      const created = await request('/reviews', {
        method: 'POST',
        body: JSON.stringify({ titleId: item.id, body: txt }),
      });
      toast('Reseña publicada', 'ok');
      modalEl.querySelector('#review-body').value = '';
      const feed = modalEl.querySelector('#reviews-feed');
      feed.querySelector('.empty-reviews')?.remove();
      const div = document.createElement('div');
      div.innerHTML = renderReviewItem(created, user);
      feed.prepend(div.firstElementChild);
      wireReviewCard(feed.firstElementChild, user);
    } catch {
      toast('No pudimos publicar la reseña', 'error');
    }
  });

  // wire de acciones en cada resena (comentar, reportar, eliminar)
  modalEl.querySelectorAll('.review-card').forEach(card => wireReviewCard(card, user));


}

function renderReviewItem(r, user) {
  const canDelete = user && (user.id === r.usuario_id || user.role === 'Moderador' || user.role === 'Administrador');
  const canReportReview = user && Number(user.id) !== Number(r.usuario_id);
  return `
    <article class="review-card glass" data-id="${r.id}">
      <div class="review-header">
        <div class="review-user">
          <span class="user-avatar">${(r.autor || 'U')[0]}</span>
          <div>
            <strong>${esc(r.autor || 'Usuario')}</strong>
            <small>${formatDate(r.fecha)}</small>
          </div>
        </div>
        <div class="review-actions">
          ${canReportReview ? `<button class="btn icon-btn btn-report-review" title="Reportar contenido">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
            Reportar
          </button>` : ''}
          ${canDelete ? `<button class="btn icon-btn danger btn-delete-review" title="Eliminar reseña"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg></button>` : ''}
        </div>
      </div>
      <p class="review-text">${esc(r.texto)}</p>

      <div class="comments-section">
        <div class="comments-list">
          ${(r.comments || []).map(c => `
            <div class="comment-bubble" data-comment-id="${c.id}">
              <div><strong>${esc(c.autor || 'Usuario')}:</strong> <span class="comment-text">${esc(c.texto)}</span></div>
              <div class="comment-actions">
                ${user && Number(user.id) !== Number(c.usuario_id) ? '<button class="btn icon-btn btn-report-comment" title="Reportar comentario">Reportar</button>' : ''}
                ${user && Number(user.id) === Number(c.usuario_id) ? '<button class="btn icon-btn btn-edit-comment" title="Editar comentario">Editar</button><button class="btn icon-btn danger btn-delete-comment" title="Eliminar comentario">Eliminar</button>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="comment-input-row">
          <input type="text" class="comment-input" placeholder="Responder a esta reseña..." />
          <button class="btn small btn-send-comment">Enviar</button>
        </div>
      </div>
    </article>
  `;
}

function wireReviewCard(card, user) {
  const reviewId = card.dataset.id;

  // reportar resena
  card.querySelector('.btn-report-review')?.addEventListener('click', () => {
    if (!user) {
      toast('Iniciá sesión para reportar contenido', 'error');
      return;
    }
    modal(
      'Reportar reseña',
      `
        <div class="form-group">
          <label>Motivo del reporte:</label>
          <select id="report-reason-select">
            <option value="Spam o publicidad">Spam o publicidad</option>
            <option value="Spoilers sin aviso">Spoilers sin aviso</option>
            <option value="Lenguaje ofensivo o acoso">Lenguaje ofensivo o acoso</option>
            <option value="Contenido inapropiado">Contenido inapropiado</option>
          </select>
        </div>
      `,
      async () => {
        const reason = document.querySelector('#report-reason-select')?.value;
        try {
          await request('/reports', {
            method: 'POST',
            body: JSON.stringify({ targetType: 'resena', targetId: reviewId, reason }),
          });
          toast('Reporte enviado al equipo de moderación', 'ok');
        } catch {
          toast('Error al enviar reporte', 'error');
        }
      }
    );
  });

  // eliminar resena
  card.querySelector('.btn-delete-review')?.addEventListener('click', () => {
    confirmModal('Eliminar reseña', '¿Estás seguro de que deseás eliminar esta reseña?', async () => {
      try {
        await request(`/reviews/${reviewId}`, { method: 'DELETE' });
        toast('Reseña eliminada', 'ok');
        card.remove();
      } catch {
        toast('No se pudo eliminar la reseña', 'error');
      }
    });
  });

  // agregar comentario
  const input = card.querySelector('.comment-input');
  const btn = card.querySelector('.btn-send-comment');
  const send = async () => {
    if (!user) {
      toast('Iniciá sesión para comentar', 'error');
      return;
    }
    const txt = input.value.trim();
    if (!txt) return;
    try {
      const com = await request('/comments', {
        method: 'POST',
        body: JSON.stringify({ reviewId, body: txt }),
      });
      input.value = '';
      const list = card.querySelector('.comments-list');
      const b = document.createElement('div');
      b.className = 'comment-bubble';
      b.dataset.commentId = com.id;
      b.innerHTML = `
        <div><strong>${esc(user.name)}:</strong> <span class="comment-text">${esc(com.texto)}</span></div>
        <div class="comment-actions">
          <button class="btn icon-btn btn-edit-comment" title="Editar comentario">Editar</button>
          <button class="btn icon-btn danger btn-delete-comment" title="Eliminar comentario">Eliminar</button>
        </div>
      `;
      list.appendChild(b);
      wireNewCommentActions(b, card);
      toast('Comentario publicado', 'ok');
    } catch {
      toast('Error al comentar', 'error');
    }
  };

  btn?.addEventListener('click', send);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  card.querySelectorAll('.comment-bubble').forEach(bubble => {
    const commentId = bubble.dataset.commentId;

    bubble.querySelector('.btn-edit-comment')?.addEventListener('click', () => {
      const text = bubble.querySelector('.comment-text')?.textContent || '';
      modal('Editar comentario', `
        <div class="form-group">
          <label>Comentario:</label>
          <textarea id="edit-comment-text">${esc(text)}</textarea>
        </div>
      `, async () => {
        const nextText = document.querySelector('#edit-comment-text')?.value.trim();
        if (!nextText) return;
        try {
          await request(`/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ body: nextText }) });
          bubble.querySelector('.comment-text').textContent = nextText;
          toast('Comentario editado', 'ok');
        } catch {
          toast('No se pudo editar el comentario', 'error');
        }
      });
    });

    bubble.querySelector('.btn-delete-comment')?.addEventListener('click', () => {
      confirmModal('Eliminar comentario', '¿Estás seguro de que querés eliminar tu comentario?', async () => {
        try {
          await request(`/comments/${commentId}`, { method: 'DELETE' });
          bubble.remove();
          toast('Comentario eliminado', 'ok');
        } catch {
          toast('No se pudo eliminar el comentario', 'error');
        }
      });
    });

    bubble.querySelector('.btn-report-comment')?.addEventListener('click', () => {
      modal('Reportar comentario', `
        <div class="form-group">
          <label>Motivo del reporte:</label>
          <select id="report-comment-reason">
            <option value="Spam o publicidad">Spam o publicidad</option>
            <option value="Lenguaje ofensivo o acoso">Lenguaje ofensivo o acoso</option>
            <option value="Contenido inapropiado">Contenido inapropiado</option>
          </select>
        </div>
      `, async () => {
        const reason = document.querySelector('#report-comment-reason')?.value;
        try {
          await request('/reports', {
            method: 'POST',
            body: JSON.stringify({ targetType: 'comentario', targetId: commentId, reason }),
          });
          toast('Reporte enviado al equipo de moderación', 'ok');
        } catch (err) {
          toast(err.data?.error === 'REPORTE_DUPLICADO' ? 'Ya reportaste este comentario' : 'Error al enviar reporte', 'error');
        }
      });
    });
  });
}

function wireNewCommentActions(bubble, card) {
  const commentId = bubble.dataset.commentId;
  bubble.querySelector('.btn-edit-comment')?.addEventListener('click', () => {
    const text = bubble.querySelector('.comment-text')?.textContent || '';
    modal('Editar comentario', `
      <div class="form-group">
        <label>Comentario:</label>
        <textarea id="edit-comment-text">${esc(text)}</textarea>
      </div>
    `, async () => {
      const nextText = document.querySelector('#edit-comment-text')?.value.trim();
      if (!nextText) return;
      await request(`/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ body: nextText }) });
      bubble.querySelector('.comment-text').textContent = nextText;
      toast('Comentario editado', 'ok');
    });
  });
  bubble.querySelector('.btn-delete-comment')?.addEventListener('click', () => {
    confirmModal('Eliminar comentario', '¿Estás seguro de que querés eliminar tu comentario?', async () => {
      await request(`/comments/${commentId}`, { method: 'DELETE' });
      bubble.remove();
      toast('Comentario eliminado', 'ok');
    });
  });
}
