const qs = process.argv.slice(2)
for (const q of qs) {
  const u = 'https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=kr&q=' + encodeURIComponent(q)
  const r = await fetch(u, { headers: { 'User-Agent': 'spot-research-script/1.0' } })
  const j = await r.json()
  console.log('##', q)
  for (const x of j) console.log('  ', x.lat, x.lon, x.display_name.slice(0, 90))
  await new Promise((res) => setTimeout(res, 1100))
}
