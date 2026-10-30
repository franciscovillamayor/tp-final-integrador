import fetch from 'node-fetch';

async function checkJs() {
  const js = await (await fetch('https://madnight.github.io/imdb-series-chart/cf3bcb7678b91494c44c.js')).text();
  const idx = js.indexOf('imdb.beuke.org');
  if (idx !== -1) {
    console.log('Snippet around imdb.beuke.org:\n', js.slice(Math.max(0, idx - 150), Math.min(js.length, idx + 200)));
  }
}

checkJs();
