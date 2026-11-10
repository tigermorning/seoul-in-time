const P = {
  station: '127.04826,37.58060',
  market: '127.0405,37.5787',
  hanok: '127.0398,37.5835',
  road: '127.0350,37.5820',
  jegiSt: '127.03447,37.57838',
};
for (const o of [['station','market','hanok','road'],['station','market','hanok','road','jegiSt']]) {
  const c = o.map((k) => P[k]).join(';');
  const r = await (await fetch(`https://routing.openstreetmap.de/routed-foot/route/v1/foot/${c}?overview=false`)).json();
  const rt = r.routes[0];
  console.log(o.join('>'), (rt.distance/1000).toFixed(2)+'km', Math.round(rt.duration/60)+'min', rt.legs.map((l,i)=>o[i+1]+' '+Math.round(l.distance)+'m').join(' / '));
}
