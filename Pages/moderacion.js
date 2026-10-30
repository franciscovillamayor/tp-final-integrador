// panel de moderacion y administracion con matriz completa de permisos

import { request, currentUser } from '../Modules/api.js';
import { toast, modal, confirmModal, esc, formatDate } from '../Modules/ui.js';

let activeModTab = 'reportes';

export async function moderacion() {
  const user = currentUser();
  const isAdmin = user && (user.role === 'Administrador' || user.role === 'admin' || user.email === 'villamayorfran7@gmail.com' || user.email === 'franciscoxx458@gmail.com');
  const isMod = user && (user.role === 'Moderador' || isAdmin);
  if (!user || !isMod) {
    return `
      <section class="workspace-page">
        <div class="empty-state glass">
          <div class="empty-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div>
          <h2>Acceso restringido</h2>
          <p>Esta sección está reservada exclusivamente para Moderadores y Administradores de SerieScore.</p>
          <a href="#/catalogo" class="btn primary">Volver al catálogo</a>
        </div>
      </section>
    `;
  }

  let stats = { reportes: 0, baneos: 0, titulos: 0, usuarios: 0, apelaciones: 0 };
  let reports = [];
  let bans = [];
  let appeals = [];
  let usersList = [];
  let catalogList = [];

  try {
    stats = await request('/moderation/stats');
    if (activeModTab === 'reportes') reports = await request('/moderation/reports');
    if (activeModTab === 'baneos') {
      bans = await request('/moderation/bans');
      usersList = await request('/users').catch(() => []);
    }
    if (activeModTab === 'apelaciones') appeals = await request('/moderation/appeals');
    if (activeModTab === 'catalogo' && isAdmin) catalogList = await request('/catalog?all=true');
    if (activeModTab === 'usuarios' && isAdmin) usersList = await request('/users');
  } catch (err) {
    toast('Error al sincronizar datos de moderación', 'error');
  }

  return `
    <section class="workspace-page">
      <header class="page-header">
        <div class="header-main">
          <span class="eyebrow">${isAdmin ? 'PANEL DE CONTROL TOTAL · ADMINISTRADOR' : 'PANEL DE SEGURIDAD · MODERADOR'}</span>
          <h1>Panel de moderación</h1>
          <p>Gestión de contenido, resolución de sanciones y mantenimiento de la comunidad.</p>
        </div>
      </header>

      <div class="moderation-stats-grid">
        <div class="metric-card glass">
          <span class="metric-label">REPORTES PENDIENTES</span>
          <strong class="metric-value ${stats.reportes > 0 ? 'neon-accent' : ''}">${stats.reportes}</strong>
        </div>
        <div class="metric-card glass">
          <span class="metric-label">BANEOS ACTIVOS</span>
          <strong class="metric-value">${stats.baneos}</strong>
        </div>
        <div class="metric-card glass">
          <span class="metric-label">APELACIONES PENDIENTES</span>
          <strong class="metric-value ${stats.apelaciones > 0 ? 'neon-accent' : ''}">${stats.apelaciones}</strong>
        </div>
        <div class="metric-card glass">
          <span class="metric-label">TÍTULOS EN CATÁLOGO</span>
          <strong class="metric-value">${stats.titulos}</strong>
        </div>
        <div class="metric-card glass">
          <span class="metric-label">USUARIOS TOTALES</span>
          <strong class="metric-value">${stats.usuarios}</strong>
        </div>
      </div>

      <div class="mod-nav-tabs">
        <button class="mod-tab-btn ${activeModTab === 'reportes' ? 'active' : ''}" data-tab="reportes">
          <svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg> Reportes (${stats.reportes})
        </button>
        <button class="mod-tab-btn ${activeModTab === 'baneos' ? 'active' : ''}" data-tab="baneos">
          <svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg> Baneos & Sanciones
        </button>
        <button class="mod-tab-btn ${activeModTab === 'apelaciones' ? 'active' : ''}" data-tab="apelaciones">
          <svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="3" x2="12" y2="21"></line><path d="M5 21h14"></path><path d="m3 7 4-4 4 4"></path><path d="m17 7 4-4-4-4"></path><path d="M3 7c0 2.2 1.8 4 4 4s4-1.8 4-4"></path><path d="M17 7c0 2.2-1.8 4-4 4s-4-1.8-4-4"></path></svg> Apelaciones (${stats.apelaciones})
        </button>
        ${isAdmin ? `
          <button class="mod-tab-btn ${activeModTab === 'catalogo' ? 'active' : ''}" data-tab="catalogo">
            <svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line><line x1="17" y1="17" x2="22" y2="17"></line></svg> Gestión Catálogo
          </button>
          <button class="mod-tab-btn ${activeModTab === 'usuarios' ? 'active' : ''}" data-tab="usuarios">
            <svg class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> Gestión Usuarios
          </button>
        ` : ''}
      </div>

      <div class="mod-content-pane">
        ${renderModPane({ activeModTab, reports, bans, appeals, catalogList, usersList, isAdmin, user })}
      </div>
    </section>
  `;
}

