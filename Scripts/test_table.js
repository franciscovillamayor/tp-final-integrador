import fetch from 'node-fetch';

async function checkTable() {
  const r = await fetch('https://seriesgraph.com/show/1408-house', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await r.text();
  // search for "Broken" or "Pilot" or "Autopsy"
  const mPilot = html.indexOf('Pilot');
  const mBroken = html.indexOf('Broken');
  console.log('Index Pilot:', mPilot, 'Index Broken:', mBroken);
  if (mBroken > -1) {
    console.log('Snippet around Broken:', html.slice(mBroken - 200, mBroken + 300));
  }
}

checkTable();
