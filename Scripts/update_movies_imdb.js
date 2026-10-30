import 'dotenv/config';
import mysql from 'mysql2/promise';
import fetch from 'node-fetch';
import fs from 'node:fs';

const getSslConfig = () => {
  const caPath = process.env.DB_CA || process.env.CA_PATH;
  if (caPath && fs.existsSync(caPath)) {
    return { ca: fs.readFileSync(caPath), minVersion: 'TLSv1.2', rejectUnauthorized: true };
  }
  return { minVersion: 'TLSv1.2', rejectUnauthorized: true };
};

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 5,
  ssl: getSslConfig(),
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('--- ACTUALIZANDO CALIFICACIONES REALES IMDB Y EPISODIOS ---');

  // 1. Obtener todos los títulos
  const [titles] = await pool.execute('SELECT id, nombre, tipo, anio, tmdb_id FROM titulos');
  console.log(`Total de títulos encontrados: ${titles.length}`);

  // Verificar si House está en el catálogo, si no, agregarlo
  const hasHouse = titles.find(t => t.nombre.toLowerCase().includes('house'));
  if (!hasHouse) {
    console.log('Agregando House M.D. al catálogo...');
    const [ins] = await pool.execute(`
      INSERT INTO titulos (tmdb_id, tipo, nombre, sinopsis, anio, poster, fondo, nota_tmdb, estado)
      VALUES (1408, 'serie', 'House', 'Un inconformista y brillante médico diagnostica casos médicos complejos con su equipo en el hospital Princeton-Plainsboro.', 2004, 'https://image.tmdb.org/t/p/w500/3Cz7ySOQJmqiuTdrc6CY0r65yDI.jpg', 'https://image.tmdb.org/t/p/w1280/r0Q6eeN9L1ORL9QsV0Sg8ZV3vnv.jpg', 8.7, 'visible')
    `);
    titles.push({ id: ins.insertId, nombre: 'House', tipo: 'serie', anio: 2004, tmdb_id: 1408 });
  }

  // 2. Actualizar películas con su nota real de IMDb
  for (const t of titles.filter(t => t.tipo === 'pelicula')) {
    try {
      const q = encodeURIComponent(t.nombre);
      const res = await fetch(`http://www.omdbapi.com/?t=${q}&type=movie&apikey=trilogy`);
      const data = await res.json();
      if (data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A') {
        const rating = parseFloat(data.imdbRating);
        console.log(`Pelicula: ${t.nombre} -> IMDb: ${rating} (${data.imdbVotes || 'N/A'} votos)`);
        await pool.execute('UPDATE titulos SET nota_tmdb = ? WHERE id = ?', [rating, t.id]);
      } else {
        console.log(`Pelicula: ${t.nombre} sin respuesta OMDB, manteniendo nota`);
      }
      await sleep(200);
    } catch (e) {
      console.error(`Error actualizando película ${t.nombre}:`, e.message);
    }
  }

  console.log('Películas actualizadas.');
  await pool.end();
}

main().catch(console.error);
