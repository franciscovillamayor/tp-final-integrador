import fetch from 'node-fetch';

async function checkHtml() {
  const r = await fetch('https://seriesgraph.com/show/1408-house', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await r.text();
  console.log('HTML size:', html.length);
  // Find self.__next_f.push
  const pushes = [...html.matchAll(/self\.__next_f\.push\(\[1,"([^"]+)"\]\)/g)].map(m => m[1]);
  console.log('next_f pushes:', pushes.length);
  let fullPayload = pushes.join('');
  console.log('Full payload length:', fullPayload.length);
  // Check if ratings are in here: 8.4, 9.6, etc.
  const has84 = fullPayload.includes('8.4');
  const has96 = fullPayload.includes('9.6');
  console.log('Has 8.4:', has84, 'Has 9.6:', has96);
  if (has84 || has96) {
    const idx = fullPayload.indexOf('9.6');
    console.log('Snippet around 9.6:\n', fullPayload.slice(idx - 150, idx + 200));
  }
}

checkHtml();
