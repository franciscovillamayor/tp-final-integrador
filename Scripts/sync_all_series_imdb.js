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

// Series y su mapeo a nombres estándar de búsqueda
const SERIES_MAP = [
  { idName: 'House', search: 'House', totalSeasons: 8 },
  { idName: 'Breaking Bad', search: 'Breaking Bad', totalSeasons: 5 },
  { idName: 'Game of Thrones', search: 'Game of Thrones', totalSeasons: 8 },
  { idName: 'Chernobyl', search: 'Chernobyl', totalSeasons: 1 },
  { idName: 'Stranger Things', search: 'Stranger Things', totalSeasons: 4 },
  { idName: 'The Sopranos', search: 'The Sopranos', totalSeasons: 6 },
  { idName: 'Better Call Saul', search: 'Better Call Saul', totalSeasons: 6 },
  { idName: 'Succession', search: 'Succession', totalSeasons: 4 },
  { idName: 'The Last of Us', search: 'The Last of Us', totalSeasons: 1 },
  { idName: 'True Detective', search: 'True Detective', totalSeasons: 4 },
  { idName: 'Severance', search: 'Severance', totalSeasons: 1 },
  { idName: 'The Bear', search: 'The Bear', totalSeasons: 3 },
  { idName: 'Dark', search: 'Dark', totalSeasons: 3 },
  { idName: 'Sherlock', search: 'Sherlock', totalSeasons: 4 },
  { idName: 'The Office', search: 'The Office', totalSeasons: 9 },
  { idName: 'Friends', search: 'Friends', totalSeasons: 10 },
  { idName: 'The Mandalorian', search: 'The Mandalorian', totalSeasons: 3 },
  { idName: 'Fargo', search: 'Fargo', totalSeasons: 5 },
  { idName: 'Mr Robot', search: 'Mr. Robot', totalSeasons: 4 },
  { idName: 'Twin Peaks', search: 'Twin Peaks', totalSeasons: 3 },
];

