// Vice Nights (limited event, celebrating the release of GTA VI): a neon sunset theme for the menus while it runs, and
// the VI badge for players who finish a hard challenge inside the event window. Once the event is over the challenge
// can't be done any more; a badge already earned stays on the profile for good.
// The artwork is our own (a neon "VI" over a sunset with a palm): no Rockstar logos or art.
import { nowMs } from './config.js';

export const VI = {
  id: 'vi', name: 'Vice Nights',
  from: Date.UTC(2026, 10, 20),       // 20 Nov 2026
  until: Date.UTC(2026, 11, 15),      // ends at the start of 15 Dec 2026 (UTC)
  goals: { esc: 25, kills: 60 },      // escapes (as a survivor) and kills (as a killer), inside the window, not on Easy
};
export const viOpen = () => { const t = nowMs(); return t >= VI.from && t < VI.until; };
export const viDaysLeft = () => Math.max(0, Math.ceil((VI.until - nowMs()) / 864e5));
export const viOf = profile => { const v = profile.vi ||= { esc: 0, kills: 0, got: 0 }; v.esc |= 0; v.kills |= 0; return v; };
export const viHas = profile => !!(profile && profile.vi && profile.vi.got);

// a match result towards the challenge. Returns { esc, kills, earned } or null when it doesn't count.
// Easy bot matches don't count (the challenge is meant to be hard); online matches and Normal/Hard bots do.
export function viRecord(profile, S, me, difficulty) {
  if (!viOpen() || !me) return null;
  const v = viOf(profile);
  if (v.got) return null;
  if (difficulty === 'easy') return { skipped: 'easy', ...v };
  if (me.role === 'survivor' && me.outcome === 'escaped') v.esc++;
  if (me.role === 'killer') v.kills += S.players.filter(p => p.role === 'survivor' && p.outcome && p.outcome !== 'escaped').length;
  let earned = false;
  if (v.esc >= VI.goals.esc && v.kills >= VI.goals.kills) { v.got = nowMs(); earned = true; }
  return { esc: v.esc, kills: v.kills, earned };
}

// the badge: a rounded tile with a sunset, sea, a palm silhouette and a neon italic "VI"
let uid = 0;
export function viBadge(size = 40, title = 'VI badge: Vice Nights 2026') {
  const u = 'vib' + (uid++);
  return `<svg class="vi-badge" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="${title}"><title>${title}</title>
<defs><linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0b4a"/><stop offset=".45" stop-color="#ff2d95"/><stop offset=".72" stop-color="#ff9a3c"/><stop offset=".73" stop-color="#1fd1d9"/><stop offset="1" stop-color="#0a3a5a"/></linearGradient>
<linearGradient id="${u}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#ffd6ec"/></linearGradient>
<clipPath id="${u}c"><rect x="2" y="2" width="60" height="60" rx="13"/></clipPath><filter id="${u}g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<g clip-path="url(#${u}c)"><rect width="64" height="64" fill="url(#${u}s)"/><circle cx="32" cy="40" r="13" fill="#ffd36b" opacity=".9"/>
<g fill="#ff9a3c" opacity=".55"><rect x="0" y="34" width="64" height="1.6"/><rect x="0" y="38" width="64" height="1.4"/></g>
<rect x="0" y="46.5" width="64" height="18" fill="#0d2b44" opacity=".85"/><g stroke="#1fd1d9" stroke-width=".8" opacity=".6"><line x1="6" y1="50" x2="26" y2="50"/><line x1="36" y1="53" x2="60" y2="53"/><line x1="12" y1="57" x2="40" y2="57"/></g>
<g fill="#120420"><path d="M49 64 C49.5 54 50.5 44 47.6 33 L49.2 32.6 C52.4 44 51.6 54 51.4 64 Z"/><path d="M48.4 33 C44 29 38 29.5 34.5 32.5 C39 30.8 43.5 31.6 47.6 34.2 Z"/><path d="M48.4 33 C47 27.5 42.4 24.2 37 24.4 C42 26 45.6 29.2 47.2 33.6 Z"/><path d="M48.6 33 C51.6 27.6 56.6 25.6 62 26.6 C57 27.4 52.6 30 49.6 34 Z"/><path d="M48.8 33.2 C54.4 31 59.6 32.4 63 35.8 C58.6 33.8 54 33.6 49.8 35 Z"/><path d="M48.6 32.8 C49.4 27 47.8 22 44.2 19.2 C47 23.4 47.8 28 47.4 33 Z"/></g></g>
<text x="27" y="31" text-anchor="middle" font-family="'Bebas Neue', Impact, sans-serif" font-size="30" font-style="italic" fill="url(#${u}t)" stroke="#ff2d95" stroke-width="1.1" filter="url(#${u}g)" transform="skewX(-10)">VI</text>
<rect x="2" y="2" width="60" height="60" rx="13" fill="none" stroke="#ff5ab0" stroke-width="2.2"/></svg>`;
}

// the theme: html.theme-vi while the event runs (unless switched off in Settings), plus a sky layer in the menu
export function applyViTheme(settings) {
  const on = viOpen() && settings.viTheme !== false;
  document.documentElement.classList.toggle('theme-vi', on);
  const menu = document.getElementById('menu');
  if (on && menu && !document.getElementById('vi-sky')) {
    const sky = document.createElement('div'); sky.id = 'vi-sky';
    sky.innerHTML = `<div class="vi-glow"></div><div class="vi-sun"></div><div class="vi-grid"></div>${palm('vi-palm l')}${palm('vi-palm r')}${palm('vi-palm r2')}`;
    menu.insertBefore(sky, menu.firstChild);
  }
  return on;
}
const palm = cls => `<svg class="${cls}" viewBox="0 0 200 400" aria-hidden="true"><g fill="currentColor"><path d="M96 400 C100 300 108 210 92 120 L102 118 C120 210 112 300 108 400 Z"/>
<path d="M98 122 C70 96 30 96 4 118 C34 106 66 110 94 130 Z"/><path d="M98 122 C88 86 58 62 22 62 C56 72 82 94 92 128 Z"/><path d="M100 120 C112 82 142 64 184 66 C148 74 120 94 106 128 Z"/>
<path d="M100 122 C132 106 170 110 198 132 C166 120 132 120 104 132 Z"/><path d="M99 120 C104 84 98 52 78 30 C96 58 100 88 94 124 Z"/><path d="M101 121 C118 92 140 80 166 84 C140 92 120 106 106 128 Z"/></g></svg>`;
