// 1.5.3 (menus): collectables on the profile (a shelf, up to 3 shown off, a 3D viewer) and the leaderboard.
// profile.colls = { id: { n: times found, at: first found } }, profile.showcase = [ids] (max 3).
// The leaderboard entry: { n name, lv level, k kills, e escapes, m matches, c collectables (different ones), ct (all
// finds), sh showcase, acc name colour, vi badge, v version, t time }.
import * as THREE from 'three';
import { COLLECTABLES, RARITY, VERSION } from './config.js';
import { COLL, makeCollectable, loadViceModels, openViewer } from './vice.js';
import { publishBoard, watchBoard } from './net.js';
import { levelEmblem } from './icons.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const RNAME = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', veryrare: 'Very rare', legendary: 'Legendary' };
export const collsOf = p => (p.colls && typeof p.colls === 'object' ? p.colls : (p.colls = {}));
export const collCount = p => Object.keys(collsOf(p)).filter(k => COLL[k]).length;
export const collTotal = p => Object.entries(collsOf(p)).reduce((a, [k, o]) => a + (COLL[k] ? o.n | 0 : 0), 0);
export const showcaseOf = p => (Array.isArray(p.showcase) ? p.showcase : (p.showcase = [])).filter(k => COLL[k] && collsOf(p)[k]).slice(0, 3);
export function addColl(p, id) {
  if (!COLL[id]) return false;
  const C = collsOf(p), first = !C[id];
  (C[id] ||= { n: 0, at: Date.now() }).n++;
  const sh = showcaseOf(p); if (first && sh.length < 3) { sh.push(id); p.showcase = sh; }
  return first;
}

// little pictures of the collectables (rendered once, with a throwaway renderer)
const thumbs = {};
export const thumbOf = id => thumbs[id] || '';
export async function makeThumbs(ids = COLLECTABLES.map(c => c.id)) {
  const need = ids.filter(id => !thumbs[id]); if (!need.length) return;
  await loadViceModels(need, false);
  let r;
  try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { return; }
  r.setSize(160, 160); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
  sc.add(new THREE.HemisphereLight(0xffeef6, 0x2a1030, 2.4));
  const k = new THREE.DirectionalLight(0xffffff, 2.2); k.position.set(1.5, 2, 2.5); sc.add(k);
  const rim = new THREE.DirectionalLight(0xff2d95, 2); rim.position.set(-2, 1, -2); sc.add(rim);
  cam.position.set(0, 0.2, 3.1); cam.lookAt(0, 0, 0);
  for (const id of need) {
    const o = makeCollectable(id, 1); if (!o) continue;
    o.position.y = -0.5; o.rotation.y = id === 'gtacase' ? 0.35 : 0.6; sc.add(o);
    r.render(sc, cam); thumbs[id] = r.domElement.toDataURL('image/png');
    sc.remove(o);
  }
  r.dispose(); r.forceContextLoss && r.forceContextLoss();
}
const thumbImg = (id, cls = '') => `<span class="cl-th ${cls}" data-th="${id}">${thumbs[id] ? `<img alt="" src="${thumbs[id]}">` : ''}</span>`;
function fillThumbs(root) {
  makeThumbs().then(() => root.querySelectorAll('[data-th]').forEach(el => { const t = thumbs[el.dataset.th]; if (t && !el.firstChild) el.innerHTML = `<img alt="" src="${t}">`; })).catch(() => {});
}

// the shelf in the Profile panel
export function collShelfHTML(p) {
  const C = collsOf(p), sh = showcaseOf(p);
  const card = c => {
    const o = C[c.id], col = RARITY[c.rarity];
    if (!o) return `<div class="cl-card locked" style="--rc:${col}" title="${esc(c.desc)}"><span class="cl-th"><i>?</i></span><b>${esc(c.name)}</b><small>${RNAME[c.rarity]} · in ${Math.round(c.chance * 100)}% of matches</small></div>`;
    return `<button class="cl-card" style="--rc:${col}" data-cl="${c.id}" title="Look at it in 3D">${thumbImg(c.id)}<b>${esc(c.name)}</b><small>${RNAME[c.rarity]} · found ×${o.n}</small><span class="cl-star ${sh.includes(c.id) ? 'on' : ''}" data-clstar="${c.id}" title="${sh.includes(c.id) ? 'Shown on your profile (click to hide)' : 'Show on your profile (max 3)'}">★</span></button>`;
  };
  return `<div class="field"><label>Collectables <span class="hint-inline">(${collCount(p)}/${COLLECTABLES.length} found · click one to see it in 3D · ★ shows it on your profile, max 3)</span></label>
    <div class="cl-shelf">${COLLECTABLES.map(card).join('')}</div></div>`;
}
export function showcaseHTML(p) {
  const sh = showcaseOf(p);
  return sh.length ? `<div class="pf-show">${sh.map(id => `<button class="pf-sh" data-cl="${id}" style="--rc:${RARITY[COLL[id].rarity]}" title="${esc(COLL[id].name)}">${thumbImg(id)}</button>`).join('')}</div>` : '';
}
export function bindShelf(root, p, save, rerender) {
  fillThumbs(root);
  root.querySelectorAll('[data-clstar]').forEach(el => el.onclick = e => {
    e.stopPropagation();
    const id = el.dataset.clstar, sh = showcaseOf(p), i = sh.indexOf(id);
    if (i >= 0) sh.splice(i, 1); else { if (sh.length >= 3) sh.shift(); sh.push(id); }
    p.showcase = sh; save(); rerender();
  });
  root.querySelectorAll('[data-cl]').forEach(el => el.onclick = () => openCollView(el.dataset.cl, p));
}

