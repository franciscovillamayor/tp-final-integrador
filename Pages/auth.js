// pagina de autenticacion y registro con estetica cinematografica

export function authPage() {
  return `
    <section class="auth-wrapper">
      <div class="auth-hero-glow" aria-hidden="true"></div>
      
      <div class="auth-container">
        <div class="auth-intro">
          <span class="eyebrow">SERIESCORE · CINE & SERIES</span>
          <h1 class="auth-title">Todo lo que vimos.<br><span class="neon-text">Todo lo que sentimos.</span></h1>
          <p class="auth-subtitle">
            Calificá películas y series, explorá la evolución de cada temporada con gráficos interactivos y llevá tu diario personal de visualizaciones.
          </p>
        </div>

        <div class="auth-card glass">
          <div class="auth-tabs">
            <button class="auth-tab active" data-tab="login">Iniciar sesión</button>
            <button class="auth-tab" data-tab="register">Crear cuenta</button>
          </div>

          <form id="auth-form" class="auth-form" novalidate>
            <div class="form-group" id="group-name" style="display: none;">
              <label for="input-name">Nombre</label>
              <input id="input-name" name="name" type="text" placeholder="Ingresá tu nombre" data-valid="name" autocomplete="name" />
              <small class="field-error" data-error="name"></small>
            </div>

            <div class="form-group">
              <label for="input-email">Correo electrónico</label>
              <input id="input-email" name="email" type="email" placeholder="tu@email.com" data-valid="email" autocomplete="email" required />
              <small class="field-error" data-error="email"></small>
            </div>

            <div class="form-group">
              <label for="input-password">Contraseña</label>
              <div class="password-field">
                <input id="input-password" name="password" type="password" placeholder="••••••••" data-valid="password" autocomplete="current-password" required />
                <button type="button" id="toggle-password" class="password-toggle" aria-label="Mostrar contraseña" title="Mostrar contraseña">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
              <small class="field-error" data-error="password"></small>
            </div>

            <div class="auth-alert" id="auth-alert" style="display: none;"></div>

            <button type="submit" class="btn primary full-width" id="auth-submit">
              Entrar a SerieScore
            </button>
          </form>

          <div class="social-divider">
            <span>o continuá con</span>
          </div>

          <div class="social-grid">
            <button type="button" class="btn-social" data-provider="google">
              <svg class="social-icon-svg" width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Google
            </button>
            <button type="button" class="btn-social" data-provider="discord">
              <svg class="social-icon-svg" width="18" height="18" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1099 30.1693C30.1099 34.1136 27.2802 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7680 23.0133 47.3178 23.0133C50.9020 23.0133 53.7565 26.2532 53.7099 30.1693C53.7099 34.1136 50.9020 37.3253 47.3178 37.3253Z" fill="#5865F2"/>
              </svg>
              Discord
            </button>
            <button type="button" class="btn-social" data-provider="github">
              <svg class="social-icon-svg" width="18" height="18" viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" fill="#ffffff"/>
              </svg>
              GitHub
            </button>
          </div>
        </div>
      </div>


    </section>
  `;
}
