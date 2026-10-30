import { currentUser } from '../Modules/api.js';
import { esc } from '../Modules/ui.js';

export async function perfil() {
  const user = currentUser();
  if (!user) {
    location.hash = '/auth';
    return '';
  }

  return `
    <section class="profile-page">
      <div class="page-header">
        <div>
          <span class="eyebrow">CUENTA PERSONAL</span>
          <h1>Perfil de ${esc(user.name)}</h1>
          <p>Consultá la información de tu cuenta SerieScore.</p>
        </div>
      </div>

      <div class="profile-grid">
        <article class="glass profile-summary">
          <div class="user-chip-avatar profile-avatar">${esc((user.name || 'U')[0].toUpperCase())}</div>
          <div>
            <strong>${esc(user.name)}</strong>
            <span>${esc(user.email)}</span>
            <small>${esc(user.role)}</small>
          </div>
        </article>
      </div>
    </section>
  `;
}

export function wirePerfil() {}
