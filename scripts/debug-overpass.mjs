const q = `[out:json][timeout:60];
node["amenity"="bar"](around:1000,45.4064,11.8768);
out center tags;`;

const endpoints = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];

for (const ep of endpoints) {
  try {
    const res = await fetch(ep, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'BacaroTour/1.0 (regional bundle build)',
      },
      body: `data=${encodeURIComponent(q)}`,
    });
    const text = await res.text();
    let n = '?';
    try {
      n = JSON.parse(text).elements?.length ?? 0;
    } catch {
      /* ignore */
    }
    console.log(ep, res.status, 'elements=', n, text.slice(0, 120).replace(/\s+/g, ' '));
  } catch (e) {
    console.log(ep, 'ERR', e.cause?.code || e.message);
  }
}
