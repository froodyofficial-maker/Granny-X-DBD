// Player progression: XP and level, a rank per role (survivor / killer) earned through match
// results, and the season pass. Everything lives in the local profile (localStorage).

import { CHAR_LEVEL, STATS } from './config.js';

// ---------- level ----------
export const xpToNext = lvl => 500 + lvl * 75;
export function levelOf(xp) {
  let lvl = 1, left = xp;
  while (left >= xpToNext(lvl) && lvl < 999) { left -= xpToNext(lvl); lvl++; }
  return { lvl, into: left, need: xpToNext(lvl) };
}

// ---------- ranks: 5 tiers x 4 grades, 4 pips per grade ----------
export const TIERS = [
  { id: 'ash', name: 'Ash', color: '#8a8580' },
  { id: 'bronze', name: 'Bronze', color: '#b07a4a' },
  { id: 'silver', name: 'Silver', color: '#c8ccd2' },
  { id: 'gold', name: 'Gold', color: '#e0b84a' },
  { id: 'iri', name: 'Iridescent', color: '#d070ff' },
];
export const PIPS_PER_GRADE = 4;
export const MAX_PIPS = TIERS.length * 4 * PIPS_PER_GRADE - 1;
const ROMAN = ['IV', 'III', 'II', 'I'];
export function rankOf(pips) {
  pips = Math.max(0, Math.min(MAX_PIPS, pips | 0));
  const g = Math.floor(pips / PIPS_PER_GRADE), tier = TIERS[Math.floor(g / 4)];
  return { pips, tier, grade: ROMAN[g % 4], name: `${tier.name} ${ROMAN[g % 4]}`, into: pips % PIPS_PER_GRADE, top: pips >= MAX_PIPS };
}
// pips from one match, by how well you did (-1 .. +2)
export function pipsFor(S, me) {
  const tot = me.score.a + me.score.b + me.score.c + me.score.d;
  if (me.role === 'survivor') {
    let p = me.outcome === 'escaped' ? 1 : 0;
    if (tot >= 6000) p++; else if (tot < 2000 && me.outcome !== 'escaped') p--;
    return Math.max(-1, Math.min(2, p));
  }
  const surv = S.players.filter(p => p.role === 'survivor'), killed = surv.filter(p => p.outcome !== 'escaped').length;
  const frac = surv.length ? killed / surv.length : 0;
  return frac >= 1 ? 2 : frac >= 0.74 ? 1 : frac >= 0.5 ? 0 : -1;
}

// ---------- seasons and the season pass ----------
// A new season every six weeks, counted from 1 Nov 2026. Each has 30 tiers (1,000 season XP each). Every tier has a
// free reward; the premium track (bought with Embers, once per season) adds a bigger one, level tokens and outfits.
const S_EPOCH = Date.UTC(2026, 10, 1), S_DAYS = 42;
const S_NAMES = ['The Long Night', 'Cellar Whispers', 'The Old House', 'Lullaby', 'Blood Moon', 'Dawn'];
export const PASS_PRICE = 8000;
export function seasonAt(now = Date.now()) {
  const n = Math.max(0, Math.floor((now - S_EPOCH) / (S_DAYS * 864e5)));
  const tiers = Array.from({ length: 30 }, (_, i) => {
    const t = i + 1, big = t % 5 === 0;
    const free = t === 15 ? { kind: 'badge', id: 's' + (n + 1) + '-mid', label: 'Season badge' }
      : t === 30 ? { kind: 'badge', id: 's' + (n + 1) + '-final', label: 'Season finale badge + 3,000 Embers', embers: 3000 }
      : { kind: 'embers', embers: big ? 1000 : 250 + t * 20 };
    const prem = t === 15 ? { kind: 'skin', char: 'angeline', skin: 'gilded', label: 'Outfit: Gilded Mother (Angeline)' }
      : t === 30 ? { kind: 'skin', char: 'granny', skin: 'longnight', label: 'Outfit: The Long Night (Granny)' }
      : big ? { kind: 'token', n: 1, label: 'Level token (+1 level for any character)' }
      : { kind: 'embers', embers: 500 + t * 40 };
    for (const r of [free, prem]) if (r.kind === 'embers') r.label = `${r.embers.toLocaleString()} Embers`;
    return { t, free, prem };
  });
  return { n, id: 's' + (n + 1), name: `Season ${n + 1}: ${S_NAMES[n % S_NAMES.length]}`, start: S_EPOCH + n * S_DAYS * 864e5, days: S_DAYS, tierXp: 1000, tiers };
}
export const SEASON = seasonAt();
export const seasonEnds = () => SEASON.start + SEASON.days * 864e5;
export const seasonTier = xp => Math.min(SEASON.tiers.length, Math.floor(xp / SEASON.tierXp));
export function progOf(profile) {
  const P = profile.prog ||= { xp: 0, ranks: { survivor: 0, killer: 0 }, season: { id: SEASON.id, xp: 0, claimed: {}, prem: false }, badges: {} };
  P.ranks ||= { survivor: 0, killer: 0 }; P.badges ||= {};
  P.season ||= { id: SEASON.id, xp: 0, claimed: {}, prem: false };
  P.season.claimed ||= {};
  return P;
}
// a new season: the old one's rank reward (Embers by rank, per role), ranks drop one tier, a fresh pass.
// Returns a line for the player, or '' when nothing changed.
export function seasonRoll(profile) {
  const P = progOf(profile);
  if (P.season.id === SEASON.id) return '';
  const first = !P.season.xp && !Object.keys(P.season.claimed).length && !P.ranks.survivor && !P.ranks.killer;
  let embers = 0;
  for (const role of ['survivor', 'killer']) {
    const r = rankOf(P.ranks[role] || 0), ti = TIERS.indexOf(r.tier);
    embers += P.ranks[role] ? 500 + ti * 1000 + (3 - ROMAN.indexOf(r.grade)) * 250 : 0;
    P.ranks[role] = Math.max(0, (P.ranks[role] || 0) - 4 * PIPS_PER_GRADE);
  }
  P.season = { id: SEASON.id, xp: 0, claimed: {}, prem: false };
  if (embers) profile.stats.embers += embers;
  return first ? '' : `${SEASON.name} has begun. Your ranks earned you ${embers.toLocaleString()} Embers, and dropped one tier for the new season.`;
}