function renderModPane({ activeModTab, reports, bans, appeals, catalogList, usersList, isAdmin, user }) {
  if (activeModTab === 'reportes') {
    return `
      <div class="mod-pane glass">
        <div class="pane-heading">
          <h2>Reportes de la comunidad</h2>
          <p>Revisá denuncias sobre reseñas o comentarios que incumplen las normas.</p>
        </div>
        ${reports.length === 0 ? '<div class="empty glass"><p>No hay reportes pendientes.</p></div>' : `
          <div class="table-responsive">
            <table class="mod-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Reportante</th>
                  <th>Tipo</th>
                  <th>Motivo</th>
                  <th>Contenido denunciado</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${reports.map(r => `
                  <tr>
                    <td>#${r.id}</td>
                    <td><strong>${esc(r.reportador || 'Usuario')}</strong></td>
                    <td><span class="badge ${r.resena_id ? 'badge-series' : 'badge-movie'}">${r.resena_id ? 'Reseña' : 'Comentario'}</span></td>
                    <td>${esc(r.motivo)}</td>
                    <td class="content-snippet">"${esc(r.resena_texto || r.comentario_texto || '—')}"</td>
                    <td><span class="status-pill status-${r.estado}">${r.estado.toUpperCase()}</span></td>
                    <td class="actions-cell">
                      ${r.estado === 'pendiente' ? `
                        <button class="btn small danger btn-resolve-report" data-id="${r.id}" data-action="eliminar_contenido">Ocultar & Resolver</button>
                        <button class="btn small ghost btn-resolve-report" data-id="${r.id}" data-action="descartar">Descartar</button>
                      ` : '<span class="text-muted">Procesado</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  if (activeModTab === 'baneos') {
    // filtrar usuarios que pueden ser baneados segun el rol del operador
    const eligibleUsers = usersList.filter(u => {
      if (u.id === user.id) return false;
      if (u.role === 'Administrador') return false;
      if (u.role === 'Moderador' && !isAdmin) return false;
      return true;
    });

    return `
      <div class="mod-pane glass">
        <div class="pane-heading-split">
          <div>
            <h2>Baneos y suspensiones</h2>
            <p>Sancioná temporal o permanentemente a infractores de la comunidad.</p>
          </div>
          <button class="btn primary" id="btn-open-ban-modal">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Aplicar nueva sanción</span>
          </button>
        </div>

        <div class="table-responsive" style="margin-top: 1.5rem;">
          <table class="mod-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Sancionado por</th>
                <th>Motivo</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${bans.length === 0 ? '<tr><td colspan="8" style="text-align:center; padding: 2rem;">No hay registros de baneo.</td></tr>' : bans.map(b => `
                <tr>
                  <td><strong>${esc(b.usuario_nombre)}</strong></td>
                  <td>${esc(b.usuario_email)}</td>
                  <td>${esc(b.moderador_nombre || 'Sistema')}</td>
                  <td>${esc(b.motivo)}</td>
                  <td>${formatDate(b.inicio)}</td>
                  <td>${b.fin ? formatDate(b.fin) : '<strong>Permanente</strong>'}</td>
                  <td><span class="status-pill status-${b.estado}">${b.estado.toUpperCase()}</span></td>
                  <td>
                    ${b.estado === 'activo' ? `
                      <button class="btn small secondary btn-unban-user" data-uid="${b.usuario_id}">Levantar baneo</button>
                    ` : '<span class="text-muted">—</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (activeModTab === 'apelaciones') {
    return `
      <div class="mod-pane glass">
        <div class="pane-heading">
          <h2>Apelaciones de usuarios sancionados</h2>
          <p>Revisá solicitudes de reconsideración enviadas por usuarios con suspensión activa.</p>
        </div>
        ${appeals.length === 0 ? '<div class="empty glass"><p>No hay apelaciones registradas.</p></div>' : `
          <div class="table-responsive">
            <table class="mod-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Motivo sanción</th>
                  <th>Mensaje del usuario</th>
                  <th>Estado</th>
                  <th>Respuesta</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${appeals.map(a => `
                  <tr>
                    <td><strong>${esc(a.usuario_nombre)}</strong><br><small>${esc(a.usuario_email)}</small></td>
                    <td>${esc(a.ban_motivo || 'Incumplimiento')}</td>
                    <td class="content-snippet">"${esc(a.mensaje)}"</td>
                    <td><span class="status-pill status-${a.estado}">${a.estado.toUpperCase()}</span></td>
                    <td>${esc(a.respuesta_moderador || '—')}</td>
                    <td class="actions-cell">
                      ${a.estado === 'pendiente' ? `
                        <button class="btn small primary btn-appeal-action" data-id="${a.id}" data-uid="${a.usuario_id}" data-status="aprobada">Aprobar & Desbanear</button>
                        <button class="btn small danger btn-appeal-action" data-id="${a.id}" data-uid="${a.usuario_id}" data-status="rechazada">Rechazar</button>
                      ` : '<span class="text-muted">Procesada</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  if (activeModTab === 'catalogo' && isAdmin) {
    return `
      <div class="mod-pane glass">
        <div class="pane-heading-split">
          <div>
            <h2>Gestión del catálogo (Administrador)</h2>
            <p>Carga manual de títulos, edición de datos, alternancia de visibilidad y borrado.</p>
          </div>
          <button class="btn primary" id="btn-manual-title-add">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Carga manual de título</span>
          </button>
        </div>

        <div class="table-responsive" style="margin-top: 1.5rem;">
          <table class="mod-table">
            <thead>
              <tr>
                <th>Póster</th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Año</th>
                <th>Nota</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${catalogList.map(t => `
                <tr data-id="${t.id}">
                  <td style="width: 50px;">
                    <img src="${t.image || 'https://placehold.co/40x60/0f172a/22d3ee'}" alt="" style="width: 36px; height: 54px; object-fit: cover; border-radius: 4px;" />
                  </td>
                  <td><strong>${esc(t.title)}</strong></td>
                  <td>${t.type === 'tv' ? 'Serie' : 'Película'}</td>
                  <td>${t.year || '—'}</td>
                  <td>
                    <svg class="card-star-svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    ${Number(t.vote_average || 0).toFixed(1)}
                  </td>
                  <td>
                    <span class="status-pill status-${t.hidden ? 'descartado' : 'resuelto'}">
                      ${t.hidden ? 'OCULTO' : 'VISIBLE'}
                    </span>
                  </td>
                  <td class="actions-cell">
                    <button class="btn small ghost btn-toggle-title-visibility" data-id="${t.id}" data-hidden="${t.hidden}">
                      ${t.hidden ? 'Mostrar' : 'Ocultar'}
                    </button>
                    <button class="btn small secondary btn-edit-title" data-id="${t.id}" data-title="${esc(t.title)}" data-overview="${esc(t.overview || '')}">
                      Editar
                    </button>
                    <button class="btn small danger btn-delete-title" data-id="${t.id}">
                      Eliminar
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (activeModTab === 'usuarios' && isAdmin) {
    return `
      <div class="mod-pane glass">
        <div class="pane-heading-split">
          <div>
            <h2>Gestión de usuarios (Administrador)</h2>
            <p>Altas, bajas, cambios de rol y administración de cuentas registradas.</p>
          </div>
          <button class="btn primary" id="btn-create-user-modal">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Alta de usuario</span>
          </button>
        </div>

        <div class="table-responsive" style="margin-top: 1.5rem;">
          <table class="mod-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Fecha alta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${usersList.map(u => `
                <tr data-id="${u.id}">
                  <td><strong>${esc(u.name)}</strong></td>
                  <td>${esc(u.email)}</td>
                  <td>
                    <select class="role-select" data-id="${u.id}" ${u.id === user.id ? 'disabled' : ''}>
                      <option value="Usuario" ${u.role === 'Usuario' ? 'selected' : ''}>Usuario</option>
                      <option value="Moderador" ${u.role === 'Moderador' ? 'selected' : ''}>Moderador</option>
                      <option value="Administrador" ${u.role === 'Administrador' ? 'selected' : ''}>Administrador</option>
                    </select>
                  </td>
                  <td><span class="status-pill status-${u.estado || 'activo'}">${(u.estado || 'activo').toUpperCase()}</span></td>
                  <td>${formatDate(u.creado_en)}</td>
                  <td class="actions-cell">
                    ${u.id !== user.id ? `
                      <button class="btn small danger btn-delete-user" data-id="${u.id}" data-name="${esc(u.name)}">Baja</button>
                    ` : '<span class="text-muted">Tu cuenta</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  return '';
}

export function wireModeracion() {
  const user = currentUser();
  if (!user) return;
  const isAdmin = user.role === 'Administrador';

  // cambio de pestana
  document.querySelectorAll('.mod-tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      activeModTab = btn.dataset.tab;
      const main = document.querySelector('main.page-body');
      if (main) {
        main.innerHTML = await moderacion();
        wireModeracion();
      }
    });
  });

  // resolver o descartar reporte
  document.querySelectorAll('.btn-resolve-report').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const status = action === 'descartar' ? 'descartado' : 'resuelto';
      try {
        await request(`/moderation/reports/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status, action }),
        });
        toast(status === 'resuelto' ? 'Reporte resuelto y contenido sancionado' : 'Reporte descartado', 'ok');
        location.hash = '/catalogo';
        setTimeout(() => { location.hash = '/moderacion'; }, 20);
      } catch {
        toast('Error al procesar el reporte', 'error');
      }
    });
  });

  // modal para aplicar sancion / banear usuario
  document.querySelector('#btn-open-ban-modal')?.addEventListener('click', async () => {
    try {
      const users = await request('/users');
      const eligible = users.filter(u => {
        if (u.id === user.id) return false;
        if (u.role === 'Administrador') return false;
        if (u.role === 'Moderador' && !isAdmin) return false;
        return true;
      });

      if (!eligible.length) {
        toast('No hay usuarios sancionables en este momento', 'info');
        return;
      }

      const options = eligible.map(u => `<option value="${u.id}">${esc(u.name)} (${esc(u.email)}) - ${u.role}</option>`).join('');

      modal(
        'Aplicar sanción a usuario',
        `
          <div class="form-group">
            <label>Seleccionar usuario:</label>
            <select id="ban-target-user">${options}</select>
          </div>
          <div class="form-group">
            <label>Duración de la sanción:</label>
            <select id="ban-duration">
              <option value="24h">24 horas</option>
              <option value="7d">7 días</option>
              <option value="30d">30 días</option>
              <option value="permanente">Permanente</option>
            </select>
          </div>
          <div class="form-group">
            <label>Motivo de la sanción:</label>
            <textarea id="ban-reason" placeholder="Explicación detallada del motivo..." required></textarea>
          </div>
        `,
        async () => {
          const targetId = document.querySelector('#ban-target-user')?.value;
          const duration = document.querySelector('#ban-duration')?.value;
          const reason = document.querySelector('#ban-reason')?.value.trim();
          if (!reason) {
            toast('Ingresá el motivo de la sanción', 'error');
            return false;
          }
          try {
            await request(`/moderation/users/${targetId}/ban`, {
              method: 'POST',
              body: JSON.stringify({ duration, reason }),
            });
            toast('Sanción aplicada con éxito', 'ok');
            location.hash = '/catalogo';
            setTimeout(() => { location.hash = '/moderacion'; }, 20);
          } catch (err) {
            toast(err.data?.error || 'No se pudo aplicar la sanción', 'error');
          }
        },
        { danger: true, confirmText: 'Aplicar sanción' }
      );
    } catch {
      toast('Error al consultar lista de usuarios', 'error');
    }
  });

  // levantar baneo
  document.querySelectorAll('.btn-unban-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.dataset.uid;
      confirmModal(
        'Levantar sanción',
        '¿Deseás restaurar los permisos y habilitar el acceso a este usuario?',
        async () => {
          try {
            await request(`/moderation/users/${uid}/unban`, { method: 'POST' });
            toast('Baneo levantado con éxito', 'ok');
            location.hash = '/catalogo';
            setTimeout(() => { location.hash = '/moderacion'; }, 20);
          } catch {
            toast('Error al levantar baneo', 'error');
          }
        }
      );
    });
  });

  // resolver apelacion
  document.querySelectorAll('.btn-appeal-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const uid = btn.dataset.uid;
      const status = btn.dataset.status;
      const isApproved = status === 'aprobada';

      modal(
        isApproved ? 'Aprobar apelación y desbanear' : 'Rechazar apelación',
        `
          <p>¿Confirmás la resolución de esta apelación como <strong>${status.toUpperCase()}</strong>?</p>
          <div class="form-group">
            <label>Mensaje de respuesta para el usuario:</label>
            <textarea id="appeal-reply-msg" placeholder="Motivo de la resolución...">${isApproved ? 'Tu apelación fue evaluada y aceptada. Se restablece tu cuenta.' : 'Tu apelación fue rechazada tras la revisión de moderación.'}</textarea>
          </div>
        `,
        async () => {
          const response = document.querySelector('#appeal-reply-msg')?.value;
          try {
            await request(`/moderation/appeals/${id}`, {
              method: 'PATCH',
              body: JSON.stringify({ status, response, userId: uid }),
            });
            toast(isApproved ? 'Apelación aprobada y usuario desbaneado' : 'Apelación rechazada', 'ok');
            location.hash = '/catalogo';
            setTimeout(() => { location.hash = '/moderacion'; }, 20);
          } catch {
            toast('Error al resolver apelación', 'error');
          }
        },
        { danger: !isApproved, confirmText: isApproved ? 'Aprobar' : 'Rechazar' }
      );
    });
  });

  // gestion catalogo: carga de titulo con datos reales (admin)
  document.querySelector('#btn-manual-title-add')?.addEventListener('click', () => {
    let searchTimeout = null;
    let extractedData = null;
    let importedEpisodesData = null;

    modal(
      'Importar título con datos reales',
      `
        <div class="import-tabs-bar">
          <button type="button" class="import-tab active" data-mode="link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            Link IMDb
          </button>
          <button type="button" class="import-tab" data-mode="search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            Buscar por nombre
          </button>
          <button type="button" class="import-tab" data-mode="manual">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Carga manual
          </button>
        </div>

        <!-- Panel 1: Pegar link de IMDb -->
        <div class="import-panel" id="import-panel-link">
          <div class="form-group">
            <label>Pegá el link de IMDb:</label>
            <div class="import-link-input-row">
              <input type="url" id="import-url-input" placeholder="Ej: https://seriesgraph.com/show/87108-chernobyl o https://www.imdb.com/title/tt7366338/" autocomplete="off" />
              <button type="button" class="btn primary" id="btn-parse-url" style="white-space: nowrap;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                <span>Extraer datos reales</span>
              </button>
            </div>
            <div class="import-link-hints">
              <span>Links de muestra rápida:</span>
              <span class="import-hint-tag" data-sample="https://seriesgraph.com/show/87108-chernobyl">Chernobyl (SeriesGraph)</span>
              <span class="import-hint-tag" data-sample="https://seriesgraph.com/show/1399-game-of-thrones">Game of Thrones</span>
              <span class="import-hint-tag" data-sample="https://www.imdb.com/title/tt0903747/">Breaking Bad (IMDb)</span>
            </div>
          </div>

          <div id="import-url-status" style="margin-top:0.75rem;"></div>
          <div id="import-url-preview"></div>
        </div>

        <!-- Panel 2: Buscar por nombre -->
        <div class="import-panel" id="import-panel-search" style="display:none;">
          <div class="form-group">
            <label>Buscá la serie o película por nombre:</label>
            <div class="import-search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" id="import-search-input" placeholder="Ej: Chernobyl, Breaking Bad, Succession, Oppenheimer..." autocomplete="off" />
              <span id="import-search-spinner" class="import-spinner" style="display:none;"></span>
            </div>
          </div>
          <div id="import-search-results" class="import-results-grid">
            <div class="import-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <p>Escribí el nombre para buscar datos reales de series y películas.</p>
              <small>Extrae temporadas, capítulos reales con sus nombres verdaderos y puntuaciones oficiales de IMDb.</small>
            </div>
          </div>
        </div>

        <!-- Panel 3: Carga manual -->
        <div class="import-panel" id="import-panel-manual" style="display:none;">
          <div class="form-group">
            <label>Título:</label>
            <div style="display: flex; gap: 0.6rem;">
              <input type="text" id="manual-title" placeholder="Ej: The Mentalist, Oppenheimer, Breaking Bad..." required style="flex: 1;" />
              <button type="button" class="btn secondary" id="btn-fetch-real-data" style="white-space: nowrap;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <span>Autocompletar</span>
              </button>
            </div>
            <span id="fetch-real-status" style="display: block; font-size: 0.76rem; color: var(--text-dim); margin-top: 0.35rem;">
              Escribí el título y presioná "Autocompletar" para extraer datos verdaderos.
            </span>
          </div>
          <div class="form-group">
            <label>Tipo:</label>
            <select id="manual-type">
              <option value="tv">Serie (con SeriesGraph)</option>
              <option value="movie">Película</option>
            </select>
          </div>
          <div id="manual-series-options" style="padding: 0.9rem; background: var(--bg-card-2); border-radius: 10px; margin-bottom: 0.9rem; border: 1px solid var(--border);">
            <div class="form-group" style="margin-bottom: 0.6rem;">
              <label style="display: flex; justify-content: space-between; align-items: center;">
                <span>Cantidad de temporadas:</span>
                <span id="manual-seasons-badge" style="font-size: 0.78rem; color: var(--accent); font-weight: 600;">2 temporadas</span>
              </label>
              <input type="number" id="manual-seasons" value="2" min="1" max="25" />
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.35rem;">
                Capítulos por cada temporada:
              </label>
              <div id="manual-season-inputs" class="manual-seasons-grid"></div>
            </div>
          </div>
          <div class="form-group">
            <label>Año de estreno:</label>
            <input type="number" id="manual-year" placeholder="2024" value="2024" />
          </div>
          <div class="form-group">
            <label>Nota promedio (1.0 a 10.0):</label>
            <input type="number" step="0.1" id="manual-score" placeholder="8.5" value="8.0" min="1" max="10" />
          </div>
          <div class="form-group">
            <label>URL de imagen póster (opcional):</label>
            <input type="url" id="manual-poster" placeholder="https://..." />
          </div>
          <div class="form-group">
            <label>Sinopsis:</label>
            <textarea id="manual-overview" placeholder="Descripción general de la obra..."></textarea>
          </div>
        </div>
      `,
      async () => {
        // En modo manual se ejecuta el guardado desde el footer del modal
        const activePanel = document.querySelector('.import-panel[style*="block"], .import-panel:not([style*="none"])');
        const panelId = activePanel?.id || '';

        if (panelId === 'import-panel-manual') {
          const title = document.querySelector('#manual-title')?.value.trim();
          const type = document.querySelector('#manual-type')?.value;
          const year = document.querySelector('#manual-year')?.value;
          const score = document.querySelector('#manual-score')?.value;
          const poster = document.querySelector('#manual-poster')?.value.trim();
          const overview = document.querySelector('#manual-overview')?.value.trim();
          const seasons_count = Number(document.querySelector('#manual-seasons')?.value) || 1;

          const epInputs = document.querySelectorAll('.manual-ep-count-input');
          const episodes_per_season = Array.from(epInputs).map(input => Math.max(1, Number(input.value) || 1));

          if (!title) {
            toast('El título es obligatorio', 'error');
            return false;
          }
          try {
            await request('/import/save', {
              method: 'POST',
              body: JSON.stringify({
                title, type, year, vote_average: score, poster, overview,
                seasons_count,
                episodes_per_season: episodes_per_season.length ? episodes_per_season : 8,
                episodes_data: importedEpisodesData
              }),
            });
            toast(`"${title}" agregado exitosamente al catálogo`, 'ok');
            const main = document.querySelector('main.page-body');
            if (main) {
              main.innerHTML = await moderacion();
              wireModeracion();
            }
          } catch (err) {
            toast(err.data?.error || err.message || 'Error al agregar título', 'error');
            return false;
          }
        }
        return undefined;
      },
      { size: 'lg', confirmText: 'Guardar (manual)' }
    );

    setTimeout(() => {
      // Tab switching
      document.querySelectorAll('.import-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          document.querySelectorAll('.import-panel').forEach(p => p.style.display = 'none');
          const panelId = `import-panel-${tab.dataset.mode}`;
          const panel = document.getElementById(panelId);
          if (panel) panel.style.display = 'block';
        });
      });

      // Helper para renderizar vista previa de datos extraidos
      const renderPreviewCard = (container, data, onConfirmImport) => {
        const isTv = data.type === 'tv' || data.tipo === 'serie';
        const eps = data.episodes || [];
        container.innerHTML = `
          <div class="import-preview-container">
            <div class="import-preview-header">
              <img src="${data.poster || 'https://placehold.co/90x135/0f172a/22d3ee'}" alt="" class="import-preview-poster" />
              <div class="import-preview-details">
                <h3 class="import-preview-title">${esc(data.title)}</h3>
                <div class="import-preview-meta">
                  <span class="badge ${isTv ? 'badge-series' : 'badge-movie'}">${isTv ? 'Serie' : 'Película'}</span>
                  ${data.year ? `<span>${data.year}</span>` : ''}
                  <span class="import-preview-score-badge">★ ${Number(data.score || 8.0).toFixed(1)}</span>
                  ${isTv ? `<span style="color:var(--accent); font-weight:700;">${data.seasons_count || 1} Temporadas · ${eps.length} Capítulos reales</span>` : ''}
                </div>
                ${data.overview ? `<p class="import-preview-overview">${esc(data.overview)}</p>` : ''}
              </div>
            </div>

            ${isTv && eps.length > 0 ? `
              <div class="import-episodes-preview-box">
                <div class="import-episodes-summary-bar">
                  <span class="import-episodes-count-text">Capítulos reales verificados (${eps.length}):</span>
                  <small style="color:var(--text-dim);">Con nombres y notas reales</small>
                </div>
                <div class="import-episodes-scroll-list">
                  ${eps.map(e => `
                    <div class="import-ep-row">
                      <span class="import-ep-badge">T${e.season} · E${e.number}</span>
                      <span class="import-ep-name" title="${esc(e.name)}">${esc(e.name)}</span>
                      <span class="import-ep-score">★ ${Number(e.score || data.score || 8.0).toFixed(1)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div class="import-actions-bar">
              <button type="button" class="btn primary" id="btn-do-import-now">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
                <span>Importar a SerieScore ahora</span>
              </button>
            </div>
            <div id="import-save-status" style="margin-top:0.75rem;"></div>
          </div>
        `;

        container.querySelector('#btn-do-import-now')?.addEventListener('click', () => {
          onConfirmImport(false);
        });
      };

      // ——— PANEL 1: LINK IMPORT (SeriesGraph, IMDb, TVmaze) ———
      const urlInput = document.getElementById('import-url-input');
      const parseBtn = document.getElementById('btn-parse-url');
      const urlStatus = document.getElementById('import-url-status');
      const urlPreview = document.getElementById('import-url-preview');

      // Click en tags de ejemplo
      document.querySelectorAll('.import-hint-tag').forEach(tag => {
        tag.addEventListener('click', () => {
          if (urlInput) {
            urlInput.value = tag.dataset.sample;
            parseBtn?.click();
          }
        });
      });

      const handleParseUrl = async () => {
        const rawUrl = urlInput?.value?.trim();
        if (!rawUrl) {
          toast('Pegá un link o nombre de serie', 'error');
          return;
        }

        parseBtn.disabled = true;
        parseBtn.innerHTML = '<span class="import-spinner"></span> Extrayendo datos...';
        urlStatus.innerHTML = '<div class="import-loading"><span class="import-spinner"></span> Conectando y obteniendo capítulos verdaderos de SeriesGraph / TVmaze...</div>';
        urlPreview.innerHTML = '';

        try {
          const data = await request('/import/parse-url', {
            method: 'POST',
            body: JSON.stringify({ url: rawUrl }),
          });

          extractedData = data;
          urlStatus.innerHTML = `
            <div class="import-success-card">
              <div class="import-success-icon">✔</div>
              <div>
                <strong>${esc(data.title)}</strong> encontrado con éxito
                <br><small>${data.type === 'tv' ? `${data.seasons_count} temporadas y ${data.episodes_count} capítulos reales` : 'Película'}</small>
              </div>
            </div>`;

          // Render preview card
          renderPreviewCard(urlPreview, data, async (overwrite = false) => {
            const saveBtn = document.getElementById('btn-do-import-now');
            const saveStatus = document.getElementById('import-save-status');
            if (saveBtn) {
              saveBtn.disabled = true;
              saveBtn.innerHTML = '<span class="import-spinner"></span> Guardando en catálogo...';
            }

            try {
              const res = await request('/import/save', {
                method: 'POST',
                body: JSON.stringify({
                  title: data.title,
                  type: data.type,
                  year: data.year,
                  vote_average: data.score,
                  poster: data.poster,
                  overview: data.overview,
                  episodes_data: data.episodes,
                  overwrite,
                }),
              });

              toast(`"${data.title}" importado con éxito (${res.stats?.episodes || 0} capítulos reales)`, 'ok');
              setTimeout(() => {
                document.querySelector('.modal-overlay')?.click();
                location.hash = '/catalogo';
                setTimeout(() => { location.hash = '/moderacion'; }, 20);
              }, 1000);
            } catch (saveErr) {
              if (saveErr.data?.error === 'TITULO_YA_EXISTE') {
                saveStatus.innerHTML = `
                  <div class="import-error-card" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                    <span>"${esc(data.title)}" ya existe en el catálogo. ¿Deseas actualizarlo con estos capítulos reales?</span>
                    <button type="button" class="btn small danger" id="btn-force-overwrite">Actualizar y reemplazar</button>
                  </div>`;
                document.getElementById('btn-force-overwrite')?.addEventListener('click', () => {
                  handleSave(true);
                });
              } else {
                saveStatus.innerHTML = `<div class="import-error-card">Error: ${esc(saveErr.message)}</div>`;
                if (saveBtn) {
                  saveBtn.disabled = false;
                  saveBtn.innerHTML = 'Reintentar importación';
                }
              }
            }
          });
        } catch (err) {
          urlStatus.innerHTML = `<div class="import-error-card">✘ ${esc(err.message || 'No se pudieron extraer datos reales del link proporcionado')}</div>`;
        } finally {
          parseBtn.disabled = false;
          parseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> <span>Extraer datos reales</span>';
        }
      };

      parseBtn?.addEventListener('click', handleParseUrl);
      urlInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleParseUrl();
        }
      });

      // ——— PANEL 2: SEARCH MODE ———
      const searchInput = document.getElementById('import-search-input');
      const searchResults = document.getElementById('import-search-results');
      const searchSpinner = document.getElementById('import-search-spinner');

      searchInput?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (q.length < 2) {
          searchResults.innerHTML = `
            <div class="import-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <p>Escribí al menos 2 caracteres para buscar.</p>
            </div>`;
          return;
        }
        searchTimeout = setTimeout(async () => {
          searchSpinner.style.display = 'inline-block';
          try {
            const results = await request(`/import/search?q=${encodeURIComponent(q)}`);
            if (!results.length) {
              searchResults.innerHTML = `
                <div class="import-empty-state">
                  <p>No se encontraron resultados para "${esc(q)}".</p>
                  <small>Probá pegando el link directo en la primera pestaña.</small>
                </div>`;
            } else {
              searchResults.innerHTML = results.map(r => `
                <div class="import-result-card" data-source="${r.source}" data-id="${r.source_id}" data-type="${r.type}">
                  <div class="import-result-poster">
                    ${r.image ? `<img src="${r.image}" alt="" loading="lazy" />` : `
                      <div class="import-no-poster">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>
                      </div>
                    `}
                  </div>
                  <div class="import-result-info">
                    <h4>${esc(r.title)}</h4>
                    <div class="import-result-meta">
                      <span class="badge ${r.type === 'tv' ? 'badge-series' : 'badge-movie'}">${r.type === 'tv' ? 'Serie' : 'Película'}</span>
                      ${r.year ? `<span>${r.year}</span>` : ''}
                      ${r.score ? `<span>★ ${Number(r.score).toFixed(1)}</span>` : ''}
                      <span class="import-source-badge">${r.source === 'tvmaze' ? 'TVmaze' : 'TMDB'}</span>
                    </div>
                    ${r.genres ? `<span class="import-genres">${esc(r.genres)}</span>` : ''}
                    ${r.overview ? `<p class="import-overview">${esc(r.overview)}</p>` : ''}
                  </div>
                  <button type="button" class="btn primary small import-btn-select" data-source="${r.source}" data-id="${r.source_id}" data-type="${r.type}" data-title="${esc(r.title)}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
                    Importar
                  </button>
                </div>
              `).join('');

              // Wire import buttons
              searchResults.querySelectorAll('.import-btn-select').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                  e.stopPropagation();
                  const source = btn.dataset.source;
                  const id = btn.dataset.id;
                  const type = btn.dataset.type;
                  const titleName = btn.dataset.title;

                  btn.disabled = true;
                  btn.innerHTML = '<span class="import-spinner"></span> Importando...';

                  try {
                    let result;
                    if (source === 'tvmaze') {
                      result = await request(`/import/tvmaze/${id}`, { method: 'POST' });
                    } else {
                      result = await request(`/import/tmdb/${id}`, {
                        method: 'POST',
                        body: JSON.stringify({ type })
                      });
                    }

                    const stats = result.stats || {};
                    toast(
                      `"${titleName}" importado con éxito (${stats.seasons || 0} temporadas, ${stats.episodes || 0} capítulos reales)`,
                      'ok'
                    );

                    document.querySelector('.modal-overlay')?.click();
                    location.hash = '/catalogo';
                    setTimeout(() => { location.hash = '/moderacion'; }, 20);
                  } catch (err) {
                    if (err.data?.error === 'TITULO_YA_EXISTE') {
                      toast(`"${titleName}" ya existe en el catálogo`, 'info');
                      btn.disabled = false;
                      btn.innerHTML = 'Ya existe';
                    } else {
                      toast(err.data?.error || err.message || 'Error al importar', 'error');
                      btn.disabled = false;
                      btn.innerHTML = 'Reintentar';
                    }
                  }
                });
              });
            }
          } catch (err) {
            searchResults.innerHTML = `<div class="import-empty-state"><p>Error al buscar: ${esc(err.message)}</p></div>`;
          } finally {
            searchSpinner.style.display = 'none';
          }
        }, 400);
      });

      // ——— PANEL 3: ID IMPORT MODE ———
      document.getElementById('btn-import-tvmaze-id')?.addEventListener('click', async () => {
        const idInput = document.getElementById('import-tvmaze-id');
        const statusDiv = document.getElementById('import-id-status');
        const showId = idInput?.value?.trim();
        if (!showId) {
          toast('Ingresá un ID válido', 'error');
          return;
        }

        statusDiv.innerHTML = '<div class="import-loading"><span class="import-spinner"></span> Obteniendo capítulos reales...</div>';
        try {
          // Si empieza con tt, usar parse-url
          const parsed = await request('/import/parse-url', {
            method: 'POST',
            body: JSON.stringify({ url: showId }),
          });

          const saveRes = await request('/import/save', {
            method: 'POST',
            body: JSON.stringify({
              title: parsed.title,
              type: parsed.type,
              year: parsed.year,
              vote_average: parsed.score,
              poster: parsed.poster,
              overview: parsed.overview,
              episodes_data: parsed.episodes,
            }),
          });

          const stats = saveRes.stats || {};
          statusDiv.innerHTML = `
            <div class="import-success-card">
              <div class="import-success-icon">✔</div>
              <div>
                <strong>${esc(parsed.title)}</strong> importado exitosamente
                <br><small>${stats.seasons || parsed.seasons_count} temporadas · ${stats.episodes || parsed.episodes_count} capítulos reales</small>
              </div>
            </div>`;
          toast(`"${parsed.title}" importado con datos reales`, 'ok');
          setTimeout(() => {
            document.querySelector('.modal-overlay')?.click();
            location.hash = '/catalogo';
            setTimeout(() => { location.hash = '/moderacion'; }, 20);
          }, 1200);
        } catch (err) {
          if (err.data?.error === 'TITULO_YA_EXISTE') {
            statusDiv.innerHTML = `<div class="import-error-card">⚠ "${esc(err.data.title || '')}" ya existe en el catálogo.</div>`;
          } else {
            statusDiv.innerHTML = `<div class="import-error-card">✘ ${esc(err.message || 'Error al importar')}</div>`;
          }
        }
      });

      // ——— PANEL 4: MANUAL MODE ———
      const typeSelect = document.querySelector('#manual-type');
      const seriesOpt = document.querySelector('#manual-series-options');
      const seasonsInput = document.querySelector('#manual-seasons');
      const grid = document.querySelector('#manual-season-inputs');
      const badge = document.querySelector('#manual-seasons-badge');
      const btnFetchReal = document.querySelector('#btn-fetch-real-data');
      const statusSpan = document.querySelector('#fetch-real-status');

      const renderSeasonInputs = () => {
        if (!grid || !seasonsInput) return;
        const n = Math.max(1, Math.min(25, Number(seasonsInput.value) || 1));
        if (badge) badge.textContent = `${n} temporada${n > 1 ? 's' : ''}`;
        const prevVals = Array.from(grid.querySelectorAll('.manual-ep-count-input')).map(i => i.value);
        grid.innerHTML = Array.from({ length: n }).map((_, idx) => `
          <div class="manual-season-item">
            <label>Temporada ${idx + 1}</label>
            <input type="number" class="manual-ep-count-input" data-season="${idx + 1}" value="${prevVals[idx] || (idx === 0 ? 8 : (prevVals[0] || 8))}" min="1" max="50" />
          </div>
        `).join('');
      };

      if (typeSelect && seriesOpt) {
        seriesOpt.style.display = typeSelect.value === 'tv' ? 'block' : 'none';
        typeSelect.addEventListener('change', () => {
          seriesOpt.style.display = typeSelect.value === 'tv' ? 'block' : 'none';
          if (typeSelect.value === 'tv') renderSeasonInputs();
        });
      }

      if (seasonsInput) {
        seasonsInput.addEventListener('input', renderSeasonInputs);
        renderSeasonInputs();
      }

      // Autocompletar datos reales vía parse-url
      btnFetchReal?.addEventListener('click', async () => {
        const query = document.querySelector('#manual-title')?.value.trim();
        if (!query) {
          toast('Ingresá el título para buscar sus datos', 'error');
          return;
        }
        btnFetchReal.disabled = true;
        if (statusSpan) statusSpan.innerHTML = '<span style="color: var(--accent);">Buscando datos verdaderos...</span>';

        try {
          const parsed = await request('/import/parse-url', {
            method: 'POST',
            body: JSON.stringify({ url: query }),
          });

          if (typeSelect) {
            typeSelect.value = parsed.type;
            if (seriesOpt) seriesOpt.style.display = parsed.type === 'tv' ? 'block' : 'none';
          }
          if (parsed.year) {
            const yearInput = document.querySelector('#manual-year');
            if (yearInput) yearInput.value = parsed.year;
          }
          if (parsed.score) {
            const scoreInput = document.querySelector('#manual-score');
            if (scoreInput) scoreInput.value = Number(parsed.score).toFixed(1);
          }
          if (parsed.poster) {
            const posterInput = document.querySelector('#manual-poster');
            if (posterInput) posterInput.value = parsed.poster;
          }
          if (parsed.overview) {
            const ovInput = document.querySelector('#manual-overview');
            if (ovInput) ovInput.value = parsed.overview;
          }

          if (parsed.episodes && parsed.episodes.length > 0) {
            importedEpisodesData = parsed.episodes;
            if (seasonsInput) seasonsInput.value = parsed.seasons_count;
            if (badge) badge.textContent = `${parsed.seasons_count} temporadas (${parsed.episodes.length} capítulos reales)`;
            if (grid) {
              const seasonMap = {};
              parsed.episodes.forEach(e => {
                seasonMap[e.season] = (seasonMap[e.season] || 0) + 1;
              });
              grid.innerHTML = Object.keys(seasonMap).map(Number).sort((a,b)=>a-b).map(s => `
                <div class="manual-season-item">
                  <label>Temporada ${s}</label>
                  <input type="number" class="manual-ep-count-input" data-season="${s}" value="${seasonMap[s]}" min="1" max="50" />
                </div>
              `).join('');
            }
          }

          toast(`Datos reales de "${parsed.title}" cargados (${parsed.episodes?.length || 0} capítulos)`, 'ok');
          if (statusSpan) statusSpan.innerHTML = `<span style="color: #4ade80;">✔ Datos verdaderos cargados (${parsed.episodes?.length || 0} capítulos, nota ${parsed.score}).</span>`;
        } catch (e) {
          toast(e.message || 'Error al consultar datos', 'error');
          if (statusSpan) statusSpan.textContent = 'Completá los campos manualmente.';
        } finally {
          btnFetchReal.disabled = false;
        }
      });
    }, 50);
  });

  // gestion catalogo: toggle visibilidad
  document.querySelectorAll('.btn-toggle-title-visibility').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const isHidden = btn.dataset.hidden === 'true';
      try {
        await request(`/catalog/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ hidden: !isHidden }),
        });
        toast(isHidden ? 'Título ahora visible en catálogo' : 'Título ocultado del catálogo', 'ok');
        location.hash = '/catalogo';
        setTimeout(() => { location.hash = '/moderacion'; }, 20);
      } catch {
        toast('Error al actualizar visibilidad', 'error');
      }
    });
  });

  // gestion catalogo: editar titulo completo (con temporadas, capitulos y notas)
  document.querySelectorAll('.btn-edit-title').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      let titleData = null;
      try {
        titleData = await request(`/catalog/${id}`);
      } catch {
        toast('Error al obtener datos del título', 'error');
        btn.disabled = false;
        return;
      }
      btn.disabled = false;

      const isSeries = titleData.type === 'tv' || titleData.tipo === 'serie';

      const renderSeasonsEditorHTML = () => {
        if (!isSeries) return '';
        const seasons = titleData.seasons || [];
        const episodes = titleData.episodes || [];

        return `
          <div style="margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <div>
                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700;">Temporadas y Capítulos (${seasons.length} temporadas)</h3>
                <p style="margin: 0; font-size: 0.8rem; color: var(--text-dim);">Podés modificar la cantidad de capítulos, notas y nombres individualmente o sumar nuevas temporadas.</p>
              </div>
              <button type="button" class="btn small primary" id="btn-add-new-season">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>Nueva temporada</span>
              </button>
            </div>

            <div class="admin-seasons-container" id="admin-seasons-list">
              ${seasons.length === 0 ? '<p class="text-muted" style="font-size: 0.85rem;">Esta serie aún no tiene temporadas cargadas.</p>' : ''}
              ${seasons.map(s => {
                const sEps = episodes.filter(ep => ep.temporada_id === s.id).sort((a, b) => a.numero - b.numero);
                return `
                  <div class="admin-season-box" data-season-id="${s.id}">
                    <div class="admin-season-header">
                      <h4>
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent);"></span>
                        ${esc(s.nombre || `Temporada ${s.numero}`)}
                        <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">(${sEps.length} capítulos)</span>
                      </h4>
                      <div style="display: flex; gap: 0.5rem;">
                        <button type="button" class="btn small ghost btn-add-ep-to-season" data-season-id="${s.id}" data-season-num="${s.numero}">
                          + Agregar capítulo
                        </button>
                        <button type="button" class="btn small danger btn-delete-season" data-season-id="${s.id}" data-season-name="${esc(s.nombre || `Temporada ${s.numero}`)}">
                          Eliminar temporada
                        </button>
                      </div>
                    </div>

                    ${sEps.length === 0 ? '<p style="font-size: 0.8rem; color: var(--text-dim); margin: 0.5rem 0;">Sin capítulos aún.</p>' : `
                      <div class="admin-episodes-table-wrap">
                        <table class="admin-episodes-table">
                          <thead>
                            <tr>
                              <th style="width: 45px;">N°</th>
                              <th>Nombre del capítulo</th>
                              <th style="width: 100px;">Puntaje (1-10)</th>
                              <th style="width: 70px; text-align: center;">Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${sEps.map(ep => `
                              <tr data-ep-id="${ep.id}">
                                <td style="font-weight: 700; color: var(--text-muted);">E${ep.numero}</td>
                                <td>
                                  <input type="text" class="admin-ep-input ep-field-name" value="${esc(ep.nombre || `Episodio ${ep.numero}`)}" placeholder="Nombre del capítulo" />
                                </td>
                                <td>
                                  <input type="number" step="0.1" min="1" max="10" class="admin-ep-score-input ep-field-score" value="${Number(ep.nota_tmdb || 0).toFixed(1)}" />
                                </td>
                                <td style="text-align: center;">
                                  <button type="button" class="icon btn-delete-ep" data-ep-id="${ep.id}" title="Eliminar capítulo" style="color: var(--danger); background: transparent; border: none; cursor: pointer; padding: 4px;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                  </button>
                                </td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    `}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      };

      const modalEl = modal(
        `Editar "${titleData.title}"`,
        `
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.9rem;">
            <div class="form-group" style="margin-bottom: 0;">
              <label>Título:</label>
              <input type="text" id="edit-title-name" value="${esc(titleData.title)}" required />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>Año de estreno:</label>
              <input type="number" id="edit-title-year" value="${titleData.year || ''}" placeholder="Ej: 2024" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 0.9rem; margin-top: 0.8rem;">
            <div class="form-group" style="margin-bottom: 0;">
              <label>Nota general (1.0 a 10.0):</label>
              <input type="number" step="0.1" min="1" max="10" id="edit-title-score" value="${Number(titleData.vote_average || 0).toFixed(1)}" />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>URL Imagen Póster:</label>
              <input type="url" id="edit-title-poster" value="${esc(titleData.image || '')}" placeholder="https://..." />
            </div>
          </div>

          <div class="form-group" style="margin-top: 0.8rem;">
            <label>Sinopsis:</label>
            <textarea id="edit-title-overview" rows="3">${esc(titleData.overview || '')}</textarea>
          </div>

          <div id="dynamic-seasons-area">
            ${renderSeasonsEditorHTML()}
          </div>
        `,
        async () => {
          const title = document.querySelector('#edit-title-name')?.value.trim();
          const overview = document.querySelector('#edit-title-overview')?.value.trim();
          const year = document.querySelector('#edit-title-year')?.value;
          const vote_average = document.querySelector('#edit-title-score')?.value;
          const poster = document.querySelector('#edit-title-poster')?.value.trim();

          if (!title) {
            toast('El título es obligatorio', 'error');
            return false;
          }

          try {
            // Guardar cambios principales del título
            await request(`/catalog/${id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                title,
                overview,
                year,
                vote_average,
                poster
              }),
            });

            // Guardar cambios en capítulos modificados
            const epRows = document.querySelectorAll('#dynamic-seasons-area tr[data-ep-id]');
            const epPromises = [];
            epRows.forEach(row => {
              const epId = row.dataset.epId;
              const name = row.querySelector('.ep-field-name')?.value;
              const score = row.querySelector('.ep-field-score')?.value;
              epPromises.push(
                request(`/api/episodes/${epId}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ name, score })
                }).catch(err => console.error('Error saving ep', epId, err))
              );
            });
            await Promise.all(epPromises);

            toast('Título y capítulos actualizados exitosamente', 'ok');
            location.hash = '/catalogo';
            setTimeout(() => { location.hash = '/moderacion'; }, 20);
          } catch (err) {
            toast(err.data?.error || err.message || 'Error al actualizar título', 'error');
            return false;
          }
        },
        { size: 'lg', confirmText: 'Guardar cambios' }
      );

      // Eventos dinámicos dentro del modal de edición
      const attachDynamicEvents = () => {
        const seasonsArea = modalEl.querySelector('#dynamic-seasons-area');
        if (!seasonsArea) return;

        // Agregar nueva temporada
        modalEl.querySelector('#btn-add-new-season')?.addEventListener('click', async () => {
          const nextSeasonNum = (titleData.seasons || []).length + 1;
          const defaultScore = Number(document.querySelector('#edit-title-score')?.value) || 8.0;
          const epCountStr = prompt(`¿Cuántos capítulos tendrá la Temporada ${nextSeasonNum}?`, '8');
          if (!epCountStr) return;
          const epCount = Math.max(1, Math.min(50, Number(epCountStr) || 8));

          try {
            await request(`/catalog/${id}/seasons`, {
              method: 'POST',
              body: JSON.stringify({
                episodes_count: epCount,
                default_score: defaultScore
              })
            });
            toast(`Temporada ${nextSeasonNum} creada con ${epCount} capítulos`, 'ok');
            // Recargar datos y refrescar área de temporadas
            titleData = await request(`/catalog/${id}`);
            seasonsArea.innerHTML = renderSeasonsEditorHTML();
            attachDynamicEvents();
          } catch (err) {
            toast(err.data?.error || 'Error al agregar temporada', 'error');
          }
        });

        // Eliminar temporada
        modalEl.querySelectorAll('.btn-delete-season').forEach(delBtn => {
          delBtn.addEventListener('click', async () => {
            const seasonId = delBtn.dataset.seasonId;
            const seasonName = delBtn.dataset.seasonName;
            if (!confirm(`¿Eliminar ${seasonName} y todos sus capítulos?`)) return;

            try {
              await request(`/catalog/${id}/seasons/${seasonId}`, { method: 'DELETE' });
              toast(`${seasonName} eliminada`, 'ok');
              titleData = await request(`/catalog/${id}`);
              seasonsArea.innerHTML = renderSeasonsEditorHTML();
              attachDynamicEvents();
            } catch {
              toast('Error al eliminar temporada', 'error');
            }
          });
        });

        // Agregar capítulo a temporada
        modalEl.querySelectorAll('.btn-add-ep-to-season').forEach(addBtn => {
          addBtn.addEventListener('click', async () => {
            const seasonId = addBtn.dataset.seasonId;
            const seasonNum = addBtn.dataset.seasonNum;
            const sEps = (titleData.episodes || []).filter(ep => ep.temporada_id === Number(seasonId));
            const nextEpNum = sEps.length + 1;
            const name = prompt(`Nombre del capítulo ${nextEpNum}:`, `Episodio ${nextEpNum}`);
            if (!name) return;
            const defaultScore = Number(document.querySelector('#edit-title-score')?.value) || 8.0;

            try {
              await request(`/catalog/${id}/seasons/${seasonId}/episodes`, {
                method: 'POST',
                body: JSON.stringify({
                  name,
                  score: defaultScore
                })
              });
              toast(`Capítulo agregado a Temporada ${seasonNum}`, 'ok');
              titleData = await request(`/catalog/${id}`);
              seasonsArea.innerHTML = renderSeasonsEditorHTML();
              attachDynamicEvents();
            } catch {
              toast('Error al agregar capítulo', 'error');
            }
          });
        });

        // Eliminar capítulo individual
        modalEl.querySelectorAll('.btn-delete-ep').forEach(delEpBtn => {
          delEpBtn.addEventListener('click', async () => {
            const epId = delEpBtn.dataset.epId;
            if (!confirm('¿Eliminar este capítulo?')) return;
            try {
              await request(`/api/episodes/${epId}`, { method: 'DELETE' });
              toast('Capítulo eliminado', 'ok');
              titleData = await request(`/catalog/${id}`);
              seasonsArea.innerHTML = renderSeasonsEditorHTML();
              attachDynamicEvents();
            } catch {
              toast('Error al eliminar capítulo', 'error');
            }
          });
        });
      };

      setTimeout(attachDynamicEvents, 60);
    });
  });

  // gestion catalogo: eliminar titulo
  document.querySelectorAll('.btn-delete-title').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      confirmModal(
        'Eliminar título del catálogo',
        '¿Confirmás la eliminación permanente de este título? Se borrarán sus episodios, reseñas y calificaciones.',
        async () => {
          try {
            await request(`/catalog/${id}`, { method: 'DELETE' });
            toast('Título eliminado del catálogo', 'ok');
            location.hash = '/catalogo';
            setTimeout(() => { location.hash = '/moderacion'; }, 20);
          } catch {
            toast('Error al eliminar título', 'error');
          }
        }
      );
    });
  });

  // gestion usuarios: alta de usuario (admin)
  document.querySelector('#btn-create-user-modal')?.addEventListener('click', () => {
    modal(
      'Alta de usuario en el sistema',
      `
        <div class="form-group">
          <label>Nombre:</label>
          <input type="text" id="new-user-name" placeholder="Ej: Lucas Martínez" required />
        </div>
        <div class="form-group">
          <label>Email:</label>
          <input type="email" id="new-user-email" placeholder="usuario@seriescore.local" required />
        </div>
        <div class="form-group">
          <label>Contraseña inicial:</label>
          <input type="password" id="new-user-pass" value="Seriescore1" required />
        </div>
        <div class="form-group">
          <label>Rol asignado:</label>
          <select id="new-user-role">
            <option value="Usuario">Usuario</option>
            <option value="Moderador">Moderador</option>
            <option value="Administrador">Administrador</option>
          </select>
        </div>
      `,
      async () => {
        const name = document.querySelector('#new-user-name')?.value.trim();
        const email = document.querySelector('#new-user-email')?.value.trim();
        const password = document.querySelector('#new-user-pass')?.value;
        const role = document.querySelector('#new-user-role')?.value;
        if (!name || !email || !password) {
          toast('Completá todos los campos', 'error');
          return false;
        }
        try {
          await request('/users', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, role }),
          });
          toast(`Usuario "${name}" creado exitosamente`, 'ok');
          document.querySelector('#btn-create-user-modal')?.closest('.modal')?.remove();
          location.reload();
        } catch (err) {
          toast(err.data?.error || 'Error al crear usuario', 'error');
        }
      }
    );
  });

  // gestion usuarios: cambio de rol en tiempo real
  document.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.id;
      const newRole = sel.value;
      try {
        await request(`/users/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ role: newRole }),
        });
        toast(`Rol actualizado a ${newRole}`, 'ok');
      } catch {
        toast('Error al cambiar rol', 'error');
      }
    });
  });

  // gestion usuarios: baja de usuario
  document.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      confirmModal(
        'Baja de usuario',
        `¿Confirmás la eliminación permanente de la cuenta de ${name}?`,
        async () => {
          try {
            await request(`/users/${id}`, { method: 'DELETE' });
            toast(`Usuario ${name} eliminado`, 'ok');
            btn.closest('tr')?.remove();
          } catch {
            toast('No se pudo eliminar el usuario', 'error');
          }
        }
      );
    });
  });
}