(function (g) {
  const C = 300, R = 70, N = 24;
  const h = (i, j, k = 0) => { const x = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return x - Math.floor(x); };
  const CARS = { Beater: { p: 0, s: 260, c: '#8d8d8d' }, Sedan: { p: 3000, s: 340 }, Truck: { p: 7000, s: 300 }, Sports: { p: 12000, s: 470 }, Supercar: { p: 40000, s: 620 } };
  const HATS = [{ n: 'None', p: 0 }, { n: 'Cap', p: 200 }, { n: 'Top Hat', p: 400 }, { n: 'Crown', p: 2500 }];
  const JOBS = ['Pizza Delivery', 'Taxi Driver', 'Courier'];
  function blk(i, j) {
    if (i < 0 || j < 0 || i >= N || j >= N) return null;
    const r = (i == 12 && j == 12) ? 0.2 : h(i, j);
    const t = r < .07 ? 'dealer' : r < .14 ? 'job' : r < .2 ? 'clothes' : r < .27 ? 'park' : r < .62 ? 'house' : 'tower';
    return { i, j, t, k: i + ',' + j, x: i * C + R, y: j * C + R, s: C - R, price: Math.round(8 + h(i, j, 1) * 40) * 1000, h: h(i, j, 2), job: JOBS[Math.floor(h(i, j, 3) * 3)] };
  }
  g.World = { C, R, N, W: C * N, h, CARS, HATS, JOBS, blk, SPAWN: [3785, 3785] };
  if (typeof module != 'undefined') module.exports = g.World;
})(typeof window != 'undefined' ? window : globalThis);
