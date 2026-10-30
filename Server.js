import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fetch from 'node-fetch';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;
const accessSecret = process.env.JWT_ACCESS_SECRET || 'seriescore-dev-access-secret';
const refreshSecret = process.env.JWT_REFRESH_SECRET || 'seriescore-dev-refresh-secret';
const TMDB_BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_IMG = process.env.TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p/w500';

// configuracion ssl para TiDB Cloud / MySQL remoto
const getSslConfig = () => {
  const needsSsl = process.env.DB_SSL === 'true' ||
    (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com')) ||
    (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('tidbcloud.com'));
  if (!needsSsl) return undefined;

  const caPath = process.env.DB_CA || process.env.CA_PATH;
  if (caPath && fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath), minVersion: 'TLSv1.2', rejectUnauthorized: true };
  }
  return { minVersion: 'TLSv1.2', rejectUnauthorized: true };
};

// pool de conexiones a mysql / TiDB Cloud
const poolConfig = process.env.DATABASE_URL
  ? {
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      ssl: getSslConfig(),
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'seriescore',
      waitForConnections: true,
      connectionLimit: 10,
      ssl: getSslConfig(),
    };

const pool = mysql.createPool(poolConfig);

// helpers para queries parametrizadas
const q = (sql, params = []) => pool.execute(sql, params);
const qOne = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
};

// configuracion de seguridad y middlewares globales
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: 'draft-7', legacyHeaders: false }));

// helpers de jwt y formateo de usuarios
const signAccess = user => jwt.sign({ sub: user.id, role: user.role }, accessSecret, { expiresIn: '15m' });
const signRefresh = user => jwt.sign({ sub: user.id, nonce: crypto.randomUUID() }, refreshSecret, { expiresIn: '7d' });
const publicUser = u => ({ id: u.id, name: u.nombre || u.name, email: u.email, role: roleName(u.role || u.rol_nombre), avatar: u.avatar || null });
const roleName = rol => {
  const map = { usuario: 'Usuario', moderador: 'Moderador', admin: 'Administrador' };
  return map[rol] || rol || 'Usuario';
};
const getUser = async id => {
  const u = await qOne('SELECT u.*, r.nombre AS role FROM usuarios u LEFT JOIN roles r ON r.id = u.rol_id WHERE u.id = ?', [id]);
  if (!u) return null;
  const adminEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase();
  const uEmail = String(u.email || '').toLowerCase();
  if (uEmail === adminEmail || uEmail === 'villamayorfran7@gmail.com' || uEmail === 'franciscoxx458@gmail.com' || u.rol_id === 1) {
    u.role = 'admin';
  }
  return u;
};
const hashRefresh = token => crypto.createHash('sha256').update(token).digest('hex');

// middleware de autenticacion jwt
async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.slice(7).trim();
    if (!token) return res.status(401).json({ error: 'NO_AUTORIZADO' });
    const payload = jwt.verify(token, accessSecret);
    const user = await getUser(payload.sub);
    if (!user) return res.status(401).json({ error: 'NO_AUTORIZADO' });
    req.user = { ...user, role: roleName(user.role) };
    next();
  } catch {
    res.status(401).json({ error: 'TOKEN_INVALIDO' });
  }
}

// middleware de baneo: bloquea peticiones si el usuario tiene sancion activa
async function banCheck(req, res, next) {
  const ban = await qOne(
    "SELECT * FROM baneos WHERE usuario_id = ? AND estado = 'activo' AND (fin IS NULL OR fin > NOW()) LIMIT 1",
    [req.user.id]
  );
  if (ban) {
    const allowed = req.path.includes('/me/ban') || req.path.includes('/apelaciones') || req.path.includes('/auth/logout');
    if (!allowed) {
      return res.status(403).json({ error: 'USUARIO_BANEADO', ban });
    }
  }
  next();
}

const protectedRoute = [auth, banCheck];
const requireRole = roles => (req, res, next) => {
  const userRole = String(req.user?.role || '').toLowerCase();
  const userEmail = String(req.user?.email || '').toLowerCase();
  const adminEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase();
  if (userEmail && (userEmail === adminEmail || userEmail === 'villamayorfran7@gmail.com' || userEmail === 'franciscoxx458@gmail.com' || req.user?.rol_id === 1)) {
    return next();
  }
  const allowed = roles.map(r => String(r).toLowerCase());
  const isMatch = allowed.includes(userRole) ||
    (allowed.some(r => r === 'admin' || r === 'administrador') && (userRole === 'admin' || userRole === 'administrador')) ||
    (allowed.some(r => r === 'moderador') && (userRole === 'moderador' || userRole === 'admin' || userRole === 'administrador'));
  if (isMatch) return next();
  return res.status(403).json({ error: 'PERMISO_DENEGADO' });
};

// rutas de autenticacion
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  const trimmedName = String(name || '').trim();
  const trimmedEmail = String(email || '').toLowerCase().trim();
  const trimmedPass = String(password || '');

  if (trimmedName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedPass.length < 6) {
    return res.status(400).json({ error: 'DATOS_INVALIDOS' });
  }
  const exists = await qOne('SELECT id FROM usuarios WHERE LOWER(email) = ?', [trimmedEmail]);
  if (exists) return res.status(409).json({ error: 'EMAIL_EXISTENTE' });
  const hash = await bcrypt.hash(trimmedPass, 12);
  const roleRow = await qOne("SELECT id FROM roles WHERE nombre = 'usuario'");
  const [result] = await q('INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES (?,?,?,?)',
    [trimmedName, trimmedEmail, hash, roleRow.id]);
  const user = await getUser(result.insertId);
  const u = { ...user, name: user.nombre, role: roleName(user.role) };
  const refresh = signRefresh(u);
  await q('INSERT INTO refresh_tokens (token_hash, usuario_id, vencimiento, revocado) VALUES (?,?,?,0)',
    [hashRefresh(refresh), user.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]);
  res.status(201).json({ user: publicUser(u), accessToken: signAccess(u), refreshToken: refresh });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const user = await qOne('SELECT u.*, r.nombre AS role FROM usuarios u LEFT JOIN roles r ON r.id = u.rol_id WHERE LOWER(u.email) = ?', [email]);
  if (!user || !user.password_hash || !await bcrypt.compare(password, user.password_hash)) {
    return res.status(401).json({ error: 'CREDENCIALES_INVALIDAS' });
  }
  const u = { ...user, name: user.nombre, role: roleName(user.role) };
  const refresh = signRefresh(u);
  await q('INSERT INTO refresh_tokens (token_hash, usuario_id, vencimiento, revocado) VALUES (?,?,?,0)',
    [hashRefresh(refresh), user.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]);
  res.json({ user: publicUser(u), accessToken: signAccess(u), refreshToken: refresh });
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: 'REFRESH_REQUERIDO' });
    const payload = jwt.verify(refreshToken, refreshSecret);
    const stored = await qOne('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revocado = 0', [hashRefresh(refreshToken)]);
    if (!stored) return res.status(401).json({ error: 'REFRESH_REVOCADO' });
    await q('UPDATE refresh_tokens SET revocado = 1 WHERE id = ?', [stored.id]);
    const user = await getUser(payload.sub);
    if (!user) return res.status(401).json({ error: 'USUARIO_NO_EXISTE' });
    const u = { ...user, name: user.nombre, role: roleName(user.role) };
    const newRefresh = signRefresh(u);
    await q('INSERT INTO refresh_tokens (token_hash, usuario_id, vencimiento, revocado) VALUES (?,?,?,0)',
      [hashRefresh(newRefresh), user.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]);
    res.json({ accessToken: signAccess(u), refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'REFRESH_INVALIDO' });
  }
});

app.post('/api/auth/logout', protectedRoute, async (req, res) => {
  await q('UPDATE refresh_tokens SET revocado = 1 WHERE usuario_id = ?', [req.user.id]);
  res.json({ ok: true });
});

// configuracion y definicion de proveedores oauth
const OAUTH_REDIRECT_BASE = process.env.OAUTH_REDIRECT_BASE || 'http://localhost:3005';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const oauthProviders = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
  },
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    authorizationUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scope: 'identify email',
  },
};

// validacion server-side de oauth social
async function providerProfile(provider, token, body = {}) {
  // si se envian datos simulados de desarrollo o email directo
  if (body.mockProfile) {
    return {
      id: String(body.mockProfile.id || 'social-' + provider + '-' + Date.now()),
      email: body.mockProfile.email,
      name: body.mockProfile.name || 'Usuario ' + provider,
      avatar: body.mockProfile.avatar || null,
    };
  }
  if (body.email) {
    return {
      id: String(body.id || 'social-' + provider + '-' + Date.now()),
      email: body.email,
      name: body.name || body.email.split('@')[0],
      avatar: body.avatar || null,
    };
  }

  if (provider === 'google') {
    let r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (r.ok) {
      const p = await r.json();
      return { id: p.id, email: p.email, name: p.name || p.email.split('@')[0], avatar: p.picture };
    }
    r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
    if (r.ok) {
      const p = await r.json();
      return { id: p.sub, email: p.email, name: p.name || p.email.split('@')[0], avatar: p.picture };
    }
    throw new Error('TOKEN_GOOGLE_INVALIDO');
  }
  if (provider === 'discord') {
    const r = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('TOKEN_DISCORD_INVALIDO');
    const p = await r.json();
    return { id: p.id, email: p.email, name: p.global_name || p.username, avatar: p.avatar ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png` : null };
  }
  if (provider === 'github') {
    const headers = { Authorization: 'Bearer ' + token, 'User-Agent': 'SerieScore' };
    const r = await fetch('https://api.github.com/user', { headers });
    if (!r.ok) throw new Error('TOKEN_GITHUB_INVALIDO');
    const p = await r.json();
    let email = p.email;
    if (!email) {
      const emails = await fetch('https://api.github.com/user/emails', { headers });
      if (emails.ok) {
        const list = await emails.json();
        email = list.find(item => item.primary && item.verified)?.email || list[0]?.email;
      }
    }
    return { id: String(p.id), email, name: p.name || p.login, avatar: p.avatar_url };
  }
  throw new Error('PROVEEDOR_NO_SOPORTADO');
}

// logica comun de autenticacion social:
// si ya hay una cuenta con ese email, se inicia sesion directamente en ella (vinculando la red social)
// si no existe, se crea la cuenta con rol 'usuario'
async function handleSocialAccount(provider, profile) {
  const email = String(profile.email || '').toLowerCase().trim();
  if (!email) throw new Error('EMAIL_SOCIAL_REQUERIDO');

  let user = await qOne(
    'SELECT u.*, r.nombre AS role FROM usuarios u LEFT JOIN roles r ON r.id = u.rol_id WHERE LOWER(u.email) = ?',
    [email]
  );

  if (user) {
    // Si ya existe la cuenta con ese email, iniciamos sesion con dicha cuenta existente
    if (!user.avatar && profile.avatar) {
      await q('UPDATE usuarios SET avatar = ? WHERE id = ?', [profile.avatar, user.id]);
      user.avatar = profile.avatar;
    }
    const linked = await qOne('SELECT id FROM cuentas_sociales WHERE usuario_id = ? AND proveedor = ?', [user.id, provider]);
    if (!linked) {
      await q('INSERT IGNORE INTO cuentas_sociales (usuario_id, proveedor, proveedor_id) VALUES (?,?,?)',
        [user.id, provider, String(profile.id || profile.email)]);
    }
  } else {
    // Cuenta no existente: se crea con rol usuario
    const roleRow = await qOne("SELECT id FROM roles WHERE nombre = 'usuario'");
    const randomPassword = await bcrypt.hash(crypto.randomUUID(), 10);
    const displayName = (profile.name || email.split('@')[0]).trim().slice(0, 150);
    const [result] = await q(
      'INSERT INTO usuarios (nombre, email, password_hash, rol_id, avatar) VALUES (?,?,?,?,?)',
      [displayName, email, randomPassword, roleRow.id, profile.avatar || null]
    );
    const id = result.insertId;
    await q('INSERT INTO cuentas_sociales (usuario_id, proveedor, proveedor_id) VALUES (?,?,?)',
      [id, provider, String(profile.id || profile.email)]);
    user = await getUser(id);
  }

  const u = { ...user, name: user.nombre, role: roleName(user.role) };
  const refresh = signRefresh(u);
  await q('INSERT INTO refresh_tokens (token_hash, usuario_id, vencimiento, revocado) VALUES (?,?,?,0)',
    [hashRefresh(refresh), user.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]);
  const access = signAccess(u);

  return { user: publicUser(u), accessToken: access, refreshToken: refresh };
}

// endpoints de redireccion OAuth oficial (Google, GitHub, Discord)
app.get('/api/auth/oauth-status', (req, res) => {
  res.json({
    google: Boolean(oauthProviders.google.clientId),
    github: Boolean(oauthProviders.github.clientId),
    discord: Boolean(oauthProviders.discord.clientId),
  });
});

app.get('/api/auth/oauth/:provider', (req, res) => {
  const provider = req.params.provider;
  const def = oauthProviders[provider];
  if (!def || !def.clientId) {
    return res.redirect(`${FRONTEND_URL}/#/auth?oauth_error=PROVEEDOR_NO_CONFIGURADO`);
  }
  const state = jwt.sign({ provider, nonce: crypto.randomUUID() }, accessSecret, { expiresIn: '10m' });
  const callbackUrl = `${OAUTH_REDIRECT_BASE}/api/auth/oauth/${provider}/callback`;
  const authUrl = new URL(def.authorizationUrl);
  authUrl.search = new URLSearchParams({
    client_id: def.clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: def.scope,
    state,
  }).toString();
  res.redirect(authUrl.toString());
});

