// logica y eventos de autenticacion y roles

import { request, saveSession, logout, currentUser } from '../Modules/api.js';
import { bindValidation, validateForm } from './validaciones.js';
import { toast } from '../Modules/ui.js';

export function wireAuth() {
  const form = document.querySelector('#auth-form');
  if (!form) return;

  let currentTab = 'login';
  const nameGroup = document.querySelector('#group-name');
  const nameInput = document.querySelector('#input-name');
  const emailInput = document.querySelector('#input-email');
  const passInput = document.querySelector('#input-password');
  const submitBtn = document.querySelector('#auth-submit');
  const alertBox = document.querySelector('#auth-alert');
  const tabs = document.querySelectorAll('.auth-tab');
  const passwordToggle = document.querySelector('#toggle-password');

  bindValidation(form);

  passwordToggle?.addEventListener('click', () => {
    const show = passInput.type === 'password';
    passInput.type = show ? 'text' : 'password';
    passwordToggle.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    passwordToggle.title = show ? 'Ocultar contraseña' : 'Mostrar contraseña';
    passwordToggle.classList.toggle('active', show);
  });

  const showAlert = (msg, isError = true) => {
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.className = `auth-alert ${isError ? 'error' : 'ok'}`;
    alertBox.style.display = 'block';
  };

  const clearAlert = () => {
    if (alertBox) alertBox.style.display = 'none';
  };

  // deteccion de retorno de redireccion oauth (si vino desde Google, GitHub o Discord)
  const checkOAuthRedirect = () => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const paramsString = hash.includes('?') ? hash.split('?')[1] : search.replace(/^\?/, '');
    if (!paramsString) return;

    const params = new URLSearchParams(paramsString);
    const oauthError = params.get('oauth_error');
    const oauthToken = params.get('oauth_token');
    const oauthRefresh = params.get('oauth_refresh');
    const oauthUserRaw = params.get('oauth_user');
    const oauthProvider = params.get('oauth_provider') || 'social';

    if (oauthError) {
      showAlert(`Error en autenticación ${oauthProvider}: ${decodeURIComponent(oauthError)}`);
      window.location.hash = '/auth';
      return;
    }

    if (oauthToken && oauthRefresh) {
      try {
        const user = oauthUserRaw ? JSON.parse(decodeURIComponent(oauthUserRaw)) : null;
        saveSession({ accessToken: oauthToken, refreshToken: oauthRefresh, user });
        toast(`¡Bienvenido/a ${user?.name || ''}! Conectado vía ${oauthProvider.toUpperCase()}`, 'ok');
        window.location.hash = '/catalogo';
      } catch (err) {
        console.error('Error al guardar sesión oauth:', err);
      }
    }
  };
  checkOAuthRedirect();

  // cambio entre login y registro
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      clearAlert();

      if (currentTab === 'register') {
        nameGroup.style.display = 'block';
        nameInput.required = true;
        submitBtn.textContent = 'Crear cuenta en SerieScore';
      } else {
        nameGroup.style.display = 'none';
        nameInput.required = false;
        submitBtn.textContent = 'Entrar a SerieScore';
      }
    });
  });

  // envio del formulario principal
  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert();

    if (!validateForm(form)) {
      return;
    }

    const payload = {
      email: emailInput.value.trim().toLowerCase(),
      password: passInput.value,
    };
    if (currentTab === 'register') {
      payload.name = nameInput.value.trim();
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Procesando...';

      if (currentTab === 'login') {
        const res = await request('/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        saveSession(res);
        toast(`¡Bienvenido/a ${res.user.name}!`, 'ok');
        location.hash = '/catalogo';
      } else {
        const res = await request('/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        saveSession(res);
        toast(`¡Cuenta creada con éxito! Bienvenido/a`, 'ok');
        location.hash = '/catalogo';
      }
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = currentTab === 'login' ? 'Entrar a SerieScore' : 'Crear cuenta en SerieScore';
      const msg = err.data?.error === 'CREDENCIALES_INVALIDAS'
        ? 'El correo electrónico o la contraseña son incorrectos.'
        : err.data?.error === 'EMAIL_EXISTENTE'
        ? 'Ese correo ya está registrado.'
        : err.data?.error === 'DATOS_INVALIDOS'
        ? 'Por favor revisá los campos del formulario.'
        : 'Ocurrió un error. Verificá tus datos.';
      showAlert(msg);
    }
  });

  // Botones de login social: redireccion directa al proveedor OAuth
  document.querySelectorAll('.btn-social').forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.dataset.provider;
      if (!provider) return;
      // Redirigir directamente al endpoint OAuth del servidor
      // que a su vez redirige a Google/Discord/GitHub
      window.location.href = `/api/auth/oauth/${provider}`;
    });
  });
}

export { logout, currentUser };