// ---------- character levels ----------
export function charLv(xp) {
  let lvl = 1, left = xp || 0;
  while (lvl < CHAR_LEVEL.max && left >= CHAR_LEVEL.xp(lvl)) { left -= CHAR_LEVEL.xp(lvl); lvl++; }
  return { lvl, into: lvl >= CHAR_LEVEL.max ? 0 : left, need: lvl >= CHAR_LEVEL.max ? 0 : CHAR_LEVEL.xp(lvl), max: lvl >= CHAR_LEVEL.max };
}
export const charOf = (profile, id) => { const C = (profile.chars ||= {})[id] ||= { xp: 0, st: {} }; C.st ||= {}; return C; };
export const statsSpent = C => Object.values(C.st || {}).reduce((a, v) => a + (v | 0), 0);
export const freePoints = (profile, id) => charLv(charOf(profile, id).xp).lvl - 1 - statsSpent(charOf(profile, id));
// what a character brings into a match
export function matchStats(profile, id, role) {
  const C = charOf(profile, id), out = {};
  for (const d of STATS[role] || []) if (C.st[d.id] > 0) out[d.id] = Math.min(d.max, C.st[d.id] | 0);
  return out;
}
// XP to the next level (training with Embers lands exactly on the next level)
export function trainOne(profile, id) {
  const C = charOf(profile, id), L = charLv(C.xp);
  if (L.max) return false;
  C.xp += L.need - L.into;
  return true;
}

// ---------- applying a match ----------
// returns a summary for the results screen
export function applyMatch(profile, S, me) {
  const P = progOf(profile);
  if (P.season.id !== SEASON.id) seasonRoll(profile);
  const tot = me.score.a + me.score.b + me.score.c + me.score.d;
  const nSurv = S.players.filter(p => p.role === 'survivor').length;
  const win = me.role === 'survivor' ? me.outcome === 'escaped' : S.players.filter(p => p.role === 'survivor' && p.outcome !== 'escaped').length >= Math.ceil(nSurv * 0.6);
  const xp = Math.round(150 + (me.role === 'killer' ? tot / 40 : tot / 10) + (win ? 200 : 0));
  const before = levelOf(P.xp).lvl, rankBefore = rankOf(P.ranks[me.role] || 0);
  P.xp += xp;
  if (Date.now() < seasonEnds()) P.season.xp += xp;
  const dp = pipsFor(S, me);
  P.ranks[me.role] = Math.max(0, Math.min(MAX_PIPS, (P.ranks[me.role] || 0) + dp));
  const after = levelOf(P.xp).lvl, rankAfter = rankOf(P.ranks[me.role]);
  // the character you played levels up too
  const C = charOf(profile, me.char), cb = charLv(C.xp).lvl; C.xp += xp; const ca = charLv(C.xp).lvl;
  return { xp, levelUp: after > before ? after : 0, level: after, pips: dp, rank: rankAfter, rankChanged: rankAfter.name !== rankBefore.name, role: me.role, char: me.char, charLevel: ca, charUp: ca > cb ? ca - cb : 0 };
}

// small SVG rank emblem: a diamond in the tier colour with the grade
export function rankBadge(r, size = 34) {
  return `<svg class="rank-badge" width="${size}" height="${size}" viewBox="0 0 40 40" aria-label="${r.name}"><path d="M20 2 L38 20 L20 38 L2 20 Z" fill="#100c0c" stroke="${r.tier.color}" stroke-width="3"/><path d="M20 9 L31 20 L20 31 L9 20 Z" fill="${r.tier.color}" opacity=".35"/><text x="20" y="24.5" text-anchor="middle" font-size="11" font-family="Bebas Neue, Impact, sans-serif" fill="#fff">${r.grade}</text></svg>`;
}
