import fetch from 'node-fetch';

async function checkRSC() {
  const r = await fetch('https://seriesgraph.com/show/1408-house', {
    headers: {
      'RSC': '1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  });
  console.log('RSC status:', r.status);
  const text = await r.text();
  console.log('RSC text length:', text.length);
  // search for 8.4 or 9.6 or 9.1
  const m1 = text.match(/9\.6/);
  console.log('Contains 9.6?', !!m1);
  const m2 = text.match(/"vote_average":/g);
  console.log('vote_average matches:', m2 ? m2.length : 0);
  const m3 = text.match(/"rating":/g);
  console.log('rating matches:', m3 ? m3.length : 0);
  // print a snippet around 9.6
  if (m1) {
    const idx = m1.index;
    console.log('Snippet around 9.6:', text.slice(idx - 100, idx + 100));
  }
}

checkRSC();
