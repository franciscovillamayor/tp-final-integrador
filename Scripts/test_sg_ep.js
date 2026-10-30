import fetch from 'node-fetch';

async function checkEp() {
  const endpoints = [
    'https://seriesgraph.com/api/shows/1408/episodes',
    'https://seriesgraph.com/api/shows/1408/seasons',
    'https://seriesgraph.com/api/shows/1408/season/1',
    'https://seriesgraph.com/api/shows/1408/all',
  ];
  for (const ep of endpoints) {
    const r = await fetch(ep);
    console.log(ep, '->', r.status);
    if (r.ok) {
      const txt = await r.text();
      console.log('Sample:', txt.slice(0, 300));
    }
  }
}

checkEp();
