import fetch from 'node-fetch';

async function checkScripts() {
  const r = await fetch('https://seriesgraph.com/show/1408-house', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await r.text();
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
  console.log('Scripts:', scripts.slice(0, 5));
  for (const s of scripts) {
    if (s.includes('show') || s.includes('app') || s.includes('page') || s.includes('main')) {
      const fullUrl = s.startsWith('http') ? s : 'https://seriesgraph.com' + s;
      const jsRes = await fetch(fullUrl);
      const jsText = await jsRes.text();
      const apis = [...jsText.matchAll(/\/api\/[a-zA-Z0-9_\-\/]+/g)].map(m => m[0]);
      if (apis.length) console.log(fullUrl, 'APIs:', [...new Set(apis)]);
    }
  }
}

checkScripts();