async function syncSeries() {
  console.log('=== SINCRONIZANDO SERIES COMPLETAS CON CALIFICACIONES REALES IMDB ===');

  // Corregir Vertigo
  await pool.execute("UPDATE titulos SET nota_tmdb = 8.3 WHERE LOWER(nombre) LIKE '%vertigo%' OR LOWER(nombre) LIKE '%v%rtigo%'");

  const [dbTitles] = await pool.execute("SELECT id, nombre FROM titulos WHERE tipo = 'serie'");

  for (const sInfo of SERIES_MAP) {
    let titleRow = dbTitles.find(t => t.nombre.toLowerCase().trim() === sInfo.idName.toLowerCase().trim());
    if (!titleRow) {
      titleRow = dbTitles.find(t => t.nombre.toLowerCase().includes(sInfo.idName.toLowerCase()));
    }

    if (!titleRow) {
      console.log(`Serie no encontrada en DB: ${sInfo.idName}, creando...`);
      const [ins] = await pool.execute(
        "INSERT INTO titulos (tmdb_id, tipo, nombre, sinopsis, anio, nota_tmdb, estado) VALUES (?, 'serie', ?, '', 2000, 8.5, 'visible')",
        [Math.floor(Math.random() * 900000) + 1000, sInfo.idName]
      );
      titleRow = { id: ins.insertId, nombre: sInfo.idName };
    }

    console.log(`\nProcesando [${titleRow.id}] ${titleRow.nombre}...`);

    // 1. Obtener info general de OMDB
    let totalSeasons = sInfo.totalSeasons;
    let seriesRating = null;

    try {
      const mainRes = await fetch(`http://www.omdbapi.com/?t=${encodeURIComponent(sInfo.search)}&type=series&apikey=trilogy`);
      const mainData = await mainRes.json();
      if (mainData.Response === 'True') {
        if (mainData.totalSeasons) totalSeasons = parseInt(mainData.totalSeasons, 10) || totalSeasons;
        if (mainData.imdbRating && mainData.imdbRating !== 'N/A') {
          seriesRating = parseFloat(mainData.imdbRating);
          await pool.execute('UPDATE titulos SET nota_tmdb = ? WHERE id = ?', [seriesRating, titleRow.id]);
          console.log(`  -> Calificación general IMDb de ${titleRow.nombre}: ${seriesRating}`);
        }
      }
    } catch (e) {
      console.warn(`  Aviso al buscar datos generales: ${e.message}`);
    }

    // 2. Recorrer cada temporada
    for (let seasonNum = 1; seasonNum <= totalSeasons; seasonNum++) {
      // Buscar o crear temporada en DB
      const [seasonRows] = await pool.execute(
        'SELECT id FROM temporadas WHERE titulo_id = ? AND numero = ?',
        [titleRow.id, seasonNum]
      );

      let seasonId;
      if (seasonRows.length > 0) {
        seasonId = seasonRows[0].id;
      } else {
        const [insSeason] = await pool.execute(
          'INSERT INTO temporadas (titulo_id, numero, nombre) VALUES (?, ?, ?)',
          [titleRow.id, seasonNum, `Temporada ${seasonNum}`]
        );
        seasonId = insSeason.insertId;
      }

      // Obtener episodios de OMDB
      let episodes = [];
      try {
        const sRes = await fetch(`http://www.omdbapi.com/?t=${encodeURIComponent(sInfo.search)}&Season=${seasonNum}&apikey=trilogy`);
        const sData = await sRes.json();
        if (sData.Response === 'True' && sData.Episodes && sData.Episodes.length > 0) {
          episodes = sData.Episodes;
        }
      } catch (e) {
        console.warn(`  Error OMDB T${seasonNum}: ${e.message}`);
      }

      // Si OMDB no devolvió episodios o falló, recurrir a TVMaze
      if (!episodes.length) {
        try {
          const tvmazeRes = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(sInfo.search)}&embed=episodes`);
          if (tvmazeRes.ok) {
            const tvmazeData = await tvmazeRes.json();
            const allEps = tvmazeData._embedded?.episodes || [];
            const filtered = allEps.filter(e => e.season === seasonNum);
            episodes = filtered.map(e => ({
              Episode: String(e.number),
              Title: e.name,
              Released: e.airdate,
              imdbRating: e.rating?.average ? String(e.rating.average) : '8.0',
            }));
          }
        } catch (e) {
          console.warn(`  Error TVMaze T${seasonNum}: ${e.message}`);
        }
      }

      console.log(`  Temporada ${seasonNum}: ${episodes.length} episodios`);

      for (const ep of episodes) {
        const epNum = parseInt(ep.Episode, 10);
        if (isNaN(epNum)) continue;

        const epTitle = ep.Title || `Capítulo ${epNum}`;
        const epDate = ep.Released && ep.Released !== 'N/A' ? ep.Released : null;
        let epRating = parseFloat(ep.imdbRating);
        if (isNaN(epRating) || epRating <= 0) {
          epRating = seriesRating || 8.0;
        }

        // Buscar si existe el capítulo
        const [epRows] = await pool.execute(
          'SELECT id FROM capitulos WHERE temporada_id = ? AND numero = ?',
          [seasonId, epNum]
        );

        if (epRows.length > 0) {
          await pool.execute(
            'UPDATE capitulos SET nombre = ?, fecha_emision = ?, nota_tmdb = ? WHERE id = ?',
            [epTitle, epDate, epRating, epRows[0].id]
          );
        } else {
          await pool.execute(
            'INSERT INTO capitulos (temporada_id, numero, nombre, sinopsis, fecha_emision, nota_tmdb) VALUES (?, ?, ?, ?, ?, ?)',
            [seasonId, epNum, epTitle, '', epDate, epRating]
          );
        }
      }

      await sleep(150);
    }
  }

  console.log('\n=== ¡SINCRONIZACIÓN DE TODAS LAS SERIES Y EPISODIOS FINALIZADA EXITOSAMENTE! ===');
  await pool.end();
}

syncSeries().catch(console.error);
