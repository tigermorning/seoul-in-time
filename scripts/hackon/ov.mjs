const q = '[out:json];(nwr["name"~"청량리.*시장|경동시장|청과물|한옥"](37.572,127.030,37.592,127.058););out center 60;'
const r = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'User-Agent': 'spot-research-script/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'data=' + encodeURIComponent(q),
})
const j = await r.json()
for (const e of j.elements) { const c = e.center || e; console.log(e.type, c.lat, c.lon, e.tags.name) }
