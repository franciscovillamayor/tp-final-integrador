// componentes de interfaz visual y graficos interactivos

export function toast(message, type = 'ok') {
  const container = document.querySelector('#toasts') || (() => {
    const el = document.createElement('div');
    el.id = 'toasts';
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    return el;
  })();

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;

  let iconSvg = '';
  if (type === 'ok') {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  } else {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  el.innerHTML = `<span class="toast-icon">${iconSvg}</span><span class="toast-text">${esc(message)}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('toast-fadeout');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// modal personalizado
export function modal(title, body, onConfirm = null, options = {}) {
  const existing = document.querySelector('.modal-backdrop');
  if (existing) existing.remove();

  document.body.classList.add('modal-open');

  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  const showCancel = options.showCancel !== false && onConfirm;
  const confirmText = options.confirmText || 'Confirmar';
  const cancelText = options.cancelText || 'Cancelar';
  const confirmClass = options.danger ? 'btn danger' : 'btn primary';
  const cardExtraClass = options.size === 'lg' ? ' modal-card-lg' : '';

  el.innerHTML = `
    <div class="modal-card glass${cardExtraClass}" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h2>${esc(title)}</h2>
        <button class="icon modal-close" aria-label="Cerrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="modal-body">${typeof body === 'string' ? body : ''}</div>
      <div class="modal-footer">
        ${showCancel ? `<button class="btn ghost modal-cancel">${cancelText}</button>` : ''}
        ${onConfirm ? `<button class="${confirmClass} modal-confirm">${confirmText}</button>` : `<button class="btn primary modal-close-btn">Aceptar</button>`}
      </div>
    </div>
  `;

  if (typeof body !== 'string' && body instanceof HTMLElement) {
    el.querySelector('.modal-body').appendChild(body);
  }

  document.body.appendChild(el);

  const close = () => {
    el.classList.add('modal-closing');
    setTimeout(() => {
      el.remove();
      if (!document.querySelector('.modal-backdrop, .ficha-modal-backdrop')) {
        document.body.classList.remove('modal-open');
      }
    }, 200);
  };

  el.querySelector('.modal-close').onclick = close;
  el.querySelector('.modal-cancel')?.addEventListener('click', close);
  el.querySelector('.modal-close-btn')?.addEventListener('click', close);

  const confirmBtn = el.querySelector('.modal-confirm');
  if (confirmBtn && onConfirm) {
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      try {
        const res = await onConfirm();
        if (res !== false) close();
      } catch (err) {
        console.error(err);
      } finally {
        confirmBtn.disabled = false;
      }
    };
  }

  el.addEventListener('click', e => {
    if (e.target === el) close();
  });

  return el;
}

export function confirmModal(title, message, onConfirm, options = {}) {
  return modal(title, `<p>${esc(message)}</p>`, onConfirm, { danger: true, confirmText: 'Eliminar', ...options });
}

/* ============================================================
   SERIESGRAPH 2D MATRIX COMPONENT (Heatmap & Metadatos)
   ============================================================ */
export function scoreToColorClass(score) {
  const num = Number(score);
  if (!num || num <= 0) return 'sg-score-none';
  if (num >= 9.5) return 'sg-score-pinnacle';
  if (num >= 9.0) return 'sg-score-superb';
  if (num >= 8.0) return 'sg-score-great';
  if (num >= 7.0) return 'sg-score-good';
  if (num >= 6.0) return 'sg-score-average';
  return 'sg-score-low';
}

export function renderSeriesGraph(paramA, paramB, paramC = {}) {
  // Detectar orden de argumentos si se llama como (container, seasonsData, meta) o (episodes, container, meta)
  let container = null;
  let rawData = [];
  let meta = {};

  if (paramA instanceof HTMLElement) {
    container = paramA;
    rawData = Array.isArray(paramB) ? paramB : [];
    meta = paramC || {};
  } else if (paramB instanceof HTMLElement) {
    container = paramB;
    rawData = Array.isArray(paramA) ? paramA : [];
    meta = paramC || {};
  } else {
    container = document.querySelector(paramA) || document.querySelector(paramB);
    rawData = Array.isArray(paramA) ? paramA : (Array.isArray(paramB) ? paramB : []);
    meta = paramC || {};
  }

  if (!container) return;

  if (!rawData.length) {
    container.innerHTML = `
      <div class="sg-empty-matrix glass">
        <p>No hay temporadas o capítulos registrados para esta serie.</p>
      </div>
    `;
    return;
  }

  const epMap = new Map();
  let minEp = 1;
  let maxEp = 0;
  const seasonsSet = new Set();

  // Si rawData es una lista plana de episodios (ej: item.episodes)
  const isFlatEpisodeList = rawData[0] && (rawData[0].temporada_id !== undefined || rawData[0].temporada_numero !== undefined || rawData[0].season !== undefined);

  if (isFlatEpisodeList) {
    rawData.forEach(ep => {
      const sNum = Number(ep.temporada_numero || ep.season || 1);
      const epNum = Number(ep.numero !== undefined ? ep.numero : (ep.episode_number !== undefined ? ep.episode_number : 1));
      seasonsSet.add(sNum);
      if (epNum < minEp) minEp = epNum;
      if (epNum > maxEp) maxEp = epNum;
      epMap.set(`${sNum}_${epNum}`, ep);
    });
  } else {
    // Si rawData es lista de temporadas con s.episodes
    rawData.forEach(s => {
      const sNum = Number(s.season_number || s.numero || 1);
      seasonsSet.add(sNum);
      const episodes = s.episodes || s.capitulos || [];
      episodes.forEach(ep => {
        const epNum = Number(ep.numero !== undefined ? ep.numero : (ep.episode_number !== undefined ? ep.episode_number : 1));
        if (epNum < minEp) minEp = epNum;
        if (epNum > maxEp) maxEp = epNum;
        epMap.set(`${sNum}_${epNum}`, ep);
      });
    });
  }

  const seasons = Array.from(seasonsSet).sort((a, b) => a - b);
  maxEp = Math.max(maxEp, 1);
  const startEp = minEp <= 0 ? 0 : 1;

  // Column Headers (S1, S2, S3...)
  let matrixRowsHtml = `
    <div class="sg-matrix-row sg-matrix-header-row">
      <div class="sg-matrix-label-header"></div>
      ${seasons.map(s => `<div class="sg-matrix-col-header">S${s}</div>`).join('')}
    </div>
  `;

  // Episode Rows (E0, E1, E2, E3...)
  for (let ep = startEp; ep <= maxEp; ep++) {
    let cellsHtml = `<div class="sg-matrix-row-label">E${ep}</div>`;

    for (const s of seasons) {
      const epData = epMap.get(`${s}_${ep}`);
      if (!epData) {
        cellsHtml += `<div class="sg-matrix-cell sg-cell-blank" aria-hidden="true"></div>`;
      } else {
        const nota = Number(epData.nota_tmdb || 0);
        const colorCls = scoreToColorClass(nota);
        const scoreStr = nota > 0 ? nota.toFixed(1) : '—';
        const epName = esc(epData.nombre || `Episodio ${ep}`);
        const dateStr = epData.fecha_emision ? formatDate(epData.fecha_emision) : '';
        const descStr = epData.sinopsis ? esc(epData.sinopsis.slice(0, 180)) + (epData.sinopsis.length > 180 ? '...' : '') : '';

        cellsHtml += `
          <div class="sg-matrix-cell ${colorCls}" tabindex="0" role="button" aria-label="Temporada ${s}, Episodio ${ep}: ${epName} (${scoreStr} puntos)">
            <span class="sg-cell-number">${scoreStr}</span>
            <div class="sg-cell-tooltip" role="tooltip">
              <div class="sg-tt-top">
                <span class="sg-tt-badge">T${s} · E${ep}</span>
                <span class="sg-tt-score">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  ${scoreStr} <small>/ 10</small>
                </span>
              </div>
              <strong class="sg-tt-name">${epName}</strong>
              ${dateStr ? `<span class="sg-tt-date">${dateStr}</span>` : ''}
              ${descStr ? `<p class="sg-tt-desc">${descStr}</p>` : ''}
            </div>
          </div>
        `;
      }
    }

    matrixRowsHtml += `<div class="sg-matrix-row">${cellsHtml}</div>`;
  }

  // Generate full component layout
  const seriesPoster = meta.image || '';
  const seriesTitle = esc(meta.title || 'Serie');
  const seriesScore = meta.vote_average ? Number(meta.vote_average).toFixed(1) : null;
  const seriesYear = meta.year || '';

  container.innerHTML = `
    <div class="seriesgraph-master-layout">
      <!-- PANEL LATERAL ESTILO SERIESGRAPH -->
      <aside class="sg-sidebar">
        ${seriesPoster ? `
          <div class="sg-poster-card">
            <img src="${seriesPoster}" alt="${seriesTitle}" loading="lazy" />
          </div>
        ` : ''}
        <div class="sg-sidebar-meta">
          ${seriesScore ? `
            <div class="sg-rating-hero">
              <svg class="sg-star-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              <strong class="sg-rating-number">${seriesScore}</strong>
              <span class="sg-rating-label">IMDb</span>
            </div>
          ` : ''}
          <h2 class="sg-title-heading">${seriesTitle}</h2>
          ${seriesYear ? `<span class="sg-years-badge">${seriesYear}</span>` : ''}
          <div class="sg-brand-tag">
            <span class="sg-dot"></span>
            <span>SeriesGraph Live Matrix</span>
          </div>

          <div class="sg-sidebar-actions">
            <div class="rating-widget" style="margin-top: 0.6rem;">
              <span class="widget-label" style="font-size: 0.72rem; color: var(--text-dim);">Tu puntuación:</span>
              <div class="stars-container" id="title-star-container"></div>
            </div>
            <div class="action-buttons" style="margin-top: 0.6rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn secondary small" id="btn-add-diary">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span>Diario</span>
              </button>
              <button class="btn secondary small" id="btn-add-list">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                <span>Lista</span>
              </button>
            </div>
          </div>
        </div>

        <div class="sg-legend-box">
          <span class="sg-legend-title">Guía de calificaciones</span>
          <div class="sg-legend-list">
            <div class="sg-legend-row"><span class="sg-legend-swatch sg-score-pinnacle"></span> <strong>≥ 9.5</strong> <span>Obra Maestra</span></div>
            <div class="sg-legend-row"><span class="sg-legend-swatch sg-score-superb"></span> <strong>9.0 – 9.4</strong> <span>Excelente</span></div>
            <div class="sg-legend-row"><span class="sg-legend-swatch sg-score-great"></span> <strong>8.0 – 8.9</strong> <span>Muy Bueno</span></div>
            <div class="sg-legend-row"><span class="sg-legend-swatch sg-score-good"></span> <strong>7.0 – 7.9</strong> <span>Bueno</span></div>
            <div class="sg-legend-row"><span class="sg-legend-swatch sg-score-average"></span> <strong>6.0 – 6.9</strong> <span>Regular</span></div>
            <div class="sg-legend-row"><span class="sg-legend-swatch sg-score-low"></span> <strong>&lt; 6.0</strong> <span>Bajo</span></div>
          </div>
        </div>
      </aside>

      <!-- MATRIZ 2D DE EPISODIOS -->
      <div class="sg-matrix-wrapper">
        <div class="sg-matrix-scroll-container">
          <div class="sg-matrix-grid">
            ${matrixRowsHtml}
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire tooltips dynamic position to avoid viewport overflow and handle click/tap minimize
  const allCells = container.querySelectorAll('.sg-matrix-cell:not(.sg-cell-blank)');

  const positionTooltip = (cell) => {
    const tt = cell.querySelector('.sg-cell-tooltip');
    if (!tt) return;
    const rect = cell.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = Math.min(250, viewportWidth - 24);
    const tooltipHeight = Math.max(150, tt.offsetHeight || 180);

    tt.classList.remove('tooltip-below', 'align-left', 'align-right');
    tt.style.position = 'fixed';
    tt.style.width = `${tooltipWidth}px`;
    tt.style.maxWidth = 'calc(100vw - 24px)';
    tt.style.left = `${Math.max(12, Math.min(viewportWidth - tooltipWidth - 12, rect.left + rect.width / 2 - tooltipWidth / 2))}px`;
    tt.style.bottom = 'auto';

    const spaceAbove = rect.top - 12;
    const top = spaceAbove >= tooltipHeight ? rect.top - tooltipHeight - 8 : rect.bottom + 8;
    tt.style.top = `${Math.max(12, Math.min(viewportHeight - tooltipHeight - 12, top))}px`;
  };

  allCells.forEach(cell => {
    // Al hacer click o tap en un capitulo:
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      const isAlreadyActive = cell.classList.contains('active-ep');

      // 1. Siempre se minimiza el anterior que tocaste
      allCells.forEach(c => c.classList.remove('active-ep'));

      // 2. Si no estaba activo, activar este y calcular posicion para que jamas se corte
      if (!isAlreadyActive) {
        cell.classList.add('active-ep');
        requestAnimationFrame(() => positionTooltip(cell));
      }
    });

    // Soporte para hover suave en desktop
    cell.addEventListener('mouseenter', () => {
      positionTooltip(cell);
    });
  });

  // Click afuera de la matriz minimiza cualquier capitulo abierto
  const handleOutsideClick = (e) => {
    if (!e.target.closest('.sg-matrix-cell')) {
      allCells.forEach(c => c.classList.remove('active-ep'));
    }
  };
  document.removeEventListener('click', container._sgOutsideHandler);
  container._sgOutsideHandler = handleOutsideClick;
  document.addEventListener('click', handleOutsideClick);
}

/* ============================================================
   STAR PICKER
   ============================================================ */
export function renderStars(score = 0, onSelect = null) {
  const wrap = document.createElement('div');
  wrap.className = 'star-picker';
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('button');
    star.type = 'button';
    star.className = `star-btn ${i <= score ? 'active' : ''}`;
    star.setAttribute('aria-label', `${i} estrellas`);
    star.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    if (onSelect) {
      star.onclick = () => {
        onSelect(i);
        wrap.querySelectorAll('.star-btn').forEach((s, idx) => {
          s.classList.toggle('active', idx < i);
        });
      };
    }
    wrap.appendChild(star);
  }
  return wrap;
}

export const esc = value =>
  String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

export const formatDate = iso => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};
