async function probe(bbox) {
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/xml', 'User-Agent': 'BacaroTour/1.0' },
  });
  const text = await res.text();
  console.log(bbox, res.status, 'bytes', text.length, 'bars', (text.match(/k="amenity" v="bar"/g) || []).length);
}

await probe('11.87,45.40,11.89,45.42');
await probe('11.85,45.39,11.90,45.43');
