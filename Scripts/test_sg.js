import fetch from 'node-fetch';

async function testSG() {
  const urls = [
    'https://seriesgraph.com/show/1408-house',
    'https://seriesgraph.com/show/tt0412142-house',
    'https://seriesgraph.com/show/1396-breaking-bad',
    'https://seriesgraph.com/api/shows/1408',
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      console.log(u, '->', res.status);
      if (res.ok) {
        const txt = await res.text();
        console.log('Length:', txt.length);
        const nextData = txt.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
        if (nextData) {
          console.log('__NEXT_DATA__ found!');
          const data = JSON.parse(nextData[1]);
          console.log('Props keys:', Object.keys(data.props?.pageProps || {}));
          if (data.props?.pageProps?.show) {
            console.log('Show:', data.props.pageProps.show.name);
            console.log('Episodes count:', data.props.pageProps.show.episodes?.length);
            console.log('First ep:', data.props.pageProps.show.episodes?.[0]);
          }
        }
      }
    } catch(e) {
      console.log(u, 'ERROR:', e.message);
    }
  }
}

testSG();
