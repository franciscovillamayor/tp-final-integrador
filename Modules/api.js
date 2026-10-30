// cliente api para comunicacion con el backend
const API = '/api';

export const tokens = {
  get access() { return localStorage.getItem('ss_access'); },
  set access(v) { v ? localStorage.setItem('ss_access', v) : localStorage.removeItem('ss_access'); },
  get refresh() { return localStorage.getItem('ss_refresh'); },
  set refresh(v) { v ? localStorage.setItem('ss_refresh', v) : localStorage.removeItem('ss_refresh'); },
};

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

// realiza peticiones http con jwt y rotacion automatica de refresh token
export async function request(path, options = {}) {
  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  if (tokens.access) {
    headers.Authorization = 'Bearer ' + tokens.access;
  }

  const response = await fetch(API + path, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  // deteccion de usuario baneado
  if (response.status === 403 && data.error === 'USUARIO_BANEADO') {
    localStorage.setItem('ss_active_ban', JSON.stringify(data.ban || {}));
    if (!location.hash.includes('baneo')) {
      location.hash = '/baneo';
    }
    const error = new Error('USUARIO_BANEADO');
    error.status = 403;
    error.data = data;
    throw error;
  }

  // manejo y rotacion automatica de token expirado (401)
  if (response.status === 401 && tokens.refresh && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(API + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refresh }),
        });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.accessToken) {
          tokens.access = refreshData.accessToken;
          tokens.refresh = refreshData.refreshToken;
          isRefreshing = false;
          onRefreshed(refreshData.accessToken);
          return request(path, options);
        }
        logout();
        isRefreshing = false;
        location.hash = '/auth';
      } catch {
        logout();
        isRefreshing = false;
        location.hash = '/auth';
      }
    } else {
      return new Promise(resolve => {
        subscribeTokenRefresh(() => {
          resolve(request(path, options));
        });
      });
    }
  }

  if (!response.ok) {
    const error = new Error(data.error || 'ERROR_SERVICIO');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const saveSession = data => {
  tokens.access = data.accessToken;
  tokens.refresh = data.refreshToken;
  localStorage.setItem('ss_user', JSON.stringify(data.user));
  localStorage.removeItem('ss_active_ban');
};

export const currentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('ss_user') || 'null');
  } catch {
    return null;
  }
};

export const logout = async () => {
  try {
    if (tokens.access) {
      await fetch(API + '/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + tokens.access },
      });
    }
  } catch {}
  tokens.access = null;
  tokens.refresh = null;
  localStorage.removeItem('ss_user');
  localStorage.removeItem('ss_active_ban');
};

export const getActiveBan = async () => {
  try {
    const ban = await request('/me/ban');
    if (ban) localStorage.setItem('ss_active_ban', JSON.stringify(ban));
    else localStorage.removeItem('ss_active_ban');
    return ban;
  } catch {
    return null;
  }
};
