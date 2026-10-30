import fetch from 'node-fetch';

async function check() {
  const r1 = await fetch('https://seriesgraph.com/api/shows/1408');
  console.log('API text:', await r1.text());

  const r2 = await fetch('https://seriesgraph.com/show/1408-house', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await r2.text();
  const nextData = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  if (nextData) {
    const json = JSON.parse(nextData[1]);
    console.log('Keys in pageProps:', Object.keys(json.props.pageProps));
    console.log('Sample data:', JSON.stringify(json.props.pageProps).slice(0, 500));
  } else {
    // search for episode or rating
    const m = html.match(/"episodes":(\[[^\]]+\])/);
    console.log('Episodes match?', !!m);
  }
}

check();
