import https from 'https';

const url = 'https://en.wikipedia.org/api/rest_v1/page/summary/Naoshima,_Kagawa';
https.get(url, { headers: { 'User-Agent': 'DokoIko/1.0' } }, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    console.log('thumbnail:', j.thumbnail?.source);
    console.log('original:', j.originalimage?.source);
  });
});
