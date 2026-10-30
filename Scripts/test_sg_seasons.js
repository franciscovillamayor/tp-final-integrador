import fetch from 'node-fetch';

async function checkSeasons() {
  const r = await fetch('https://seriesgraph.com/api/shows/1408/seasons');
  const seasons = await r.json();
  console.log('Seasons count:', seasons.length);
  for (const s of seasons) {
    console.log(`Season ${s.seasonNumber}: ${s.episodes?.length} episodes`);
  }
  const s1 = seasons.find(s => s.seasonNumber === 1);
  console.log('S1E1:', s1.episodes[0]);
  const s6 = seasons.find(s => s.seasonNumber === 6);
  console.log('S6E1:', s6.episodes[0]);
}

checkSeasons();
