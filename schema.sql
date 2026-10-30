-- Esquema de base de datos para SerieScore en TiDB Cloud / MySQL

CREATE DATABASE IF NOT EXISTS `seriescore`;
USE `seriescore`;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion VARCHAR(255) NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  rol_id INT NOT NULL,
  avatar TEXT NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'activo',
  fecha_alta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rol_id) REFERENCES roles(id) ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS cuentas_sociales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  proveedor VARCHAR(50) NOT NULL,
  proveedor_id VARCHAR(191) NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY uq_proveedor_uid (proveedor, proveedor_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL,
  usuario_id INT NOT NULL,
  vencimiento DATETIME NULL,
  revocado TINYINT(1) NOT NULL DEFAULT 0,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_token_hash (token_hash)
);

CREATE TABLE IF NOT EXISTS titulos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tmdb_id INT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'pelicula',
  nombre VARCHAR(255) NOT NULL,
  sinopsis TEXT NULL,
  anio INT NULL,
  poster TEXT NULL,
  fondo TEXT NULL,
  nota_tmdb DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  estado VARCHAR(50) NOT NULL DEFAULT 'visible',
  ultima_sincronizacion DATETIME NULL,
  INDEX idx_tmdb_id (tmdb_id),
  INDEX idx_estado_nombre (estado, nombre)
);

CREATE TABLE IF NOT EXISTS temporadas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo_id INT NOT NULL,
  numero INT NOT NULL,
  nombre VARCHAR(255) NULL,
  fecha_emision VARCHAR(50) NULL,
  FOREIGN KEY (titulo_id) REFERENCES titulos(id) ON DELETE CASCADE,
  INDEX idx_temporada_titulo (titulo_id, numero)
);

CREATE TABLE IF NOT EXISTS capitulos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  temporada_id INT NOT NULL,
  numero INT NOT NULL,
  nombre VARCHAR(255) NULL,
  sinopsis TEXT NULL,
  fecha_emision VARCHAR(50) NULL,
  nota_tmdb DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (temporada_id) REFERENCES temporadas(id) ON DELETE CASCADE,
  INDEX idx_capitulo_temporada (temporada_id, numero)
);

CREATE TABLE IF NOT EXISTS calificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  titulo_id INT NOT NULL,
  capitulo_id INT NULL,
  puntaje DECIMAL(3,1) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (titulo_id) REFERENCES titulos(id) ON DELETE CASCADE,
  FOREIGN KEY (capitulo_id) REFERENCES capitulos(id) ON DELETE CASCADE,
  INDEX idx_calif_usuario (usuario_id),
  INDEX idx_calif_titulo (titulo_id)
);

CREATE TABLE IF NOT EXISTS resenas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  titulo_id INT NOT NULL,
  texto TEXT NOT NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'visible',
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (titulo_id) REFERENCES titulos(id) ON DELETE CASCADE,
  INDEX idx_resena_titulo (titulo_id)
);

CREATE TABLE IF NOT EXISTS comentarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  resena_id INT NOT NULL,
  texto TEXT NOT NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'visible',
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (resena_id) REFERENCES resenas(id) ON DELETE CASCADE,
  INDEX idx_comentario_resena (resena_id)
);

CREATE TABLE IF NOT EXISTS listas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'personalizada',
  creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_listas_usuario (usuario_id)
);

CREATE TABLE IF NOT EXISTS lista_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lista_id INT NOT NULL,
  titulo_id INT NOT NULL,
  agregado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lista_id) REFERENCES listas(id) ON DELETE CASCADE,
  FOREIGN KEY (titulo_id) REFERENCES titulos(id) ON DELETE CASCADE,
  UNIQUE KEY uq_lista_titulo (lista_id, titulo_id)
);

CREATE TABLE IF NOT EXISTS diario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  titulo_id INT NOT NULL,
  fecha_visto DATE NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (titulo_id) REFERENCES titulos(id) ON DELETE CASCADE,
  INDEX idx_diario_usuario (usuario_id)
);

CREATE TABLE IF NOT EXISTS baneos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  moderador_id INT NULL,
  motivo TEXT NOT NULL,
  inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fin DATETIME NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'activo',
  levantado_por INT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (moderador_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (levantado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_baneo_usuario (usuario_id, estado)
);

CREATE TABLE IF NOT EXISTS reportes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reportante_id INT NOT NULL,
  resena_id INT NULL,
  comentario_id INT NULL,
  motivo TEXT NOT NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
  resolutor_id INT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reportante_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (resena_id) REFERENCES resenas(id) ON DELETE CASCADE,
  FOREIGN KEY (comentario_id) REFERENCES comentarios(id) ON DELETE CASCADE,
  FOREIGN KEY (resolutor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_reportes_estado (estado)
);

CREATE TABLE IF NOT EXISTS apelaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  baneo_id INT NULL,
  mensaje TEXT NOT NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
  resolutor_id INT NULL,
  respuesta_moderador TEXT NULL,
  creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (baneo_id) REFERENCES baneos(id) ON DELETE SET NULL,
  FOREIGN KEY (resolutor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_apelaciones_estado (estado)
);

-- Roles iniciales
INSERT IGNORE INTO roles (nombre, descripcion) VALUES
  ('admin', 'Administrador del sistema con control total'),
  ('moderador', 'Moderador de contenido y sanciones'),
  ('usuario', 'Usuario registrado estándar');