// the 3D viewer (a modal over everything)
let closeView = null;
export function openCollView(id, p) {
  if (closeView) closeView();
  const C = COLL[id], o = p && collsOf(p)[id];
  const d = document.createElement('div'); d.id = 'cl-view';
  d.innerHTML = `<div class="clv-box" style="--rc:${RARITY[C.rarity]}"><div class="clv-3d" id="clv-3d"></div><div class="clv-txt"><small>${RNAME[C.rarity]} collectable</small><h3>${esc(C.name)}</h3><p>${esc(C.desc)}</p>
    ${o ? `<span class="hint">Found ${o.n} time${o.n === 1 ? '' : 's'} · first on ${esc(new Date(o.at).toLocaleDateString())}</span>` : ''}<span class="hint">Drag to turn it.</span><button class="btn" id="clv-x">Close</button></div></div>`;
  document.body.appendChild(d);
  const stop = openViewer(d.querySelector('#clv-3d'), id);
  closeView = () => { stop(); d.remove(); closeView = null; removeEventListener('keydown', key, true); };
  const key = e => { if (e.key === 'Escape') { e.stopPropagation(); closeView(); } };
  addEventListener('keydown', key, true);
  d.querySelector('#clv-x').onclick = () => closeView();
  d.onclick = e => { if (e.target === d) closeView(); };
}

// ---------- leaderboard ----------
export function boardEntry(p, name, lv, vi) {
  const st = p.stats || {};
  return { n: String(name).slice(0, 16), lv: lv | 0, k: st.kills | 0, e: st.escapes | 0, m: st.matches | 0, c: collCount(p), ct: collTotal(p), sh: showcaseOf(p), acc: p.accent || '', vi: !!vi, v: VERSION };
}
let lastPub = 0, pubT = 0;
export function publishMe(p, entryFn, force) {
  if (!p.fid || !(p.stats && p.stats.matches > 0)) return;
  const go = () => { pubT = 0; lastPub = Date.now(); const e = entryFn(); publishBoard(p.fid, e); };
  if (force || Date.now() - lastPub > 90e3) { if (!pubT) pubT = setTimeout(go, 1500); }
}
export const unpublishMe = p => { if (p.fid) publishBoard(p.fid, null); };

const TABS = [['c', 'Collectables'], ['k', 'Kills'], ['e', 'Escapes'], ['lv', 'Level']];
let tab = 'c', stopWatch = null, rows = [];
const clean = E => ({ id: String(E.id), n: String(E.n || 'Player').slice(0, 16), lv: E.lv | 0, k: E.k | 0, e: E.e | 0, m: E.m | 0, c: Math.min(COLLECTABLES.length, E.c | 0), ct: E.ct | 0, sh: (Array.isArray(E.sh) ? E.sh : []).filter(k => COLL[k]).slice(0, 3), acc: /^#[0-9a-f]{3,8}$/i.test(E.acc || '') ? E.acc : '', vi: E.vi === true, t: +E.t || 0 });
export function renderBoard(el, me, badge) {
  const sorted = rows.map(clean).filter(r => r.m > 0 && Date.now() - r.t < 120 * 864e5)
    .sort((a, b) => (b[tab] - a[tab]) || (tab === 'c' ? b.ct - a.ct : b.lv - a.lv) || (a.t - b.t));
  const mine = sorted.findIndex(r => r.id === me);
  const row = (r, i) => `<div class="ldb-row ${r.id === me ? 'me' : ''}"><span class="ldb-rk">${i + 1}</span><span class="ldb-nm" ${r.acc ? `style="color:${r.acc}"` : ''}>${esc(r.n)}${r.vi ? ' ' + badge(16) : ''}</span>
    <span class="ldb-sh">${r.sh.map(k => `<i style="--rc:${RARITY[COLL[k].rarity]}" title="${esc(COLL[k].name)}">${thumbs[k] ? `<img alt="" src="${thumbs[k]}">` : ''}</i>`).join('')}</span>
    <span class="ldb-v">${tab === 'c' ? `${r.c}<small>/${COLLECTABLES.length} · ${r.ct} finds</small>` : tab === 'lv' ? levelEmblem(r.lv, 30, { label: false }) : r[tab].toLocaleString()}</span></div>`;
  el.innerHTML = `<div class="ldb-tabs">${TABS.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-lbt="${k}">${n}</button>`).join('')}</div>
    <div class="ldb-list">${sorted.length ? sorted.slice(0, 100).map(row).join('') : '<p class="hint">Looking for players on the relays…</p>'}</div>
    ${mine >= 100 ? `<div class="ldb-list mine">${row(sorted[mine], mine)}</div>` : ''}
    <p class="hint">Everyone who has played a match is on the board (switch it off in Settings). It updates after every match. ${sorted.length} player${sorted.length === 1 ? '' : 's'} so far.</p>`;
  el.querySelectorAll('[data-lbt]').forEach(b => b.onclick = () => { tab = b.dataset.lbt; renderBoard(el, me, badge); });
}
export function openBoard(el, me, badge) {
  if (stopWatch) stopWatch();
  renderBoard(el, me, badge);
  makeThumbs().then(() => renderBoard(el, me, badge)).catch(() => {});
  stopWatch = watchBoard(list => { rows = list; renderBoard(el, me, badge); });
}
export function closeBoard() { if (stopWatch) { stopWatch(); stopWatch = null; } }