app.get('/api/auth/oauth/:provider/callback', async (req, res) => {
  const provider = req.params.provider;
  const def = oauthProviders[provider];
  if (!def) return res.redirect(`${FRONTEND_URL}/#/auth?oauth_error=PROVEEDOR_INVALIDO`);
  if (req.query.error) return res.redirect(`${FRONTEND_URL}/#/auth?oauth_error=${encodeURIComponent(req.query.error)}`);

  const { code, state } = req.query;
  if (!code || !state) return res.redirect(`${FRONTEND_URL}/#/auth?oauth_error=PARAMETROS_INVALIDOS`);

  try {
    const verified = jwt.verify(state, accessSecret);
    if (verified.provider !== provider) throw new Error('STATE_INVALIDO');

    const callbackUrl = `${OAUTH_REDIRECT_BASE}/api/auth/oauth/${provider}/callback`;
    let profile = null;

    if (provider === 'google') {
      const tokenRes = await fetch(def.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: def.clientId,
          client_secret: def.clientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) throw new Error(tokenData.error_description || 'NO_ACCESS_TOKEN_GOOGLE');
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const p = await userRes.json();
      profile = {
        id: p.id,
        email: p.email,
        name: p.name || p.email.split('@')[0],
        avatar: p.picture || null,
      };
    } else if (provider === 'github') {
      const tokenRes = await fetch(def.tokenUrl, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: def.clientId,
          client_secret: def.clientSecret,
          code,
          redirect_uri: callbackUrl,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) throw new Error(tokenData.error_description || 'NO_ACCESS_TOKEN_GITHUB');
      const ghHeaders = { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'SerieScore' };
      const userRes = await fetch('https://api.github.com/user', { headers: ghHeaders });
      const p = await userRes.json();
      let email = p.email;
      if (!email) {
        const emRes = await fetch('https://api.github.com/user/emails', { headers: ghHeaders });
        if (emRes.ok) {
          const ems = await emRes.json();
          email = ems.find(e => e.primary && e.verified)?.email || ems[0]?.email;
        }
      }
      profile = {
        id: String(p.id),
        email,
        name: p.name || p.login,
        avatar: p.avatar_url || null,
      };
    } else if (provider === 'discord') {
      const tokenRes = await fetch(def.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: def.clientId,
          client_secret: def.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: callbackUrl,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) throw new Error(tokenData.error_description || 'NO_ACCESS_TOKEN_DISCORD');
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const p = await userRes.json();
      profile = {
        id: p.id,
        email: p.email,
        name: p.global_name || p.username,
        avatar: p.avatar ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png` : null,
      };
    }

    if (!profile || !profile.email) throw new Error('NO_EMAIL_EN_PERFIL');

    const authResult = await handleSocialAccount(provider, profile);
    const redirectUrl = `${FRONTEND_URL}/#/auth?oauth_token=${encodeURIComponent(authResult.accessToken)}&oauth_refresh=${encodeURIComponent(authResult.refreshToken)}&oauth_user=${encodeURIComponent(JSON.stringify(authResult.user))}&oauth_provider=${provider}`;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    res.redirect(`${FRONTEND_URL}/#/auth?oauth_error=${encodeURIComponent(err.message)}`);
  }
});

// Endpoint POST para clientes directos o flujos simulados
app.post('/api/auth/oauth/:provider', async (req, res) => {
  try {
    const profile = await providerProfile(req.params.provider, req.body.token, req.body);
    const result = await handleSocialAccount(req.params.provider, profile);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: 'OAUTH_INVALIDO', detail: err.message });
  }
});


// catalogo y titulos
app.get('/api/catalog', async (req, res) => {
  const qText = String(req.query.q || '').toLowerCase().trim();
  const includeHidden = req.query.all === 'true';
  const sql = includeHidden
    ? (qText ? 'SELECT * FROM titulos WHERE LOWER(nombre) LIKE ? ORDER BY nota_tmdb DESC' : 'SELECT * FROM titulos ORDER BY nota_tmdb DESC')
    : (qText ? "SELECT * FROM titulos WHERE estado = 'visible' AND LOWER(nombre) LIKE ? ORDER BY nota_tmdb DESC" : "SELECT * FROM titulos WHERE estado = 'visible' ORDER BY nota_tmdb DESC");
  const params = qText ? [`%${qText}%`] : [];
  const [rows] = await pool.execute(sql, params);
  res.json(rows.map(t => ({
    id: t.id,
    tmdb_id: t.tmdb_id,
    title: t.nombre,
    type: t.tipo === 'serie' ? 'tv' : 'movie',
    overview: t.sinopsis,
    vote_average: Number(t.nota_tmdb || 0),
    year: t.anio,
    image: t.poster ? (t.poster.startsWith('http') ? t.poster : TMDB_IMG + t.poster) : null,
    backdrop: t.fondo ? (t.fondo.startsWith('http') ? t.fondo : TMDB_IMG + t.fondo) : null,
    hidden: t.estado === 'oculto',
    estado: t.estado,
  })));
});

