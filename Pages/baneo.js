// pantalla de baneo y formulario de apelaciones para usuarios suspendidos

import { request, logout, currentUser, getActiveBan } from '../Modules/api.js';
import { toast, esc, formatDate } from '../Modules/ui.js';

export async function baneo() {
  const user = currentUser();
  const ban = await getActiveBan();

  return `
    <section class="ban-page-wrapper">
      <div class="ban-card glass">
        <div class="ban-icon-alert"><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg></div>
        <span class="eyebrow" style="color: #f87171;">SEGURIDAD & MODERACIÓN</span>
        <h1 class="ban-title">Tu cuenta ha sido suspendida</h1>
        <p class="ban-desc">
          Detectamos un incumplimiento en los términos de la comunidad de SerieScore y se ha aplicado una restricción sobre tu cuenta.
        </p>

        <div class="ban-details glass">
          <div class="ban-detail-row">
            <span>Usuario afectado:</span>
            <strong>${esc(user?.name || 'Tu cuenta')} (${esc(user?.email || '')})</strong>
          </div>
          <div class="ban-detail-row">
            <span>Motivo de la sanción:</span>
            <strong style="color: #f87171;">${esc(ban?.motivo || 'Incumplimiento de las normas de convivencia')}</strong>
          </div>
          <div class="ban-detail-row">
            <span>Finalización de la sanción:</span>
            <strong>${ban?.fin ? formatDate(ban.fin) : 'Permanente'}</strong>
          </div>
        </div>

        <div class="ban-appeal-box glass">
          <h3>Presentar apelación</h3>
          <p>Si considerás que esta medida fue aplicada por error, podés enviar una solicitud al equipo de moderación:</p>
          <form id="appeal-form">
            <textarea id="appeal-message" placeholder="Explicá con respeto por qué solicitás la reconsideración de tu sanción..." required></textarea>
            <button type="submit" class="btn primary" id="btn-submit-appeal">Enviar apelación</button>
          </form>
        </div>

        <div class="ban-footer">
          <button type="button" class="btn ghost" id="btn-ban-logout">Cerrar sesión</button>
        </div>
      </div>
    </section>
  `;
}

export function wireBaneo() {
  const form = document.querySelector('#appeal-form');
  const logoutBtn = document.querySelector('#btn-ban-logout');

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.querySelector('#appeal-message')?.value.trim();
    if (!msg) {
      toast('Por favor escribí el mensaje de apelación', 'error');
      return;
    }
    const btn = document.querySelector('#btn-submit-appeal');
    try {
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      await request('/apelaciones', {
        method: 'POST',
        body: JSON.stringify({ message: msg }),
      });
      toast('Tu apelación ha sido enviada al equipo de moderación', 'ok');
      form.innerHTML = '<div class="glass ok-box" style="padding: 1.5rem; color: #4ade80; text-align: center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Tu apelación ya fue registrada y está pendiente de revisión por un moderador.</div>';
    } catch {
      btn.disabled = false;
      btn.textContent = 'Enviar apelación';
      toast('Error al enviar la apelación', 'error');
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    await logout();
    location.hash = '/auth';
  });
}
