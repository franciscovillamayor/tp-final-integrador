import fetch from 'node-fetch';

async function findRatings() {
  const urls = [
    'https://seriesgraph.com/api/shows/1408/ratings',
    'https://seriesgraph.com/api/ratings/1408',
    'https://seriesgraph.com/api/shows/1408/episodes/ratings',
    'https://seriesgraph.com/api/shows/1408/graph',
    'https://seriesgraph.com/api/shows/1408/chart',
    'https://seriesgraph.com/api/shows/1408/data',
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u);
      console.log(u, res.status);
      if (res.ok) {
        const t = await res.text();
        console.log('Found:', t.slice(0, 200));
      }
    } catch {}
  }
}

findRatings();
