import fetch from 'node-fetch';

async function searchEntireHtml() {
  const r = await fetch('https://seriesgraph.com/show/1408-house', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await r.text();
  console.log('HTML total length:', html.length);
  // find all occurrences of 9.6
  let pos = 0;
  while ((pos = html.indexOf('9.6', pos)) !== -1) {
    console.log(`Found 9.6 at index ${pos}:`);
    console.log(html.slice(Math.max(0, pos - 100), Math.min(html.length, pos + 100)));
    pos += 3;
  }
}

searchEntireHtml();