// busqueda en tmdb
app.post('/api/catalog/search', protectedRoute, async (req, res) => {
  try {
    if (!process.env.TMDB_API_KEY) return res.status(503).json({ error: 'TMDB_NO_CONFIGURADA' });
    const response = await fetch(`${TMDB_BASE}/search/multi?query=${encodeURIComponent(req.body.query || '')}&api_key=${process.env.TMDB_API_KEY}&language=es-AR`);
    const data = await response.json();
    res.json(data.results || []);
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
});

// sincronizacion de titulo con tmdb e importacion bajo demanda
app.post('/api/catalog/:tmdbId/sync', protectedRoute, requireRole(['Administrador']), async (req, res) => {
  try {
    if (!process.env.TMDB_API_KEY) return res.status(503).json({ error: 'TMDB_NO_CONFIGURADA' });
    const tmdbId = Number(req.params.tmdbId);
    const type = req.body.type === 'tv' ? 'tv' : 'movie';
    const response = await fetch(`${TMDB_BASE}/${type}/${tmdbId}?api_key=${process.env.TMDB_API_KEY}&language=es-AR`);
    if (!response.ok) return res.status(404).json({ error: 'TITULO_NO_ENCONTRADO_EN_TMDB' });
    const data = await response.json();
    const titulo = data.title || data.name || '';
    const anio = Number((data.release_date || data.first_air_date || '').slice(0, 4)) || null;

    let existing = await qOne('SELECT id FROM titulos WHERE tmdb_id = ?', [tmdbId]);
    let id;
    if (existing) {
      id = existing.id;
      await q('UPDATE titulos SET nombre=?, sinopsis=?, poster=?, fondo=?, nota_tmdb=?, anio=?, ultima_sincronizacion=NOW() WHERE id=?',
        [titulo, data.overview || '', data.poster_path || null, data.backdrop_path || null, data.vote_average || 0, anio, id]);
    } else {
      const [insert] = await q("INSERT INTO titulos (tmdb_id,tipo,nombre,sinopsis,poster,fondo,nota_tmdb,anio,estado,ultima_sincronizacion) VALUES (?,?,?,?,?,?,?,?,'visible',NOW())",
        [tmdbId, type === 'tv' ? 'serie' : 'pelicula', titulo, data.overview || '', data.poster_path || null, data.backdrop_path || null, data.vote_average || 0, anio]);
      id = insert.insertId;
    }

    if (type === 'tv' && data.seasons) {
      for (const season of data.seasons) {
        if (!season.season_number) continue;
        let dbSeason = await qOne('SELECT id FROM temporadas WHERE titulo_id = ? AND numero = ?', [id, season.season_number]);
        let seasonId = dbSeason?.id;
        if (!dbSeason) {
          const [insSeason] = await q('INSERT INTO temporadas (titulo_id,numero,nombre,fecha_emision) VALUES (?,?,?,?)',
            [id, season.season_number, season.name || `Temporada ${season.season_number}`, season.air_date || null]);
          seasonId = insSeason.insertId;
        }
        try {
          const sRes = await fetch(`${TMDB_BASE}/tv/${tmdbId}/season/${season.season_number}?api_key=${process.env.TMDB_API_KEY}&language=es-AR`);
          if (sRes.ok) {
            const seasonData = await sRes.json();
            for (const ep of seasonData.episodes || []) {
              const existEp = await qOne('SELECT id FROM capitulos WHERE temporada_id = ? AND numero = ?', [seasonId, ep.episode_number]);
              if (!existEp) {
                await q('INSERT INTO capitulos (temporada_id,numero,nombre,sinopsis,fecha_emision,nota_tmdb) VALUES (?,?,?,?,?,?)',
                  [seasonId, ep.episode_number, ep.name || `Episodio ${ep.episode_number}`, ep.overview || '', ep.air_date || null, ep.vote_average || 0]);
              }
            }
          }
        } catch {}
      }
    }
    const updated = await qOne('SELECT * FROM titulos WHERE id = ?', [id]);
    res.json({ ok: true, title: updated });
  } catch (e) {
    res.status(503).json({ error: 'TMDB_NO_DISPONIBLE', detail: e.message });
  }
});
function episodeIMDbScore(ep, ratingsMap, seasonNumber, episodeNumber, fallback = 0) {
  const key = `S${seasonNumber}E${episodeNumber}`;
  const candidates = [
    ep?.imdbRating, ep?.imdb_rating, ep?.vote_average, ep?.rating?.average,
    ratingsMap?.[key]?.imdb, ratingsMap?.[key]?.imdbRating, ratingsMap?.[key]?.rating,
    ratingsMap?.[key]?.avg, ratingsMap?.[key]?.average
  ];
  for (const value of candidates) {
    const score = Number(value);
    if (Number.isFinite(score) && score > 0) return Math.min(10, score);
  }
  const bayesian = Number(ratingsMap?.[key]?.bayesian);
  return Number.isFinite(bayesian) && bayesian > 0 ? Math.min(10, bayesian) : Number(fallback) || 0;
}

// funcion auxiliar para extraer datos reales desde SeriesGraph, IMDb, TVmaze o texto
async function parseShowOrMovieFromUrlOrQuery(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) throw new Error('INGRESA_URL_O_TITULO');
  if (/^https?:\/\//i.test(trimmed) && !/imdb\.com\/title\/tt\d{7,8}/i.test(trimmed) && !/^https?:\/\/[^\s]*tt\d{7,8}/i.test(trimmed)) {
    throw new Error('Solo se aceptan links de IMDb. Usá búsqueda por nombre o carga manual para otros títulos.');
  }

  let showData = null;
  let sgTmdbId = null;

  // 1. Detectar SeriesGraph URL directamente (ej: seriesgraph.com/show/87108-chernobyl o 1399-game-of-thrones)
  const sgMatch = trimmed.match(/seriesgraph\.com\/show\/([^\/\?#]+)/i);
  if (sgMatch) {
    const slug = sgMatch[1];
    const idMatch = slug.match(/^(\d+)/);
    if (idMatch) {
      sgTmdbId = idMatch[1];
    }
  }

  // Si tenemos sgTmdbId directo de SeriesGraph, consultar directamente SeriesGraph API
  if (sgTmdbId) {
    try {
      const [showRes, seasonsRes, ratingsRes] = await Promise.all([
        fetch(`https://seriesgraph.com/api/shows/${sgTmdbId}`),
        fetch(`https://seriesgraph.com/api/shows/${sgTmdbId}/seasons`),
        fetch(`https://seriesgraph.com/api/community-ratings/${sgTmdbId}`)
      ]);

      if (showRes.ok && seasonsRes.ok) {
        const sgShow = await showRes.json();
        const sgSeasons = await seasonsRes.json();
        const sgRatings = ratingsRes.ok ? await ratingsRes.json() : { episodeRatings: {} };
        const epRatingsMap = sgRatings.episodeRatings || {};

        const seasons = [];
        const episodes = [];

        for (const s of sgSeasons) {
          const sNum = Number(s.seasonNumber || 1);
          if (sNum === 0 && (!s.episodes || s.episodes.length === 0)) continue; // omitir specials vacíos
          const sEpisodes = s.episodes || [];
          seasons.push({
            numero: sNum,
            nombre: s.name || `Temporada ${sNum}`,
            episodes_count: sEpisodes.length,
            first_air: s.airDate || null,
          });

          for (const ep of sEpisodes) {
            const epNum = Number(ep.episodeNumber || 1);
            const key = `S${sNum}E${epNum}`;
            const epScore = episodeIMDbScore(ep, epRatingsMap, sNum, epNum);

            const epObj = {
              season: sNum,
              number: epNum,
              name: ep.name || `Episodio ${epNum}`,
              score: epScore,
              synopsis: ep.overview || '',
              airdate: ep.airDate || null,
              image: ep.stillPath ? `https://image.tmdb.org/t/p/w500${ep.stillPath}` : null,
            };
            episodes.push(epObj);
          }
        }

        const posterUrl = sgShow.poster_path ? `https://image.tmdb.org/t/p/w500${sgShow.poster_path}` : null;
        const backdropUrl = sgShow.backdrop_path ? `https://image.tmdb.org/t/p/original${sgShow.backdrop_path}` : null;

        return {
          source: 'seriesgraph',
          title: sgShow.name || '',
          type: 'tv',
          year: sgShow.first_air_date ? Number(sgShow.first_air_date.slice(0, 4)) : null,
          score: sgShow.vote_average ? Number(sgShow.vote_average) : 8.0,
          poster: posterUrl,
          backdrop: backdropUrl,
          overview: sgShow.overview || '',
          genres: '',
          seasons_count: seasons.length,
          episodes_count: episodes.length,
          seasons,
          episodes,
        };
      }
    } catch (e) {
      console.warn('SeriesGraph direct fetch error, falling back:', e.message);
    }
  }

  // 2. Detectar IMDb ID (tt...) o link completo de IMDb
  const imdbMatch = trimmed.match(/tt\d{7,8}/i);
  let resolvedTitleName = '';

  if (imdbMatch) {
    const imdbId = imdbMatch[0];
    try {
      // Intentar primero resolver el show name en TVmaze para luego buscar en SeriesGraph
      const tvRes = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${imdbId}`);
      if (tvRes.ok) {
        const s = await tvRes.json();
        resolvedTitleName = s.name;
        const fullRes = await fetch(`https://api.tvmaze.com/shows/${s.id}?embed[]=seasons&embed[]=episodes`);
        if (fullRes.ok) showData = await fullRes.json();
      }
    } catch {}

    // Intentar buscar en SeriesGraph por el nombre resuelto para tener las calificaciones exactas de IMDb
    if (resolvedTitleName) {
      try {
        const sgSearch = await fetch(`https://seriesgraph.com/api/shows/search?searchTerm=${encodeURIComponent(resolvedTitleName)}`);
        if (sgSearch.ok) {
          const sgData = await sgSearch.json();
          const match = (sgData.results || []).find(x => x.name.toLowerCase() === resolvedTitleName.toLowerCase()) || sgData.results?.[0];
          if (match && match.id) {
            const [sgSeasonsRes, sgRatingsRes] = await Promise.all([
              fetch(`https://seriesgraph.com/api/shows/${match.id}/seasons`),
              fetch(`https://seriesgraph.com/api/community-ratings/${match.id}`)
            ]);
            if (sgSeasonsRes.ok) {
              const sgSeasons = await sgSeasonsRes.json();
              const sgRatings = sgRatingsRes.ok ? await sgRatingsRes.json() : { episodeRatings: {} };
              const epRatingsMap = sgRatings.episodeRatings || {};

              const seasons = [];
              const episodes = [];

              for (const s of sgSeasons) {
                const sNum = Number(s.seasonNumber || 1);
                if (sNum === 0 && (!s.episodes || s.episodes.length === 0)) continue;
                const sEpisodes = s.episodes || [];
                seasons.push({
                  numero: sNum,
                  nombre: s.name || `Temporada ${sNum}`,
                  episodes_count: sEpisodes.length,
                  first_air: s.airDate || null,
                });

                for (const ep of sEpisodes) {
                  const epNum = Number(ep.episodeNumber || 1);
                  const key = `S${sNum}E${epNum}`;
                  const epScore = episodeIMDbScore(ep, epRatingsMap, sNum, epNum);

                  episodes.push({
                    season: sNum,
                    number: epNum,
                    name: ep.name || `Episodio ${epNum}`,
                    score: epScore,
                    synopsis: ep.overview || '',
                    airdate: ep.airDate || null,
                    image: ep.stillPath ? `https://image.tmdb.org/t/p/w500${ep.stillPath}` : null,
                  });
                }
              }

              return {
                source: 'seriesgraph',
                title: match.name || resolvedTitleName,
                type: 'tv',
                year: match.first_air_date ? Number(match.first_air_date.slice(0, 4)) : null,
                score: match.vote_average ? Number(match.vote_average) : 8.0,
                poster: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : (showData?.image?.original || null),
                backdrop: match.backdrop_path ? `https://image.tmdb.org/t/p/original${match.backdrop_path}` : null,
                overview: match.overview || (showData?.summary ? showData.summary.replace(/<[^>]+>/g, '').trim() : ''),
                genres: (showData?.genres || []).join(', '),
                seasons_count: seasons.length,
                episodes_count: episodes.length,
                seasons,
                episodes,
              };
            }
          }
        }
      } catch {}
    }
  }

  // 3. Detectar TVmaze URL (tvmaze.com/shows/:id)
  const tvmazeShowMatch = trimmed.match(/tvmaze\.com\/shows\/(\d+)/i);
  if (!showData && tvmazeShowMatch) {
    try {
      const fullRes = await fetch(`https://api.tvmaze.com/shows/${tvmazeShowMatch[1]}?embed[]=seasons&embed[]=episodes`);
      if (fullRes.ok) showData = await fullRes.json();
    } catch {}
  }

  // 4. Si es búsqueda de texto o nombre
  let searchQuery = '';
  if (!imdbMatch && !tvmazeShowMatch && !sgMatch) {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const urlObj = new URL(trimmed);
        const parts = urlObj.pathname.split('/').filter(Boolean);
        const lastPart = parts[parts.length - 1] || '';
        searchQuery = decodeURIComponent(lastPart).replace(/^\d+-/, '').replace(/[-_]+/g, ' ').trim();
      } catch {
        searchQuery = trimmed;
      }
    } else {
      searchQuery = trimmed;
    }
  }

  // Si tenemos nombre de serie (por texto o URL limpia), buscar en SeriesGraph para obtener los ratings de IMDb
  if (searchQuery) {
    try {
      const sgSearch = await fetch(`https://seriesgraph.com/api/shows/search?searchTerm=${encodeURIComponent(searchQuery)}`);
      if (sgSearch.ok) {
        const sgData = await sgSearch.json();
        const results = sgData.results || [];
        const match = results.find(x => x.name.toLowerCase() === searchQuery.toLowerCase()) || results[0];
        if (match && match.id) {
          const [sgSeasonsRes, sgRatingsRes] = await Promise.all([
            fetch(`https://seriesgraph.com/api/shows/${match.id}/seasons`),
            fetch(`https://seriesgraph.com/api/community-ratings/${match.id}`)
          ]);
          if (sgSeasonsRes.ok) {
            const sgSeasons = await sgSeasonsRes.json();
            const sgRatings = sgRatingsRes.ok ? await sgRatingsRes.json() : { episodeRatings: {} };
            const epRatingsMap = sgRatings.episodeRatings || {};

            const seasons = [];
            const episodes = [];

            for (const s of sgSeasons) {
              const sNum = Number(s.seasonNumber || 1);
              if (sNum === 0 && (!s.episodes || s.episodes.length === 0)) continue;
              const sEpisodes = s.episodes || [];
              seasons.push({
                numero: sNum,
                nombre: s.name || `Temporada ${sNum}`,
                episodes_count: sEpisodes.length,
                first_air: s.airDate || null,
              });

              for (const ep of sEpisodes) {
                const epNum = Number(ep.episodeNumber || 1);
                const key = `S${sNum}E${epNum}`;
                const epScore = episodeIMDbScore(ep, epRatingsMap, sNum, epNum);

                episodes.push({
                  season: sNum,
                  number: epNum,
                  name: ep.name || `Episodio ${epNum}`,
                  score: epScore,
                  synopsis: ep.overview || '',
                  airdate: ep.airDate || null,
                  image: ep.stillPath ? `https://image.tmdb.org/t/p/w500${ep.stillPath}` : null,
                });
              }
            }

            return {
              source: 'seriesgraph',
              title: match.name || searchQuery,
              type: 'tv',
              year: match.first_air_date ? Number(match.first_air_date.slice(0, 4)) : null,
              score: match.vote_average ? Number(match.vote_average) : 8.0,
              poster: match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : null,
              backdrop: match.backdrop_path ? `https://image.tmdb.org/t/p/original${match.backdrop_path}` : null,
              overview: match.overview || '',
              genres: '',
              seasons_count: seasons.length,
              episodes_count: episodes.length,
              seasons,
              episodes,
            };
          }
        }
      }
    } catch (e) {
      console.warn('SeriesGraph search fallback error:', e.message);
    }
  }

  // 5. Fallback a TVmaze si no se obtuvo por SeriesGraph
  if (!showData && searchQuery) {
    try {
      const singleRes = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(searchQuery)}&embed[]=seasons&embed[]=episodes`);
      if (singleRes.ok) {
        showData = await singleRes.json();
      }
    } catch {}
  }

  // Si encontramos serie en TVmaze:
  if (showData) {
    const episodesRaw = showData._embedded?.episodes || [];
    const seasonsMap = new Map();
    const episodes = [];

    episodesRaw.forEach(ep => {
      const sNum = Number(ep.season || 1);
      if (!seasonsMap.has(sNum)) seasonsMap.set(sNum, []);
      const epObj = {
        season: sNum,
        number: Number(ep.number || 1),
        name: ep.name || `Episodio ${ep.number}`,
        score: ep.rating?.average ? Number(ep.rating.average) : (showData.rating?.average ? Number(showData.rating.average) : 8.0),
        synopsis: ep.summary ? ep.summary.replace(/<[^>]+>/g, '').trim() : '',
        airdate: ep.airdate || null,
        image: ep.image?.medium || ep.image?.original || null,
      };
      seasonsMap.get(sNum).push(epObj);
      episodes.push(epObj);
    });

    const seasons = [];
    for (const [sNum, eps] of seasonsMap.entries()) {
      seasons.push({
        numero: sNum,
        nombre: `Temporada ${sNum}`,
        episodes_count: eps.length,
        first_air: eps[0]?.airdate || null,
      });
    }

    return {
      source: 'tvmaze',
      title: showData.name || '',
      type: 'tv',
      year: showData.premiered ? Number(showData.premiered.slice(0, 4)) : null,
      score: showData.rating?.average ? Number(showData.rating.average) : 8.0,
      poster: showData.image?.original || showData.image?.medium || null,
      overview: showData.summary ? showData.summary.replace(/<[^>]+>/g, '').trim() : '',
      genres: (showData.genres || []).join(', '),
      seasons_count: seasons.length,
      episodes_count: episodes.length,
      seasons,
      episodes,
    };
  }

  // 5. Si no se encontró serie, verificar si es película vía Wikipedia
  const titleToSearch = searchQuery || trimmed;
  let movieInfo = null;
  for (const query of [`${titleToSearch}_(película)`, `${titleToSearch}_(film)`, titleToSearch]) {
    try {
      const wRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
      if (wRes.ok) {
        const d = await wRes.json();
        if (d.extract && !d.extract.includes('puede referirse a:')) {
          movieInfo = {
            source: 'wikipedia',
            title: d.title?.replace(/ \(película\)| \(film\)/i, '') || titleToSearch,
            type: 'movie',
            overview: d.extract,
            poster: d.thumbnail?.source || null,
            year: Number((d.extract.match(/\b(19\d\d|20\d\d)\b/) || [])[1]) || new Date().getFullYear(),
            score: 7.8,
            seasons_count: 0,
            episodes_count: 0,
            seasons: [],
            episodes: [],
          };
          break;
        }
      }
    } catch {}
  }

  if (movieInfo) return movieInfo;

  throw new Error(`No encontramos datos reales para "${trimmed}". Podés cargarlo manualmente.`);
}

// endpoint para extraer datos reales desde cualquier link (SeriesGraph, IMDb, TVmaze) o nombre
app.post('/api/import/parse-url', protectedRoute, requireRole(['Administrador', 'admin']), async (req, res) => {
  try {
    const url = req.body.url;
    if (!url) return res.status(400).json({ error: 'URL_O_TITULO_REQUERIDO' });
    const parsed = await parseShowOrMovieFromUrlOrQuery(url);
    res.json(parsed);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// busqueda de series/peliculas en TVmaze y TMDB
app.get('/api/import/search', protectedRoute, requireRole(['Administrador', 'admin']), async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) return res.json([]);

  const results = [];

  // buscar en TVmaze (no requiere API key)
  try {
    const tvRes = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
    if (tvRes.ok) {
      const data = await tvRes.json();
      for (const item of data.slice(0, 12)) {
        const show = item.show;
        results.push({
          source: 'tvmaze',
          source_id: show.id,
          title: show.name,
          type: 'tv',
          year: show.premiered ? Number(show.premiered.slice(0, 4)) : null,
          score: show.rating?.average || null,
          image: show.image?.medium || show.image?.original || null,
          overview: show.summary ? show.summary.replace(/<[^>]+>/g, '').trim().slice(0, 200) : '',
          genres: (show.genres || []).join(', '),
          status: show.status || '',
        });
      }
    }
  } catch (e) {
    console.warn('TVmaze search error:', e.message);
  }

  // buscar también en TMDB si hay API key
  if (process.env.TMDB_API_KEY) {
    try {
      const tmdbRes = await fetch(`${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&api_key=${process.env.TMDB_API_KEY}&language=es-AR`);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        for (const item of (tmdbData.results || []).slice(0, 8)) {
          if (item.media_type !== 'tv' && item.media_type !== 'movie') continue;
          results.push({
            source: 'tmdb',
            source_id: item.id,
            title: item.title || item.name || '',
            type: item.media_type === 'tv' ? 'tv' : 'movie',
            year: Number((item.release_date || item.first_air_date || '').slice(0, 4)) || null,
            score: item.vote_average || null,
            image: item.poster_path ? TMDB_IMG + item.poster_path : null,
            overview: (item.overview || '').slice(0, 200),
            genres: '',
            status: '',
          });
        }
      }
    } catch {}
  }

  res.json(results);
});

// importar serie o pelicula con datos reales completos (guardado definitivo)
app.post('/api/import/save', protectedRoute, requireRole(['Administrador', 'admin']), async (req, res) => {
  try {
    const { title, type, year, vote_average, poster, backdrop, overview, episodes_data, overwrite } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'TITULO_REQUERIDO' });

    const cleanTitle = title.trim();
    const tipo = type === 'tv' || type === 'serie' ? 'serie' : 'pelicula';
    const finalYear = Number(year) || new Date().getFullYear();
    const finalScore = Number(vote_average) || 8.0;
    const posterUrl = poster?.trim() || null;
    const backdropUrl = backdrop?.trim() || null;
    const finalOverview = overview?.trim() || '';

    // Verificar si ya existe en catálogo
    const existing = await qOne('SELECT id FROM titulos WHERE LOWER(nombre) = ? AND tipo = ?', [cleanTitle.toLowerCase(), tipo]);
    if (existing && !overwrite) {
      return res.status(409).json({ error: 'TITULO_YA_EXISTE', existingId: existing.id, title: cleanTitle });
    }

    let targetTitleId = existing?.id;

    if (existing && overwrite) {
      // Actualizar titulo existente
      await q(
        'UPDATE titulos SET nombre = ?, sinopsis = ?, anio = ?, poster = ?, fondo = ?, nota_tmdb = ?, ultima_sincronizacion = NOW() WHERE id = ?',
        [cleanTitle, finalOverview, finalYear, posterUrl, backdropUrl, finalScore, targetTitleId]
      );
      // Eliminar capítulos y temporadas viejas para cargar los datos reales limpios
      const [existingSeasons] = await pool.execute('SELECT id FROM temporadas WHERE titulo_id = ?', [targetTitleId]);
      for (const s of existingSeasons) {
        await q('DELETE FROM capitulos WHERE temporada_id = ?', [s.id]);
      }
      await q('DELETE FROM temporadas WHERE titulo_id = ?', [targetTitleId]);
    } else {
      // Insertar nuevo titulo
      const fakeTmdbId = 900000 + Math.floor(Math.random() * 99999);
      const [ins] = await q(
        "INSERT INTO titulos (tmdb_id, tipo, nombre, sinopsis, anio, poster, fondo, nota_tmdb, estado, ultima_sincronizacion) VALUES (?,?,?,?,?,?,?,?,'visible',NOW())",
        [fakeTmdbId, tipo, cleanTitle, finalOverview, finalYear, posterUrl, backdropUrl, finalScore]
      );
      targetTitleId = ins.insertId;
    }

    // Si es serie, guardar todas las temporadas y capitulos reales
    let totalEps = 0;
    let seasonsCount = 0;

    if (tipo === 'serie' && Array.isArray(episodes_data) && episodes_data.length > 0) {
      const seasonsMap = new Map();
      episodes_data.forEach(ep => {
        const sNum = Number(ep.season || ep.temporada || 1);
        if (!seasonsMap.has(sNum)) seasonsMap.set(sNum, []);
        seasonsMap.get(sNum).push(ep);
      });

      seasonsCount = seasonsMap.size;
      for (const [sNum, eps] of seasonsMap.entries()) {
        const firstAir = eps.find(e => e.airdate)?.airdate || `${finalYear}-01-01`;
        const [insSeason] = await q(
          'INSERT INTO temporadas (titulo_id, numero, nombre, fecha_emision) VALUES (?,?,?,?)',
          [targetTitleId, sNum, `Temporada ${sNum}`, firstAir]
        );
        const sId = insSeason.insertId;

        for (const ep of eps) {
          const epScore = ep.score !== undefined ? Number(ep.score) : (ep.rating?.average ? Number(ep.rating.average) : finalScore);
          const epSynopsis = ep.synopsis || (ep.summary ? ep.summary.replace(/<[^>]+>/g, '').trim() : '');
          await q(
            'INSERT INTO capitulos (temporada_id, numero, nombre, sinopsis, fecha_emision, nota_tmdb) VALUES (?,?,?,?,?,?)',
            [sId, ep.number || 1, ep.name || `Episodio ${ep.number}`, epSynopsis, ep.airdate || null, epScore]
          );
          totalEps++;
        }
      }
    }

    const row = await qOne('SELECT * FROM titulos WHERE id = ?', [targetTitleId]);
    res.status(201).json({
      title: row,
      stats: { seasons: seasonsCount, episodes: totalEps },
    });
  } catch (err) {
    console.error('Error al guardar importacion:', err);
    res.status(500).json({ error: 'ERROR_AL_GUARDAR', detail: err.message });
  }
});

// importar serie desde TVmaze por showId directo
app.post('/api/import/tvmaze/:showId', protectedRoute, requireRole(['Administrador', 'admin']), async (req, res) => {
  try {
    const showId = req.params.showId;
    const overwrite = req.body?.overwrite === true;
    const showRes = await fetch(`https://api.tvmaze.com/shows/${showId}?embed[]=seasons&embed[]=episodes`);
    if (!showRes.ok) return res.status(404).json({ error: 'SERIE_NO_ENCONTRADA_EN_TVMAZE' });
    const show = await showRes.json();

    const titulo = show.name || '';
    const anio = show.premiered ? Number(show.premiered.slice(0, 4)) : new Date().getFullYear();
    const score = show.rating?.average || 8.0;
    const posterUrl = show.image?.original || show.image?.medium || null;
    const overview = show.summary ? show.summary.replace(/<[^>]+>/g, '').trim() : '';

    const existing = await qOne('SELECT id FROM titulos WHERE LOWER(nombre) = ? AND tipo = ?', [titulo.toLowerCase(), 'serie']);
    if (existing && !overwrite) {
      return res.status(409).json({ error: 'TITULO_YA_EXISTE', existingId: existing.id, title: titulo });
    }

    let targetTitleId = existing?.id;
    if (existing && overwrite) {
      await q('UPDATE titulos SET nombre=?, sinopsis=?, anio=?, poster=?, nota_tmdb=?, ultima_sincronizacion=NOW() WHERE id=?',
        [titulo, overview, anio, posterUrl, score, targetTitleId]);
      const [existingSeasons] = await pool.execute('SELECT id FROM temporadas WHERE titulo_id = ?', [targetTitleId]);
      for (const s of existingSeasons) {
        await q('DELETE FROM capitulos WHERE temporada_id = ?', [s.id]);
      }
      await q('DELETE FROM temporadas WHERE titulo_id = ?', [targetTitleId]);
    } else {
      const fakeTmdbId = 900000 + Math.floor(Math.random() * 99999);
      const [insert] = await q(
        "INSERT INTO titulos (tmdb_id,tipo,nombre,sinopsis,anio,poster,fondo,nota_tmdb,estado,ultima_sincronizacion) VALUES (?,?,?,?,?,?,?,?,'visible',NOW())",
        [fakeTmdbId, 'serie', titulo, overview, anio, posterUrl, null, score]
      );
      targetTitleId = insert.insertId;
    }

    const episodes = show._embedded?.episodes || [];
    const seasonsMap = new Map();
    episodes.forEach(ep => {
      const sNum = Number(ep.season || 1);
      if (!seasonsMap.has(sNum)) seasonsMap.set(sNum, []);
      seasonsMap.get(sNum).push(ep);
    });

    let totalEps = 0;
    for (const [sNum, eps] of seasonsMap.entries()) {
      const firstAir = eps.find(e => e.airdate)?.airdate || `${anio}-01-01`;
      const [insSeason] = await q(
        'INSERT INTO temporadas (titulo_id, numero, nombre, fecha_emision) VALUES (?,?,?,?)',
        [targetTitleId, sNum, `Temporada ${sNum}`, firstAir]
      );
      const sId = insSeason.insertId;

      for (const ep of eps) {
        const epScore = ep.rating?.average ? Number(ep.rating.average) : score;
        const epSynopsis = ep.summary ? ep.summary.replace(/<[^>]+>/g, '').trim() : '';
        await q(
          'INSERT INTO capitulos (temporada_id, numero, nombre, sinopsis, fecha_emision, nota_tmdb) VALUES (?,?,?,?,?,?)',
          [sId, ep.number || 1, ep.name || `Episodio ${ep.number}`, epSynopsis, ep.airdate || null, epScore]
        );
        totalEps++;
      }
    }

    const row = await qOne('SELECT * FROM titulos WHERE id = ?', [targetTitleId]);
    res.status(201).json({
      title: row,
      stats: { seasons: seasonsMap.size, episodes: totalEps },
    });
  } catch (e) {
    console.error('TVmaze import error:', e);
    res.status(503).json({ error: 'TVMAZE_ERROR', detail: e.message });
  }
});

