// Vice Nights (limited event, celebrating the release of GTA VI): a neon sunset theme for the menus while it runs, and
// the VI badge for players who finish a hard challenge inside the event window. Once the event is over the challenge
// can't be done any more; a badge already earned stays on the profile for good.
// The badge is the GTA VI logo (the owner's choice, 1.5.3).
import { nowMs } from './config.js';

export const VI = {
  id: 'vi', name: 'Vice Nights',
  from: Date.UTC(2026, 10, 20),       // 20 Nov 2026
  until: Date.UTC(2026, 11, 1),       // ends at the start of 1 Dec 2026 (UTC): all GTA VI things go with it (1.5.3)
  goals: { esc: 25, kills: 60 },      // escapes (as a survivor) and kills (as a killer), inside the window, not on Easy
  passPrice: 50000,                   // 1.5.3: the GTA VI Pass: everything GTA VI at once (item, badge + title, both GTA VI collectables)
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

// the badge: the GTA VI logo (public/img/gta6.png through the stylesheet, so the offline builds inline it)
export function viBadge(size = 40, title = 'VI badge: Vice Nights 2026') {
  return `<span class="vi-badge" role="img" aria-label="${title}" title="${title}" style="height:${size}px;width:${Math.round(size * 1.31)}px"></span>`;
}

// the theme: html.theme-vi while the event runs (unless switched off in Settings), plus a sky layer in the menu
export function applyViTheme(settings) {
  const on = viOpen() && settings.viTheme !== false;
  document.documentElement.classList.toggle('theme-vi', on);
  const menu = document.getElementById('menu');
  if (on && menu && !document.getElementById('vi-sky')) {
    const sky = document.createElement('div'); sky.id = 'vi-sky';
    sky.innerHTML = `<div class="vi-glow"></div><div class="vi-sun"></div><div class="vi-grid"></div>${palm('vi-palm r')}${palm('vi-palm r2')}`;
    menu.insertBefore(sky, menu.firstChild);
  }
  return on;
}
const palm = cls => `<svg class="${cls}" viewBox="0 0 200 400" aria-hidden="true"><g fill="currentColor"><path d="M96 400 C100 300 108 210 92 120 L102 118 C120 210 112 300 108 400 Z"/>
<path d="M98 122 C70 96 30 96 4 118 C34 106 66 110 94 130 Z"/><path d="M98 122 C88 86 58 62 22 62 C56 72 82 94 92 128 Z"/><path d="M100 120 C112 82 142 64 184 66 C148 74 120 94 106 128 Z"/>
<path d="M100 122 C132 106 170 110 198 132 C166 120 132 120 104 132 Z"/><path d="M99 120 C104 84 98 52 78 30 C96 58 100 88 94 124 Z"/><path d="M101 121 C118 92 140 80 166 84 C140 92 120 106 106 128 Z"/></g></svg>`;
