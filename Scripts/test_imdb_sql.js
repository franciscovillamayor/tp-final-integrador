import fetch from 'node-fetch';

async function testQuery() {
  const sql = 'select * from series where parentTconst = "tt0412142" order by CAST(seasonNumber as INT), CAST(episodeNumber as INT)';
  const url = `https://imdb.beuke.org/series.json?sql=${encodeURIComponent(sql)}`;
  console.log('Querying:', url);
  try {
    const res = await fetch(url);
    console.log('Status:', res.status);
    const json = await res.json();
    console.log('Columns:', json.columns);
    console.log('Rows count:', json.rows?.length);
    console.log('Sample row 0:', json.rows?.[0]);
  } catch(e) {
    console.log('Error:', e.message);
  }
}

testQuery();