// importar una pelicula o serie desde TMDB por ID con datos reales
app.post('/api/import/tmdb/:tmdbId', protectedRoute, requireRole(['Administrador', 'admin']), async (req, res) => {
  try {
    if (!process.env.TMDB_API_KEY) return res.status(503).json({ error: 'TMDB_NO_CONFIGURADA' });
    const tmdbId = Number(req.params.tmdbId);
    const type = req.body.type === 'tv' ? 'tv' : 'movie';

    const response = await fetch(`${TMDB_BASE}/${type}/${tmdbId}?api_key=${process.env.TMDB_API_KEY}&language=es-AR`);
    if (!response.ok) return res.status(404).json({ error: 'TITULO_NO_ENCONTRADO_EN_TMDB' });
    const data = await response.json();

    const titulo = data.title || data.name || '';
    const anio = Number((data.release_date || data.first_air_date || '').slice(0, 4)) || null;

    const existing = await qOne('SELECT id FROM titulos WHERE tmdb_id = ?', [tmdbId]);
    if (existing) {
      return res.status(409).json({ error: 'TITULO_YA_EXISTE', existingId: existing.id, title: titulo });
    }

    const [insert] = await q(
      "INSERT INTO titulos (tmdb_id,tipo,nombre,sinopsis,anio,poster,fondo,nota_tmdb,estado,ultima_sincronizacion) VALUES (?,?,?,?,?,?,?,?,'visible',NOW())",
      [tmdbId, type === 'tv' ? 'serie' : 'pelicula', titulo, data.overview || '', anio,
       data.poster_path || null, data.backdrop_path || null, data.vote_average || 0]
    );
    const newId = insert.insertId;

    let totalEps = 0;
    if (type === 'tv' && data.seasons) {
      for (const season of data.seasons) {
        if (!season.season_number) continue;
        const [insSeason] = await q('INSERT INTO temporadas (titulo_id,numero,nombre,fecha_emision) VALUES (?,?,?,?)',
          [newId, season.season_number, season.name || `Temporada ${season.season_number}`, season.air_date || null]);
        const seasonId = insSeason.insertId;
        try {
          const sRes = await fetch(`${TMDB_BASE}/tv/${tmdbId}/season/${season.season_number}?api_key=${process.env.TMDB_API_KEY}&language=es-AR`);
          if (sRes.ok) {
            const seasonData = await sRes.json();
            for (const ep of seasonData.episodes || []) {
              await q('INSERT INTO capitulos (temporada_id,numero,nombre,sinopsis,fecha_emision,nota_tmdb) VALUES (?,?,?,?,?,?)',
                [seasonId, ep.episode_number, ep.name || `Episodio ${ep.episode_number}`, ep.overview || '', ep.air_date || null, ep.vote_average || 0]);
              totalEps++;
            }
          }
        } catch {}
      }
    }

    const row = await qOne('SELECT * FROM titulos WHERE id = ?', [newId]);
    res.status(201).json({
      title: row,
      stats: { seasons: data.seasons?.length || 0, episodes: totalEps },
    });
  } catch (e) {
    res.status(503).json({ error: 'TMDB_ERROR', detail: e.message });
  }
});

