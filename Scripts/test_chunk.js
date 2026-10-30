import fetch from 'node-fetch';

async function checkChunk() {
  const r = await fetch('https://seriesgraph.com/_next/static/chunks/app/show/%5Bslug%5D/page-a0ac3fd94aa55b90.js');
  const t = await r.text();
  console.log('Chunk length:', t.length);
  // find fetch or axios
  const fetches = [...t.matchAll(/fetch\([`"']([^`"']+)[`"']/g)].map(m => m[1]);
  console.log('Fetches:', fetches);
  // find words with "rating" or "seasons"
  const urls = [...t.matchAll(/https?:\/\/[a-zA-Z0-9_\-\.\/]+/g)].map(m => m[0]);
  console.log('URLs:', urls);
}

checkChunk();
