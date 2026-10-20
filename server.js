const express = require('express'), http = require('http'), { Server } = require('socket.io');
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const World = require('./public/world.js');
const app = express(), srv = http.createServer(app), io = new Server(srv);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// NOTE: JSON-file storage. On Render's free plan the disk resets on redeploy;
// attach a Render Disk and set DATA_FILE=/var/data/db.json (or move to Postgres).
const FILE = process.env.DATA_FILE || path.join(__dirname, 'db.json');
let db = { users: {}, houses: {} };
try { db = JSON.parse(fs.readFileSync(FILE)); } catch {}
const save = () => fs.writeFile(FILE, JSON.stringify(db), () => {});
setInterval(save, 30000);

const hash = (p, s) => crypto.scryptSync(p, s, 32).toString('hex');
const tokens = {};
const SERVERS = ['Los Santos RP #1', 'Los Santos RP #2', 'Vinewood RP #3'];
const players = {};
const pub = u => ({ name: u.name, money: u.money, job: u.job, color: u.color, hat: u.hat, cars: u.cars, x: u.x, y: u.y });

function login(r, name, pw) {
  const u = db.users[(name || '').toLowerCase()];
  if (!u || hash(pw || '', u.salt) !== u.hash) return r.json({ err: 'Wrong username or password.' });
  const t = crypto.randomBytes(24).toString('hex'); tokens[t] = u.name.toLowerCase();
  r.json({ token: t });
}
app.post('/api/register', (q, r) => {
  const { u, p } = q.body || {};
  if (!/^[A-Za-z0-9_]{3,16}$/.test(u || '')) return r.json({ err: 'Username: 3-16 letters, numbers or _.' });
  if (!p || p.length < 6) return r.json({ err: 'Password must be at least 6 characters.' });
  if (db.users[u.toLowerCase()]) return r.json({ err: 'That username is taken.' });
  const salt = crypto.randomBytes(16).toString('hex');
  db.users[u.toLowerCase()] = { name: u, salt, hash: hash(p, salt), money: 1500, job: 'Unemployed', color: '#e74c3c', hat: 0, hats: [0], cars: [{ model: 'Beater', color: '#8d8d8d' }], x: World.SPAWN[0], y: World.SPAWN[1] };
  save(); login(r, u, p);
});
app.post('/api/login', (q, r) => login(r, q.body.u, q.body.p));
app.post('/api/customize', (q, r) => {
  const u = db.users[tokens[q.body.token]]; if (!u) return r.json({ err: 'bad' });
  if (/^#[0-9a-f]{6}$/i.test(q.body.color)) u.color = q.body.color;
  if (u.hats.includes(q.body.hat)) u.hat = q.body.hat;
  save(); r.json({ ok: 1, me: pub(u), hats: u.hats });
});
app.get('/api/me', (q, r) => { const u = db.users[tokens[q.query.token]]; r.json(u ? { me: pub(u), hats: u.hats } : { err: 'bad' }); });
app.get('/api/servers', (q, r) => r.json(SERVERS.map((n, i) => ({ id: i, name: n, players: Object.values(players).filter(p => p.room === i).length }))));

io.on('connection', s => {
  let u = null, room = 0, job = null;
  s.on('join', d => {
    u = db.users[tokens[d.token]]; if (!u) return s.emit('bad');
    room = Math.max(0, Math.min(SERVERS.length - 1, d.server | 0)); s.join('r' + room);
    players[s.id] = { room, n: u.name, x: u.x, y: u.y, a: 0, color: u.color, hat: u.hat };
    const list = {}; for (const [id, p] of Object.entries(players)) if (p.room === room && id !== s.id) list[id] = p;
    s.emit('init', { me: pub(u), hats: u.hats, players: list, houses: db.houses, server: SERVERS[room] });
    s.to('r' + room).emit('p', { id: s.id, ...players[s.id] });
  });
  s.on('move', d => {
    if (!u) return;
    const p = players[s.id]; const W = World.W;
    p.x = u.x = Math.max(0, Math.min(W, +d.x || 0)); p.y = u.y = Math.max(0, Math.min(W, +d.y || 0));
    p.a = +d.a || 0; p.car = d.car; p.cc = d.cc; p.color = u.color; p.hat = u.hat;
    s.to('r' + room).emit('p', { id: s.id, ...p });
  });
  s.on('chat', t => { if (u && typeof t == 'string') io.to('r' + room).emit('chat', { n: u.name, t: t.slice(0, 120) }); });
  const upd = () => s.emit('me', { me: pub(u), hats: u.hats });
  s.on('buyCar', d => {
    const c = World.CARS[d.model]; if (!u || !c || !c.p || u.money < c.p) return s.emit('msg', 'Not enough money.');
    u.money -= c.p; u.cars.push({ model: d.model, color: u.color }); save(); upd(); s.emit('msg', 'You bought a ' + d.model + '!');
  });
  s.on('buyHat', d => {
    const H = World.HATS[d.hat]; if (!u || !H || u.hats.includes(d.hat) || u.money < H.p) return s.emit('msg', 'Cannot buy that.');
    u.money -= H.p; u.hats.push(d.hat); u.hat = d.hat; save(); upd(); s.emit('msg', 'Bought ' + H.n + '.');
  });
  s.on('buyHouse', d => {
    const [i, j] = String(d.k).split(',').map(Number); const b = World.blk(i, j);
    if (!u || !b || b.t !== 'house' || db.houses[b.k]) return s.emit('msg', 'Not for sale.');
    if (u.money < b.price) return s.emit('msg', 'Not enough money.');
    u.money -= b.price; db.houses[b.k] = u.name; save(); upd(); io.emit('houses', db.houses); s.emit('msg', 'You bought a house!');
  });
  s.on('startJob', n => { if (!u || !World.JOBS.includes(n)) return; job = Date.now(); u.job = n; upd(); });
  s.on('deliver', () => {
    if (!u || !job || Date.now() - job < 8000) return s.emit('msg', 'Too fast!');
    const pay = 120 + Math.floor(Math.random() * 180); job = null; u.money += pay; save(); upd(); s.emit('msg', 'Job done: +$' + pay);
  });
  s.on('disconnect', () => { delete players[s.id]; io.to('r' + room).emit('left', s.id); save(); });
});
srv.listen(process.env.PORT || 3000, () => console.log('RP server running'));