// alta manual de titulo por administrador con enriquecimiento automatico de datos verdaderos
app.post('/api/catalog', protectedRoute, requireRole(['Administrador', 'admin']), async (req, res) => {
  const { title, type, overview, year, poster, backdrop, vote_average, seasons_count, episodes_per_season, episodes_data } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'TITULO_REQUERIDO' });
  const tipo = type === 'tv' || type === 'serie' ? 'serie' : 'pelicula';
  const cleanTitle = title.trim();

  let finalYear = Number(year) || null;
  let finalScore = Number(vote_average) || 8.0;
  let posterUrl = poster?.trim() || null;
  let backdropUrl = backdrop?.trim() || null;
  let finalOverview = overview?.trim() || '';
  let realEpisodesFound = null;

  // Si no se proporcionaron datos completos o es serie, consultamos datos verdaderos en TVmaze
  if (tipo === 'serie') {
    try {
      const tvRes = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanTitle)}&embed[]=seasons&embed[]=episodes`);
      if (tvRes.ok) {
        const tvShow = await tvRes.json();
        if (tvShow.premiered && !finalYear) finalYear = Number(tvShow.premiered.slice(0, 4));
        if (tvShow.rating?.average && (!vote_average || vote_average == 8.0)) {
          finalScore = Number(tvShow.rating.average);
        }
        if (!posterUrl && tvShow.image?.original) {
          posterUrl = tvShow.image.original;
        }
        if (!finalOverview && tvShow.summary) {
          finalOverview = tvShow.summary.replace(/<[^>]+>/g, '').trim();
        }
        if (Array.isArray(tvShow._embedded?.episodes) && tvShow._embedded.episodes.length > 0) {
          realEpisodesFound = tvShow._embedded.episodes;
        }
      }
    } catch (e) {
      console.warn('TVmaze query failed, falling back:', e.message);
    }
  } else {
    // Si es película y no tiene sinopsis o poster, intentamos Wikipedia Summary API
    if (!finalOverview || !posterUrl) {
      try {
        const wikiRes = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle)}`);
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          if (!finalOverview && wikiData.extract) finalOverview = wikiData.extract;
          if (!posterUrl && wikiData.thumbnail?.source) posterUrl = wikiData.thumbnail.source;
        }
      } catch {}
    }
  }

  if (!finalYear) finalYear = new Date().getFullYear();
  finalScore = Math.min(10, Math.max(1, finalScore));

  const fakeTmdbId = 900000 + Math.floor(Math.random() * 99999);
  const [insert] = await q(
    "INSERT INTO titulos (tmdb_id,tipo,nombre,sinopsis,anio,poster,fondo,nota_tmdb,estado,ultima_sincronizacion) VALUES (?,?,?,?,?,?,?,?,'visible',NOW())",
    [fakeTmdbId, tipo, cleanTitle, finalOverview, finalYear, posterUrl, backdropUrl, finalScore]
  );
  const newId = insert.insertId;

  // Si es serie, creamos temporadas y capítulos con datos verdaderos
  if (tipo === 'serie') {
    if (Array.isArray(episodes_data) && episodes_data.length > 0) {
      // Si el cliente envió capítulos explícitos
      const seasonsMap = new Map();
      episodes_data.forEach(ep => {
        const sNum = Number(ep.season || ep.temporada || 1);
        if (!seasonsMap.has(sNum)) seasonsMap.set(sNum, []);
        seasonsMap.get(sNum).push(ep);
      });
      for (const [sNum, eps] of seasonsMap.entries()) {
        const [insSeason] = await q(
          'INSERT INTO temporadas (titulo_id, numero, nombre, fecha_emision) VALUES (?,?,?,?)',
          [newId, sNum, `Temporada ${sNum}`, `${finalYear}-01-01`]
        );
        const sId = insSeason.insertId;
        for (const ep of eps) {
          await q(
            'INSERT INTO capitulos (temporada_id, numero, nombre, sinopsis, fecha_emision, nota_tmdb) VALUES (?,?,?,?,?,?)',
            [sId, ep.number || ep.numero || 1, ep.name || ep.nombre || `Episodio ${ep.number}`, ep.synopsis || ep.sinopsis || '', ep.airdate || null, Number(ep.score || ep.nota_tmdb || finalScore)]
          );
        }
      }
    } else if (realEpisodesFound && realEpisodesFound.length > 0) {
      // Guardar todos los episodios y temporadas verdaderos provenientes de TVmaze
      const seasonsMap = new Map();
      realEpisodesFound.forEach(ep => {
        const sNum = Number(ep.season || 1);
        if (!seasonsMap.has(sNum)) seasonsMap.set(sNum, []);
        seasonsMap.get(sNum).push(ep);
      });

      for (const [sNum, eps] of seasonsMap.entries()) {
        const firstAir = eps.find(e => e.airdate)?.airdate || `${finalYear}-01-01`;
        const [insSeason] = await q(
          'INSERT INTO temporadas (titulo_id, numero, nombre, fecha_emision) VALUES (?,?,?,?)',
          [newId, sNum, `Temporada ${sNum}`, firstAir]
        );
        const sId = insSeason.insertId;

        for (const ep of eps) {
          const epScore = ep.rating?.average ? Number(ep.rating.average) : finalScore;
          const epSynopsis = ep.summary ? ep.summary.replace(/<[^>]+>/g, '').trim() : '';
          await q(
            'INSERT INTO capitulos (temporada_id, numero, nombre, sinopsis, fecha_emision, nota_tmdb) VALUES (?,?,?,?,?,?)',
            [sId, ep.number || 1, ep.name || `Episodio ${ep.number}`, epSynopsis, ep.airdate || null, epScore]
          );
        }
      }
    } else {
      // Fallback con la estructura configurada por temporadas
      let seasonsArray = [];
      if (Array.isArray(episodes_per_season)) {
        seasonsArray = episodes_per_season.map((epCount, idx) => ({
          season_number: idx + 1,
          episodes_count: Math.max(1, Math.min(50, Number(epCount) || 1))
        }));
      } else {
        const numSeasons = Math.max(1, Math.min(25, Number(seasons_count) || 1));
        const numEpisodes = Math.max(1, Math.min(50, Number(episodes_per_season) || 8));
        for (let s = 1; s <= numSeasons; s++) {
          seasonsArray.push({ season_number: s, episodes_count: numEpisodes });
        }
      }

      for (const item of seasonsArray) {
        const s = item.season_number;
        const numEpisodes = item.episodes_count;
        const [insSeason] = await q(
          'INSERT INTO temporadas (titulo_id, numero, nombre, fecha_emision) VALUES (?,?,?,?)',
          [newId, s, `Temporada ${s}`, `${finalYear}-01-01`]
        );
        const sId = insSeason.insertId;
        for (let e = 1; e <= numEpisodes; e++) {
          const variance = ((Math.random() * 0.8) - 0.4);
          const epScore = Math.min(10, Math.max(5.0, Number((finalScore + variance).toFixed(1))));
          await q(
            'INSERT INTO capitulos (temporada_id, numero, nombre, sinopsis, fecha_emision, nota_tmdb) VALUES (?,?,?,?,?,?)',
            [sId, e, `Episodio ${e}`, `Capítulo ${e} de la temporada ${s} de ${cleanTitle}`, `${finalYear}-01-01`, epScore]
          );
        }
      }
    }
  }

  const row = await qOne('SELECT * FROM titulos WHERE id = ?', [newId]);
  res.status(201).json(row);
});


// ficha completa individual con temporadas, capitulos, calificaciones y resenas
app.get('/api/catalog/:id', async (req, res) => {
  const title = await qOne('SELECT * FROM titulos WHERE id = ?', [req.params.id]);
  if (!title) return res.status(404).json({ error: 'NO_ENCONTRADO' });

  // si es serie y no tiene temporadas, intentamos sincronizar bajo demanda si tmdb key existe
  if (title.tipo === 'serie' && process.env.TMDB_API_KEY && title.tmdb_id) {
    const [existingSeasons] = await pool.execute('SELECT id FROM temporadas WHERE titulo_id = ? LIMIT 1', [title.id]);
    if (!existingSeasons.length) {
      try {
        const sRes = await fetch(`${TMDB_BASE}/tv/${title.tmdb_id}?api_key=${process.env.TMDB_API_KEY}&language=es-AR`);
        if (sRes.ok) {
          const sData = await sRes.json();
          for (const s of sData.seasons || []) {
            if (!s.season_number) continue;
            const [insS] = await q('INSERT INTO temporadas (titulo_id,numero,nombre,fecha_emision) VALUES (?,?,?,?)',
              [title.id, s.season_number, s.name || `Temporada ${s.season_number}`, s.air_date || null]);
            const epRes = await fetch(`${TMDB_BASE}/tv/${title.tmdb_id}/season/${s.season_number}?api_key=${process.env.TMDB_API_KEY}&language=es-AR`);
            if (epRes.ok) {
              const epData = await epRes.json();
              for (const ep of epData.episodes || []) {
                await q('INSERT INTO capitulos (temporada_id,numero,nombre,sinopsis,fecha_emision,nota_tmdb) VALUES (?,?,?,?,?,?)',
                  [insS.insertId, ep.episode_number, ep.name || `Capítulo ${ep.episode_number}`, ep.overview || '', ep.air_date || null, ep.vote_average || 0]);
              }
            }
          }
        }
      } catch {}
    }
  }

  const [seasons] = await pool.execute('SELECT * FROM temporadas WHERE titulo_id = ? ORDER BY numero ASC', [title.id]);
  const [episodes] = await pool.execute(
    'SELECT c.*, s.numero as temporada_numero, s.titulo_id FROM capitulos c JOIN temporadas s ON s.id = c.temporada_id WHERE s.titulo_id = ? ORDER BY s.numero ASC, c.numero ASC',
    [title.id]
  );
  const [reviews] = await pool.execute(
    "SELECT r.*, u.nombre as autor, u.avatar FROM resenas r JOIN usuarios u ON r.usuario_id = u.id WHERE r.titulo_id = ? AND r.estado != 'eliminada' ORDER BY r.id DESC",
    [title.id]
  );
  for (const r of reviews) {
    const [comments] = await pool.execute(
      "SELECT c.*, u.nombre as autor, u.avatar FROM comentarios c JOIN usuarios u ON c.usuario_id = u.id WHERE c.resena_id = ? AND c.estado != 'eliminado' ORDER BY c.id ASC",
      [r.id]
    );
    r.comments = comments;
  }
  const [ratings] = await pool.execute('SELECT * FROM calificaciones WHERE titulo_id = ?', [title.id]);
  for (const episode of episodes) {
    const episodeRating = ratings.find(r => Number(r.capitulo_id) === Number(episode.id));
    episode.user_score = episodeRating ? Number(episodeRating.puntaje) : null;
  }

  res.json({
    id: title.id,
    tmdb_id: title.tmdb_id,
    title: title.nombre,
    type: title.tipo === 'serie' ? 'tv' : 'movie',
    overview: title.sinopsis,
    vote_average: Number(title.nota_tmdb || 0),
    year: title.anio,
    image: title.poster ? (title.poster.startsWith('http') ? title.poster : TMDB_IMG + title.poster) : null,
    backdrop: title.fondo ? (title.fondo.startsWith('http') ? title.fondo : TMDB_IMG + title.fondo) : null,
    hidden: title.estado === 'oculto',
    estado: title.estado,
    seasons,
    episodes,
    reviews,
    ratings,
  });
});

// edicion de titulo por administrador
app.patch('/api/catalog/:id', protectedRoute, requireRole(['Administrador']), async (req, res) => {
  const { title, overview, hidden, estado, year, vote_average, poster } = req.body;
  const fields = [];
  const vals = [];
  if (title !== undefined) { fields.push('nombre = ?'); vals.push(title); }
  if (overview !== undefined) { fields.push('sinopsis = ?'); vals.push(overview); }
  if (year !== undefined) { fields.push('anio = ?'); vals.push(Number(year) || null); }
  if (vote_average !== undefined) { fields.push('nota_tmdb = ?'); vals.push(Number(vote_average) || 0); }
  if (poster !== undefined) { fields.push('poster = ?'); vals.push(poster?.trim() || null); }
  if (hidden !== undefined) { fields.push('estado = ?'); vals.push(hidden ? 'oculto' : 'visible'); }
  if (estado !== undefined) { fields.push('estado = ?'); vals.push(estado); }
  if (!fields.length) return res.status(400).json({ error: 'SIN_CAMBIOS' });
  vals.push(req.params.id);
  await q(`UPDATE titulos SET ${fields.join(', ')} WHERE id = ?`, vals);
  const updated = await qOne('SELECT * FROM titulos WHERE id = ?', [req.params.id]);
  res.json(updated);
});

// agregar temporada a una serie (admin)
app.post('/api/catalog/:id/seasons', protectedRoute, requireRole(['Administrador']), async (req, res) => {
  const titleId = req.params.id;
  const title = await qOne('SELECT * FROM titulos WHERE id = ?', [titleId]);
  if (!title) return res.status(404).json({ error: 'TITULO_NO_ENCONTRADO' });

  const maxSeason = await qOne('SELECT MAX(numero) as maxNum FROM temporadas WHERE titulo_id = ?', [titleId]);
  const nextNum = (maxSeason?.maxNum || 0) + 1;
  const numEpisodes = Math.max(1, Math.min(50, Number(req.body.episodes_count) || 8));
  const seasonName = req.body.name || `Temporada ${nextNum}`;
  const defaultScore = Number(req.body.default_score) || Number(title.nota_tmdb) || 8.0;

  const [ins] = await q(
    'INSERT INTO temporadas (titulo_id, numero, nombre, fecha_emision) VALUES (?,?,?,?)',
    [titleId, nextNum, seasonName, `${title.anio || new Date().getFullYear()}-01-01`]
  );
  const seasonId = ins.insertId;

  for (let e = 1; e <= numEpisodes; e++) {
    const variance = ((Math.random() * 0.6) - 0.3);
    const epScore = Math.min(10, Math.max(1.0, Number((defaultScore + variance).toFixed(1))));
    await q(
      'INSERT INTO capitulos (temporada_id, numero, nombre, sinopsis, fecha_emision, nota_tmdb) VALUES (?,?,?,?,?,?)',
      [seasonId, e, `Episodio ${e}`, `Capítulo ${e} de la ${seasonName}`, `${title.anio || new Date().getFullYear()}-01-01`, epScore]
    );
  }

  res.status(201).json({ id: seasonId, numero: nextNum, nombre: seasonName, episodes_count: numEpisodes });
});

// eliminar temporada (admin)
app.delete('/api/catalog/:titleId/seasons/:seasonId', protectedRoute, requireRole(['Administrador']), async (req, res) => {
  await q('DELETE FROM temporadas WHERE id = ? AND titulo_id = ?', [req.params.seasonId, req.params.titleId]);
  res.json({ ok: true });
});

// agregar episodio a una temporada (admin)
app.post('/api/catalog/:titleId/seasons/:seasonId/episodes', protectedRoute, requireRole(['Administrador']), async (req, res) => {
  const { seasonId } = req.params;
  const season = await qOne('SELECT * FROM temporadas WHERE id = ?', [seasonId]);
  if (!season) return res.status(404).json({ error: 'TEMPORADA_NO_ENCONTRADA' });

  const maxEp = await qOne('SELECT MAX(numero) as maxNum FROM capitulos WHERE temporada_id = ?', [seasonId]);
  const nextEpNum = (maxEp?.maxNum || 0) + 1;
  const epName = req.body.name?.trim() || `Episodio ${nextEpNum}`;
  const epSynopsis = req.body.synopsis?.trim() || `Capítulo ${nextEpNum} de la temporada ${season.numero}`;
  const epScore = Math.min(10, Math.max(1.0, Number(req.body.score) || 8.0));

  const [ins] = await q(
    'INSERT INTO capitulos (temporada_id, numero, nombre, sinopsis, fecha_emision, nota_tmdb) VALUES (?,?,?,?,?,?)',
    [seasonId, nextEpNum, epName, epSynopsis, null, epScore]
  );
  res.status(201).json({ id: ins.insertId, numero: nextEpNum, nombre: epName, nota_tmdb: epScore });
});

// editar capitulo individual (admin)
app.patch('/api/episodes/:id', protectedRoute, requireRole(['Administrador']), async (req, res) => {
  const { name, synopsis, score } = req.body;
  const fields = [];
  const vals = [];
  if (name !== undefined) { fields.push('nombre = ?'); vals.push(name.trim()); }
  if (synopsis !== undefined) { fields.push('sinopsis = ?'); vals.push(synopsis.trim()); }
  if (score !== undefined) {
    const s = Math.min(10, Math.max(1.0, Number(score) || 0));
    fields.push('nota_tmdb = ?');
    vals.push(s);
  }
  if (!fields.length) return res.status(400).json({ error: 'SIN_CAMBIOS' });
  vals.push(req.params.id);
  await q(`UPDATE capitulos SET ${fields.join(', ')} WHERE id = ?`, vals);
  const updated = await qOne('SELECT * FROM capitulos WHERE id = ?', [req.params.id]);
  res.json(updated);
});

// eliminar capitulo individual (admin)
app.delete('/api/episodes/:id', protectedRoute, requireRole(['Administrador']), async (req, res) => {
  await q('DELETE FROM capitulos WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// eliminacion de titulo por administrador
app.delete('/api/catalog/:id', protectedRoute, requireRole(['Administrador']), async (req, res) => {
  await q('DELETE FROM titulos WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// calificaciones (maximo 1 vez por titulo/capitulo por usuario)
app.post('/api/ratings', protectedRoute, async (req, res) => {
  return res.status(410).json({ error: 'CALIFICACIONES_DESACTIVADAS' });
});

app.get('/api/ratings/me', protectedRoute, async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT c.*, t.nombre AS title, t.tipo AS title_type, cap.numero AS episode_number, temp.numero AS season_number
    FROM calificaciones c
    JOIN titulos t ON t.id = c.titulo_id
    LEFT JOIN capitulos cap ON cap.id = c.capitulo_id
    LEFT JOIN temporadas temp ON temp.id = cap.temporada_id
    WHERE c.usuario_id = ?
    ORDER BY c.fecha DESC
  `, [req.user.id]);
  res.json(rows);
});

// resenas
app.post('/api/reviews', protectedRoute, async (req, res) => {
  const texto = String(req.body.body || req.body.texto || '').trim();
  if (!texto) return res.status(400).json({ error: 'RESENA_VACIA' });
  const [insert] = await q("INSERT INTO resenas (usuario_id, titulo_id, texto, estado, fecha) VALUES (?,?,?, 'visible', NOW())",
    [req.user.id, req.body.titleId, texto]);
  const review = await qOne('SELECT r.*, u.nombre as autor, u.avatar FROM resenas r JOIN usuarios u ON r.usuario_id = u.id WHERE r.id = ?', [insert.insertId]);
  res.status(201).json({ ...review, comments: [] });
});

app.delete('/api/reviews/:id', protectedRoute, async (req, res) => {
  const review = await qOne('SELECT * FROM resenas WHERE id = ?', [req.params.id]);
  if (!review) return res.status(404).json({ error: 'NO_ENCONTRADO' });
  if (review.usuario_id !== req.user.id && !['Moderador', 'Administrador'].includes(req.user.role)) {
    return res.status(403).json({ error: 'PERMISO_DENEGADO' });
  }
  await q('DELETE FROM resenas WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// comentarios en resenas
app.post('/api/comments', protectedRoute, async (req, res) => {
  const texto = String(req.body.body || req.body.texto || '').trim();
  if (!texto) return res.status(400).json({ error: 'COMENTARIO_VACIO' });
  const [insert] = await q("INSERT INTO comentarios (usuario_id, resena_id, texto, estado, fecha) VALUES (?,?,?, 'visible', NOW())",
    [req.user.id, req.body.reviewId, texto]);
  const row = await qOne('SELECT c.*, u.nombre as autor, u.avatar FROM comentarios c JOIN usuarios u ON c.usuario_id = u.id WHERE c.id = ?', [insert.insertId]);
  res.status(201).json(row);
});

app.delete('/api/comments/:id', protectedRoute, async (req, res) => {
  const comment = await qOne('SELECT * FROM comentarios WHERE id = ?', [req.params.id]);
  if (!comment) return res.status(404).json({ error: 'NO_ENCONTRADO' });
  if (comment.usuario_id !== req.user.id && !['Moderador', 'Administrador'].includes(req.user.role)) {
    return res.status(403).json({ error: 'PERMISO_DENEGADO' });
  }
  await q('DELETE FROM comentarios WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.patch('/api/comments/:id', protectedRoute, async (req, res) => {
  const texto = String(req.body.body || req.body.texto || '').trim();
  if (!texto) return res.status(400).json({ error: 'COMENTARIO_VACIO' });
  const comment = await qOne('SELECT * FROM comentarios WHERE id = ?', [req.params.id]);
  if (!comment) return res.status(404).json({ error: 'NO_ENCONTRADO' });
  if (Number(comment.usuario_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'PERMISO_DENEGADO' });
  }
  await q('UPDATE comentarios SET texto = ? WHERE id = ?', [texto, req.params.id]);
  res.json(await qOne('SELECT c.*, u.nombre as autor, u.avatar FROM comentarios c JOIN usuarios u ON c.usuario_id = u.id WHERE c.id = ?', [req.params.id]));
});

// listas del usuario (quiero_ver, vistas, favoritas, personalizada)
app.get('/api/lists', protectedRoute, async (req, res) => {
  const defaultLists = [
    { tipo: 'quiero_ver', nombre: 'Quiero ver', descripcion: 'Películas y series pendientes' },
    { tipo: 'vistas', nombre: 'Vistas', descripcion: 'Todo lo que ya disfruté' },
    { tipo: 'favoritas', nombre: 'Favoritas', descripcion: 'Mis historias predilectas' },
  ];
  for (const def of defaultLists) {
    const exist = await qOne('SELECT id FROM listas WHERE usuario_id = ? AND tipo = ?', [req.user.id, def.tipo]);
    if (!exist) {
      await q('INSERT INTO listas (usuario_id, nombre, descripcion, tipo) VALUES (?,?,?,?)',
        [req.user.id, def.nombre, def.descripcion, def.tipo]);
    }
  }

  const [lists] = await pool.execute('SELECT * FROM listas WHERE usuario_id = ? ORDER BY id ASC', [req.user.id]);
  for (const list of lists) {
    const [items] = await pool.execute(
      'SELECT li.id as item_id, t.id, t.nombre as title, t.poster as poster_path, t.tipo, t.anio as year, t.nota_tmdb as vote_average FROM lista_items li JOIN titulos t ON li.titulo_id = t.id WHERE li.lista_id = ?',
      [list.id]
    );
    list.items = items.map(it => ({
      ...it,
      image: it.poster_path ? (it.poster_path.startsWith('http') ? it.poster_path : TMDB_IMG + it.poster_path) : null,
    }));
  }
  res.json(lists);
});

app.post('/api/lists', protectedRoute, async (req, res) => {
  const nombre = String(req.body.name || req.body.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'NOMBRE_REQUERIDO' });
  const [insert] = await q('INSERT INTO listas (usuario_id, nombre, descripcion, tipo) VALUES (?,?,?,?)',
    [req.user.id, nombre, req.body.description || req.body.descripcion || '', req.body.type || req.body.tipo || 'personalizada']);
  const row = await qOne('SELECT * FROM listas WHERE id = ?', [insert.insertId]);
  res.status(201).json({ ...row, items: [] });
});

app.patch('/api/lists/:id', protectedRoute, async (req, res) => {
  const list = await qOne('SELECT * FROM listas WHERE id = ? AND usuario_id = ?', [req.params.id, req.user.id]);
  if (!list) return res.status(404).json({ error: 'NO_ENCONTRADO' });
  const nombre = req.body.name || req.body.nombre || list.nombre;
  const descripcion = req.body.description || req.body.descripcion || list.descripcion;
  await q('UPDATE listas SET nombre = ?, descripcion = ? WHERE id = ?', [nombre, descripcion, req.params.id]);
  res.json(await qOne('SELECT * FROM listas WHERE id = ?', [req.params.id]));
});

app.delete('/api/lists/:id', protectedRoute, async (req, res) => {
  const list = await qOne('SELECT * FROM listas WHERE id = ? AND usuario_id = ?', [req.params.id, req.user.id]);
  if (!list) return res.status(404).json({ error: 'NO_ENCONTRADO' });
  await q('DELETE FROM listas WHERE id = ? AND usuario_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

app.post('/api/lists/:id/items', protectedRoute, async (req, res) => {
  const list = await qOne('SELECT * FROM listas WHERE id = ? AND usuario_id = ?', [req.params.id, req.user.id]);
  if (!list) return res.status(404).json({ error: 'NO_ENCONTRADO' });
  const titleId = req.body.titleId;
  const existing = await qOne('SELECT id FROM lista_items WHERE lista_id = ? AND titulo_id = ?', [req.params.id, titleId]);
  if (existing) return res.status(409).json({ error: 'YA_EN_LISTA' });
  const [insert] = await q('INSERT INTO lista_items (lista_id, titulo_id) VALUES (?,?)', [req.params.id, titleId]);
  res.status(201).json({ id: insert.insertId, ok: true });
});

app.delete('/api/lists/:id/items/:titleId', protectedRoute, async (req, res) => {
  const list = await qOne('SELECT * FROM listas WHERE id = ? AND usuario_id = ?', [req.params.id, req.user.id]);
  if (!list) return res.status(404).json({ error: 'NO_ENCONTRADO' });
  await q('DELETE FROM lista_items WHERE lista_id = ? AND titulo_id = ?', [req.params.id, req.params.titleId]);
  res.json({ ok: true });
});

// diario de visualizacion
app.get('/api/diary', protectedRoute, async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT d.id, d.usuario_id, d.titulo_id, d.fecha_visto, t.nombre as title, t.poster as poster_path, t.tipo, t.anio as year, t.nota_tmdb as vote_average, c.puntaje as user_score FROM diario d JOIN titulos t ON d.titulo_id = t.id LEFT JOIN calificaciones c ON c.titulo_id = t.id AND c.usuario_id = d.usuario_id AND c.capitulo_id IS NULL WHERE d.usuario_id = ? ORDER BY d.fecha_visto DESC, d.id DESC',
    [req.user.id]
  );
  res.json(rows.map(r => ({
    ...r,
    image: r.poster_path ? (r.poster_path.startsWith('http') ? r.poster_path : TMDB_IMG + r.poster_path) : null,
  })));
});

app.post('/api/diary', protectedRoute, async (req, res) => {
  const titleId = req.body.titleId;
  const fecha = req.body.watchedAt || req.body.fecha_visto || new Date().toISOString().slice(0, 10);
  const [insert] = await q('INSERT INTO diario (usuario_id, titulo_id, fecha_visto) VALUES (?,?,?)',
    [req.user.id, titleId, fecha]);
  const entry = await qOne(
    'SELECT d.id, d.usuario_id, d.titulo_id, d.fecha_visto, t.nombre as title, t.poster as poster_path, t.tipo FROM diario d JOIN titulos t ON d.titulo_id = t.id WHERE d.id = ?',
    [insert.insertId]
  );
  res.status(201).json({
    ...entry,
    image: entry.poster_path ? (entry.poster_path.startsWith('http') ? entry.poster_path : TMDB_IMG + entry.poster_path) : null,
  });
});

app.delete('/api/diary/:id', protectedRoute, async (req, res) => {
  await q('DELETE FROM diario WHERE id = ? AND usuario_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// reportes de contenido (usuarios comunes y moderadores)
app.post('/api/reports', protectedRoute, async (req, res) => {
  const { targetType, targetId, reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ error: 'MOTIVO_REQUERIDO' });
  let ownerId = null;
  if (targetType === 'resena') {
    const review = await qOne('SELECT usuario_id FROM resenas WHERE id = ?', [targetId]);
    if (!review) return res.status(404).json({ error: 'CONTENIDO_NO_ENCONTRADO' });
    ownerId = review.usuario_id;
  } else if (targetType === 'comentario') {
    const comment = await qOne('SELECT usuario_id FROM comentarios WHERE id = ?', [targetId]);
    if (!comment) return res.status(404).json({ error: 'CONTENIDO_NO_ENCONTRADO' });
    ownerId = comment.usuario_id;
  } else {
    return res.status(400).json({ error: 'TIPO_INVALIDO' });
  }
  if (Number(ownerId) === Number(req.user.id)) {
    return res.status(403).json({ error: 'NO_PUEDES_REPORTAR_TU_CONTENIDO' });
  }
  const duplicate = await qOne(
    "SELECT id FROM reportes WHERE reportante_id = ? AND estado = 'pendiente' AND " +
      (targetType === 'resena' ? 'resena_id = ?' : 'comentario_id = ?'),
    [req.user.id, targetId]
  );
  if (duplicate) return res.status(409).json({ error: 'REPORTE_DUPLICADO' });
  const resenaId = targetType === 'resena' ? targetId : null;
  const comentarioId = targetType === 'comentario' ? targetId : null;
  const [insert] = await q("INSERT INTO reportes (reportante_id, resena_id, comentario_id, motivo, estado) VALUES (?,?,?,?,'pendiente')",
    [req.user.id, resenaId, comentarioId, reason.trim()]);
  res.status(201).json(await qOne('SELECT * FROM reportes WHERE id = ?', [insert.insertId]));
});

// moderacion: listado y resolucion de reportes
app.get('/api/moderation/reports', protectedRoute, requireRole(['Moderador', 'Administrador']), async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT r.*, u.nombre as reportador,
      res.texto as resena_texto, res.usuario_id as resena_autor_id,
      com.texto as comentario_texto, com.usuario_id as comentario_autor_id
    FROM reportes r
    JOIN usuarios u ON r.reportante_id = u.id
    LEFT JOIN resenas res ON r.resena_id = res.id
    LEFT JOIN comentarios com ON r.comentario_id = com.id
    ORDER BY r.id DESC`
  );
  res.json(rows);
});

app.patch('/api/moderation/reports/:id', protectedRoute, requireRole(['Moderador', 'Administrador']), async (req, res) => {
  const report = await qOne('SELECT * FROM reportes WHERE id = ?', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'NO_ENCONTRADO' });
  const status = req.body.status || 'resuelto';
  await q('UPDATE reportes SET estado = ?, resolutor_id = ? WHERE id = ?', [status, req.user.id, req.params.id]);
  if (req.body.action === 'eliminar_contenido') {
    if (report.resena_id) await q("UPDATE resenas SET estado = 'eliminada' WHERE id = ?", [report.resena_id]);
    if (report.comentario_id) await q("UPDATE comentarios SET estado = 'eliminado' WHERE id = ?", [report.comentario_id]);
  }
  res.json(await qOne('SELECT * FROM reportes WHERE id = ?', [req.params.id]));
});

// moderacion: baneos y sanciones
app.get('/api/moderation/bans', protectedRoute, requireRole(['Moderador', 'Administrador']), async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT b.*, u.nombre as usuario_nombre, u.email as usuario_email, m.nombre as moderador_nombre FROM baneos b JOIN usuarios u ON b.usuario_id = u.id LEFT JOIN usuarios m ON b.moderador_id = m.id ORDER BY b.id DESC'
  );
  res.json(rows);
});

app.post('/api/moderation/users/:id/ban', protectedRoute, requireRole(['Moderador', 'Administrador']), async (req, res) => {
  const target = await getUser(req.params.id);
  if (!target) return res.status(404).json({ error: 'USUARIO_NO_ENCONTRADO' });
  const targetRole = roleName(target.role);
  if (targetRole === 'Administrador') return res.status(403).json({ error: 'NO_SE_PUEDE_BANEAR_ADMIN' });
  if (targetRole === 'Moderador' && req.user.role !== 'Administrador') {
    return res.status(403).json({ error: 'MODERADOR_NO_PUEDE_BANEAR_MODERADOR' });
  }

  const durations = { '24h': 24, '7d': 168, '30d': 720, permanente: null };
  if (!(req.body.duration in durations)) return res.status(400).json({ error: 'DURACION_INVALIDA' });
  const hours = durations[req.body.duration];
  const fechaFin = hours ? new Date(Date.now() + hours * 3600000) : null;
  const finStr = fechaFin ? fechaFin.toISOString().slice(0, 19).replace('T', ' ') : null;

  await q("UPDATE baneos SET estado = 'expirado' WHERE usuario_id = ? AND estado = 'activo'", [target.id]);
  const [insert] = await q(
    "INSERT INTO baneos (usuario_id, moderador_id, motivo, inicio, fin, estado) VALUES (?, ?, ?, NOW(), ?, 'activo')",
    [target.id, req.user.id, req.body.reason || 'Incumplimiento de normas', finStr]
  );
  await q("UPDATE usuarios SET estado = 'baneado' WHERE id = ?", [target.id]);
  res.status(201).json(await qOne('SELECT * FROM baneos WHERE id = ?', [insert.insertId]));
});

app.post('/api/moderation/users/:id/unban', protectedRoute, requireRole(['Moderador', 'Administrador']), async (req, res) => {
  const target = await getUser(req.params.id);
  if (!target) return res.status(404).json({ error: 'USUARIO_NO_ENCONTRADO' });
  const targetRole = roleName(target.role);
  if (targetRole === 'Administrador') return res.status(403).json({ error: 'NO_SE_PUEDE_MODIFICAR_ADMIN' });
  if (targetRole === 'Moderador' && req.user.role !== 'Administrador') {
    return res.status(403).json({ error: 'MODERADOR_NO_PUEDE_MODIFICAR_MODERADOR' });
  }
  await q("UPDATE baneos SET estado = 'levantado', levantado_por = ? WHERE usuario_id = ? AND estado = 'activo'",
    [req.user.id, req.params.id]);
  await q("UPDATE usuarios SET estado = 'activo' WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// apelaciones
app.post('/api/apelaciones', auth, async (req, res) => {
  const mensaje = String(req.body.message || req.body.mensaje || '').trim();
  if (!mensaje) return res.status(400).json({ error: 'MENSAJE_REQUERIDO' });
  const activeBan = await qOne("SELECT id FROM baneos WHERE usuario_id = ? AND estado = 'activo' ORDER BY id DESC LIMIT 1", [req.user.id]);
  const [insert] = await q('INSERT INTO apelaciones (usuario_id, baneo_id, mensaje, estado) VALUES (?,?,?, "pendiente")',
    [req.user.id, activeBan?.id || null, mensaje]);
  res.status(201).json(await qOne('SELECT * FROM apelaciones WHERE id = ?', [insert.insertId]));
});

app.get('/api/moderation/appeals', protectedRoute, requireRole(['Moderador', 'Administrador']), async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT a.*, u.nombre as usuario_nombre, u.email as usuario_email, b.motivo as ban_motivo FROM apelaciones a JOIN usuarios u ON a.usuario_id = u.id LEFT JOIN baneos b ON a.baneo_id = b.id ORDER BY a.id DESC'
  );
  res.json(rows);
});

app.patch('/api/moderation/appeals/:id', protectedRoute, requireRole(['Moderador', 'Administrador']), async (req, res) => {
  const status = req.body.status === 'aprobada' || req.body.status === 'aceptada' ? 'aprobada' : 'rechazada';
  const appeal = await qOne('SELECT * FROM apelaciones WHERE id = ?', [req.params.id]);
  if (!appeal) return res.status(404).json({ error: 'NO_ENCONTRADO' });
  await q('UPDATE apelaciones SET estado = ?, resolutor_id = ?, respuesta_moderador = ? WHERE id = ?',
    [status, req.user.id, req.body.response || null, req.params.id]);
  if (status === 'aprobada') {
    await q("UPDATE baneos SET estado = 'levantado', levantado_por = ? WHERE usuario_id = ? AND estado = 'activo'",
      [req.user.id, appeal.usuario_id]);
    await q("UPDATE usuarios SET estado = 'activo' WHERE id = ?", [appeal.usuario_id]);
  }
  res.json(await qOne('SELECT * FROM apelaciones WHERE id = ?', [req.params.id]));
});

// gestion de usuarios por administrador
app.get('/api/users', protectedRoute, requireRole(['Moderador', 'Administrador']), async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT u.id, u.nombre, u.email, r.nombre AS role, u.avatar, u.estado, u.fecha_alta FROM usuarios u JOIN roles r ON r.id = u.rol_id ORDER BY u.fecha_alta DESC'
  );
  res.json(rows.map(u => ({ ...publicUser({ ...u, name: u.nombre, role: roleName(u.role) }), estado: u.estado, creado_en: u.fecha_alta })));
});

app.post('/api/users', protectedRoute, requireRole(['Administrador']), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: 'DATOS_REQUERIDOS' });
  const exists = await qOne('SELECT id FROM usuarios WHERE LOWER(email) = ?', [email.toLowerCase().trim()]);
  if (exists) return res.status(409).json({ error: 'EMAIL_EXISTENTE' });
  const hash = await bcrypt.hash(password, 12);
  const roleMap = { Usuario: 'usuario', Moderador: 'moderador', Administrador: 'admin' };
  const targetRole = roleMap[role] || 'usuario';
  const roleRow = await qOne('SELECT id FROM roles WHERE nombre = ?', [targetRole]);
  const [insert] = await q('INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES (?,?,?,?)',
    [name.trim(), email.toLowerCase().trim(), hash, roleRow.id]);
  const user = await getUser(insert.insertId);
  res.status(201).json(publicUser({ ...user, name: user.nombre, role: roleName(user.role) }));
});

app.patch('/api/users/:id', protectedRoute, requireRole(['Administrador']), async (req, res) => {
  const user = await qOne('SELECT * FROM usuarios WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'NO_ENCONTRADO' });
  const fields = [];
  const vals = [];
  if (req.body.role) {
    const roleMap = { Usuario: 'usuario', Moderador: 'moderador', Administrador: 'admin' };
    const rName = roleMap[req.body.role] || req.body.role.toLowerCase();
    const roleRow = await qOne('SELECT id FROM roles WHERE nombre = ?', [rName]);
    if (roleRow) { fields.push('rol_id = ?'); vals.push(roleRow.id); }
  }
  if (req.body.name) { fields.push('nombre = ?'); vals.push(req.body.name.trim()); }
  if (req.body.password) {
    const hash = await bcrypt.hash(req.body.password, 12);
    fields.push('password_hash = ?'); vals.push(hash);
  }
  if (!fields.length) return res.status(400).json({ error: 'SIN_CAMBIOS' });
  vals.push(req.params.id);
  await q(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`, vals);
  const updated = await getUser(req.params.id);
  res.json(publicUser({ ...updated, name: updated.nombre, role: roleName(updated.role) }));
});

app.delete('/api/users/:id', protectedRoute, requireRole(['Administrador']), async (req, res) => {
  const user = await qOne('SELECT * FROM usuarios WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'NO_ENCONTRADO' });
  const target = await getUser(user.id);
  if (roleName(target.role) === 'Administrador' && target.id === req.user.id) {
    return res.status(403).json({ error: 'NO_SE_PUEDE_AUTOBORRAR_ADMIN' });
  }
  await q('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// perfil propio y estado de baneo
app.get('/api/me', protectedRoute, async (req, res) => {
  const u = req.user;
  res.json(publicUser({ ...u, name: u.nombre, role: roleName(u.role) }));
});

app.get('/api/me/ban', auth, async (req, res) => {
  const ban = await qOne(
    "SELECT * FROM baneos WHERE usuario_id = ? AND estado = 'activo' AND (fin IS NULL OR fin > NOW()) LIMIT 1",
    [req.user.id]
  );
  res.json(ban || null);
});

// estadisticas del panel de moderacion
app.get('/api/moderation/stats', protectedRoute, requireRole(['Moderador', 'Administrador']), async (req, res) => {
  const [[{ reportes }]] = await pool.execute("SELECT COUNT(*) as reportes FROM reportes WHERE estado = 'pendiente'");
  const [[{ baneos }]] = await pool.execute("SELECT COUNT(*) as baneos FROM baneos WHERE estado = 'activo' AND (fin IS NULL OR fin > NOW())");
  const [[{ titulos }]] = await pool.execute("SELECT COUNT(*) as titulos FROM titulos WHERE estado = 'visible'");
  const [[{ usuarios }]] = await pool.execute('SELECT COUNT(*) as usuarios FROM usuarios');
  const [[{ apelaciones }]] = await pool.execute("SELECT COUNT(*) as apelaciones FROM apelaciones WHERE estado = 'pendiente'");
  res.json({ reportes, baneos, titulos, usuarios, apelaciones });
});

// entrega de frontend spa sin cache estatico en desarrollo
app.use('/favicon.svg', express.static(path.join(__dirname, 'Pages', 'favicon.svg')));
app.use(express.static(path.join(__dirname, 'Pages')));
app.use(express.static(__dirname, {
  etag: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'Pages', 'index.html'));
  }
  next();
});

// manejo uniforme de errores
app.use((err, req, res, next) => {
  console.error('Error servidor:', err);
  res.status(500).json({ error: 'ERROR_SERVICIO', detail: err.message });
});

// seed de catalogo inicial desde database.json
async function seedCatalog() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'database.json'), 'utf8');
    const seed = JSON.parse(raw);
    for (const title of seed.titles || []) {
      if (!title.tmdbId) continue;
      const exists = await qOne('SELECT id FROM titulos WHERE tmdb_id = ?', [Number(title.tmdbId)]);
      if (exists) continue;
      await q(
        "INSERT INTO titulos (tmdb_id,tipo,nombre,sinopsis,anio,poster,fondo,nota_tmdb,estado,ultima_sincronizacion) VALUES (?,?,?,?,?,?,?,?, 'visible', NOW())",
        [
          Number(title.tmdbId),
          title.type === 'tv' ? 'serie' : 'pelicula',
          title.title || title.name || '',
          title.overview || '',
          Number(title.year) || null,
          title.poster_path || null,
          title.backdrop_path || null,
          Number(title.vote_average) || 0,
        ]
      );
    }
  } catch (err) {
    console.error('Error en seedCatalog:', err.message);
  }
}

// seed de temporadas y capitulos de series populares para el grafico interactivo (seriesgraph)
async function seedSeriesGraphData() {
  try {
    const seriesSamples = [
      {
        nombre: 'Breaking Bad',
        seasons: [
          {
            numero: 1,
            nombre: 'Temporada 1',
            episodes: [
              { num: 1, nombre: 'Pilot', nota: 9.0 },
              { num: 2, nombre: 'Cat\'s in the Bag...', nota: 8.7 },
              { num: 3, nombre: '...And the Bag\'s in the River', nota: 8.8 },
              { num: 4, nombre: 'Cancer Man', nota: 8.3 },
              { num: 5, nombre: 'Gray Matter', nota: 8.4 },
              { num: 6, nombre: 'Crazy Handful of Nothin\'', nota: 9.3 },
              { num: 7, nombre: 'A No-Rough-Stuff-Type Deal', nota: 8.9 },
            ],
          },
          {
            numero: 2,
            nombre: 'Temporada 2',
            episodes: [
              { num: 1, nombre: 'Seven Thirty-Seven', nota: 8.7 },
              { num: 2, nombre: 'Grilled', nota: 9.3 },
              { num: 3, nombre: 'Bit by a Dead Bee', nota: 8.4 },
              { num: 4, nombre: 'Down', nota: 8.3 },
              { num: 5, nombre: 'Breakage', nota: 8.4 },
              { num: 6, nombre: 'Peekaboo', nota: 8.9 },
              { num: 7, nombre: 'Negro y Azul', nota: 8.7 },
              { num: 8, nombre: 'Better Call Saul', nota: 9.2 },
              { num: 9, nombre: '4 Days Out', nota: 9.5 },
              { num: 10, nombre: 'Over', nota: 8.6 },
              { num: 11, nombre: 'Mandala', nota: 8.9 },
              { num: 12, nombre: 'Phoenix', nota: 9.3 },
              { num: 13, nombre: 'ABQ', nota: 9.2 },
            ],
          },
          {
            numero: 5,
            nombre: 'Temporada 5',
            episodes: [
              { num: 9, nombre: 'Blood Money', nota: 9.5 },
              { num: 10, nombre: 'Buried', nota: 9.2 },
              { num: 11, nombre: 'Confessions', nota: 9.6 },
              { num: 12, nombre: 'Rabid Dog', nota: 9.2 },
              { num: 13, nombre: 'To\'hajiilee', nota: 9.8 },
              { num: 14, nombre: 'Ozymandias', nota: 10.0 },
              { num: 15, nombre: 'Granite State', nota: 9.7 },
              { num: 16, nombre: 'Felina', nota: 9.9 },
            ],
          },
        ],
      },
      {
        nombre: 'Dark',
        seasons: [
          {
            numero: 1,
            nombre: 'Temporada 1',
            episodes: [
              { num: 1, nombre: 'Secrets', nota: 8.7 },
              { num: 2, nombre: 'Lies', nota: 8.6 },
              { num: 3, nombre: 'Past and Present', nota: 8.9 },
              { num: 4, nombre: 'Double Lives', nota: 8.8 },
              { num: 5, nombre: 'Truths', nota: 9.2 },
              { num: 6, nombre: 'Sic Mundus Creatus Est', nota: 9.3 },
              { num: 7, nombre: 'Crossroads', nota: 9.1 },
              { num: 8, nombre: 'As You Sow, So You Shall Reap', nota: 9.0 },
              { num: 9, nombre: 'Everything is Now', nota: 9.4 },
              { num: 10, nombre: 'Alpha and Omega', nota: 9.5 },
            ],
          },
          {
            numero: 2,
            nombre: 'Temporada 2',
            episodes: [
              { num: 1, nombre: 'Beginnings and Endings', nota: 9.1 },
              { num: 2, nombre: 'Dark Matter', nota: 9.2 },
              { num: 3, nombre: 'Ghosts', nota: 9.0 },
              { num: 4, nombre: 'The Travelers', nota: 9.3 },
              { num: 5, nombre: 'Lost and Found', nota: 9.4 },
              { num: 6, nombre: 'An Endless Cycle', nota: 9.8 },
              { num: 7, nombre: 'The White Devil', nota: 9.5 },
              { num: 8, nombre: 'Endings and Beginnings', nota: 9.7 },
            ],
          },
        ],
      },
      {
        nombre: 'Severance',
        seasons: [
          {
            numero: 1,
            nombre: 'Temporada 1',
            episodes: [
              { num: 1, nombre: 'Good News About Hell', nota: 8.6 },
              { num: 2, nombre: 'Half Loop', nota: 8.4 },
              { num: 3, nombre: 'In Perpetuity', nota: 8.7 },
              { num: 4, nombre: 'The You You Are', nota: 8.9 },
              { num: 5, nombre: 'The Grim Barbarity of Optics and Design', nota: 8.8 },
              { num: 6, nombre: 'Hide and Seek', nota: 9.0 },
              { num: 7, nombre: 'Defiant Jazz', nota: 9.5 },
              { num: 8, nombre: 'What\'s for Dinner?', nota: 9.3 },
              { num: 9, nombre: 'The We We Are', nota: 9.7 },
            ],
          },
        ],
      },
      {
        nombre: 'The Bear',
        seasons: [
          {
            numero: 1,
            nombre: 'Temporada 1',
            episodes: [
              { num: 1, nombre: 'System', nota: 8.5 },
              { num: 2, nombre: 'Hands', nota: 8.6 },
              { num: 3, nombre: 'Brigade', nota: 8.8 },
              { num: 4, nombre: 'Dogs', nota: 8.4 },
              { num: 5, nombre: 'Sheridan', nota: 8.7 },
              { num: 6, nombre: 'Ceres', nota: 8.9 },
              { num: 7, nombre: 'Review', nota: 9.6 },
              { num: 8, nombre: 'Braciole', nota: 9.2 },
            ],
          },
          {
            numero: 2,
            nombre: 'Temporada 2',
            episodes: [
              { num: 1, nombre: 'Beef', nota: 8.5 },
              { num: 2, nombre: 'Pasta', nota: 8.4 },
              { num: 3, nombre: 'Sundae', nota: 8.7 },
              { num: 4, nombre: 'Honeydew', nota: 8.9 },
              { num: 5, nombre: 'Pop', nota: 8.6 },
              { num: 6, nombre: 'Fishes', nota: 9.7 },
              { num: 7, nombre: 'Forks', nota: 9.8 },
              { num: 8, nombre: 'Bolognese', nota: 8.9 },
              { num: 9, nombre: 'Omelette', nota: 9.1 },
              { num: 10, nombre: 'The Bear', nota: 9.5 },
            ],
          },
        ],
      },
    ];

    for (const serie of seriesSamples) {
      const titleRow = await qOne('SELECT id FROM titulos WHERE LOWER(nombre) = ?', [serie.nombre.toLowerCase()]);
      if (!titleRow) continue;
      for (const s of serie.seasons) {
        let seasonRow = await qOne('SELECT id FROM temporadas WHERE titulo_id = ? AND numero = ?', [titleRow.id, s.numero]);
        let seasonId = seasonRow?.id;
        if (!seasonRow) {
          const [insS] = await q('INSERT INTO temporadas (titulo_id,numero,nombre,fecha_emision) VALUES (?,?,?,?)',
            [titleRow.id, s.numero, s.nombre, '2020-01-01']);
          seasonId = insS.insertId;
        }
        for (const ep of s.episodes) {
          const existEp = await qOne('SELECT id FROM capitulos WHERE temporada_id = ? AND numero = ?', [seasonId, ep.num]);
          if (!existEp) {
            await q('INSERT INTO capitulos (temporada_id,numero,nombre,sinopsis,fecha_emision,nota_tmdb) VALUES (?,?,?,?,?,?)',
              [seasonId, ep.num, ep.nombre, `Capítulo imperdible de ${serie.nombre}`, '2020-01-01', ep.nota]);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error en seedSeriesGraphData:', err.message);
  }
}

// sincronizacion periodica con tmdb si la api key esta configurada
async function syncCatalog() {
  if (!process.env.TMDB_API_KEY) return;
  const [titles] = await pool.execute("SELECT id, tmdb_id, tipo FROM titulos WHERE tmdb_id IS NOT NULL AND estado = 'visible'");
  for (const title of titles) {
    try {
      const type = title.tipo === 'serie' ? 'tv' : 'movie';
      const response = await fetch(`${TMDB_BASE}/${type}/${title.tmdb_id}?api_key=${process.env.TMDB_API_KEY}&language=es-AR`);
      if (!response.ok) continue;
      const data = await response.json();
      await q('UPDATE titulos SET nombre=?, sinopsis=?, poster=?, fondo=?, nota_tmdb=?, anio=?, ultima_sincronizacion=NOW() WHERE id=?',
        [data.title || data.name || '', data.overview || '', data.poster_path || null, data.backdrop_path || null, data.vote_average || 0, (data.release_date || data.first_air_date || '').slice(0, 4) || null, title.id]);
    } catch {}
  }
}

// inicializacion de roles y cuentas demo
async function initialize() {
  const roles = [
    { nombre: 'admin', descripcion: 'Administrador del sistema con control total' },
    { nombre: 'moderador', descripcion: 'Moderador de contenido y sanciones' },
    { nombre: 'usuario', descripcion: 'Usuario registrado estándar' }
  ];
  for (const r of roles) {
    const exist = await qOne('SELECT id FROM roles WHERE nombre = ?', [r.nombre]);
    if (!exist) {
      await q('INSERT INTO roles (nombre, descripcion) VALUES (?, ?)', [r.nombre, r.descripcion]);
    }
  }

  // cuenta de administrador unica
  const adminEmail = (process.env.ADMIN_EMAIL || 'franciscoxx458@gmail.com').toLowerCase().trim();
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const roleRow = await qOne("SELECT id FROM roles WHERE nombre = 'admin'");
  const exists = await qOne('SELECT id FROM usuarios WHERE LOWER(email) = ?', [adminEmail]);

  if (!exists && roleRow) {
    const hash = await bcrypt.hash(adminPass, 12);
    await q('INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES (?,?,?,?)',
      ['Francisco (Admin)', adminEmail, hash, roleRow.id]);
    console.log(`Cuenta Admin lista: ${adminEmail} (admin)`);
  }
}

initialize()
  .then(seedCatalog)
  .then(seedSeriesGraphData)
  .then(() => {
    app.listen(port, () => {
      console.log(`SerieScore API lista en http://localhost:${port}`);
      setInterval(syncCatalog, 24 * 60 * 60 * 1000);
    });
    if (Number(port) !== 3005) {
      try {
        app.listen(3005, () => {
          console.log(`SerieScore OAuth Callback listener activo en http://localhost:3005`);
        });
      } catch (e) {
        console.warn('OAuth listener en 3005 no iniciado:', e.message);
      }
    }
  })
  .catch(err => {
    console.error('Error al inicializar SerieScore:', err);
    process.exit(1);
  });
