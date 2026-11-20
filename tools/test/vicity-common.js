// Shared bits for the Vice Nights art (devlog152-page.js, gjheader152-page.js): the VI badge, palm silhouettes and the
// neon sunset grade, all drawn on a 2D canvas (an SVG <img> can't use the game's web fonts).
export const PALM = ['M96 400 C100 300 108 210 92 120 L102 118 C120 210 112 300 108 400 Z', 'M98 122 C70 96 30 96 4 118 C34 106 66 110 94 130 Z',
  'M98 122 C88 86 58 62 22 62 C56 72 82 94 92 128 Z', 'M100 120 C112 82 142 64 184 66 C148 74 120 94 106 128 Z', 'M100 122 C132 106 170 110 198 132 C166 120 132 120 104 132 Z',
  'M99 120 C104 84 98 52 78 30 C96 58 100 88 94 124 Z', 'M101 121 C118 92 140 80 166 84 C140 92 120 106 106 128 Z'].map(d => new Path2D(d));
// a palm (viewBox 200x400) with its foot at (x, y), h pixels tall
export function palm(x, cx, y, h, { flip = false, tilt = 0, color = '#12041c', glow = 'rgba(255,45,149,.45)' } = {}) {
  const k = h / 400;
  x.save(); x.translate(cx, y); x.rotate(tilt); x.scale(flip ? -k : k, k); x.translate(-100, -400);
  x.shadowColor = glow; x.shadowBlur = 22 / k * 0.5; x.fillStyle = color;
  for (const p of PALM) x.fill(p);
  x.restore();
}
// the VI badge (same design as the game's vi.js badge)
export function badge(x, cx, cy, s) {
  const k = s / 64;
  x.save(); x.translate(cx - s / 2, cy - s / 2); x.scale(k, k);
  x.shadowColor = 'rgba(255,45,149,.7)'; x.shadowBlur = 18;
  const rr = () => { x.beginPath(); x.roundRect(2, 2, 60, 60, 13); };
  rr(); x.fillStyle = '#000'; x.fill(); x.shadowBlur = 0;
  x.save(); rr(); x.clip();
  const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#2a0b4a'); g.addColorStop(0.45, '#ff2d95'); g.addColorStop(0.72, '#ff9a3c'); g.addColorStop(0.73, '#1fd1d9'); g.addColorStop(1, '#0a3a5a');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = 'rgba(255,211,107,.9)'; x.beginPath(); x.arc(32, 40, 13, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,154,60,.55)'; x.fillRect(0, 34, 64, 1.6); x.fillRect(0, 38, 64, 1.4);
  x.fillStyle = 'rgba(13,43,68,.85)'; x.fillRect(0, 46.5, 64, 18);
  x.strokeStyle = 'rgba(31,209,217,.6)'; x.lineWidth = 0.8; for (const [a, b, y] of [[6, 26, 50], [36, 60, 53], [12, 40, 57]]) { x.beginPath(); x.moveTo(a, y); x.lineTo(b, y); x.stroke(); }
  x.save(); x.translate(50, 64); x.scale(0.16, 0.16); x.translate(-100, -400); x.fillStyle = '#120420'; for (const p of PALM) x.fill(p); x.restore();
  x.restore();
  x.save(); x.transform(1, 0, -0.18, 1, 4, 0);
  x.font = 'italic 32px "Bebas Neue"'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.shadowColor = '#ff2d95'; x.shadowBlur = 6; x.lineWidth = 1.2; x.strokeStyle = '#ff2d95'; x.strokeText('VI', 28, 32); x.fillStyle = '#fff'; x.fillText('VI', 28, 32);
  x.restore();
  rr(); x.lineWidth = 2.2; x.strokeStyle = '#ff5ab0'; x.stroke();
  x.restore();
}
// pink/teal neon grade + a sunset glow in the sky band (screen-blended over the 3D render)
export function grade(x, W, H, skyH) {
  x.save();
  x.globalCompositeOperation = 'screen';
  const s = x.createLinearGradient(0, 0, 0, skyH); s.addColorStop(0, 'rgba(70,12,110,.55)'); s.addColorStop(0.55, 'rgba(255,45,149,.38)'); s.addColorStop(0.85, 'rgba(255,140,60,.32)'); s.addColorStop(1, 'rgba(255,140,60,0)');
  x.fillStyle = s; x.fillRect(0, 0, W, skyH);
  x.globalCompositeOperation = 'soft-light';
  const t = x.createLinearGradient(0, 0, W, 0); t.addColorStop(0, 'rgba(255,45,149,.55)'); t.addColorStop(0.5, 'rgba(120,40,160,.3)'); t.addColorStop(1, 'rgba(31,209,217,.5)');
  x.fillStyle = t; x.fillRect(0, 0, W, H);
  x.restore();
}
// a striped retro sun (drawn on its own canvas so the stripe cut-outs don't punch holes in the picture)
export function sun(x, cx, cy, r, alpha = 0.6) {
  const c = document.createElement('canvas'), k = 2; c.width = c.height = Math.ceil(r * 2 * k); const y = c.getContext('2d'); y.scale(k, k);
  y.beginPath(); y.arc(r, r, r, 0, Math.PI * 2); y.clip();
  const g = y.createLinearGradient(0, 0, 0, r * 2); g.addColorStop(0, '#ffe066'); g.addColorStop(0.45, '#ff8a3c'); g.addColorStop(1, '#ff2d95');
  y.fillStyle = g; y.fillRect(0, 0, r * 2, r * 2);
  y.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 6; i++) y.fillRect(0, r * (1.08 + i * 0.16), r * 2, r * (0.035 + i * 0.02));
  x.save(); x.globalAlpha = alpha; x.globalCompositeOperation = 'screen'; x.shadowColor = 'rgba(255,90,140,.8)'; x.shadowBlur = 40;
  x.drawImage(c, cx - r, cy - r, r * 2, r * 2); x.restore();
}
export function neonText(x, text, X, Y, font, fill = '#fff0f8', glow = '#ff2d95', blur = 26) {
  x.save(); x.font = font; x.fillStyle = fill; x.shadowColor = glow;
  x.shadowBlur = blur; x.fillText(text, X, Y); x.shadowBlur = blur * 0.4; x.fillText(text, X, Y);
  x.restore();
}
export const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
// GRANNY × [Dead by Daylight logo], centred on cx, h = the Granny logo's height
export function logoRow(x, granny, dbd, cx, y, h, glow = 'rgba(255,45,149,.7)') {
  const gw = h * granny.width / granny.height, dh = h * 0.66, dw = dh * dbd.width / dbd.height, gap = h * 0.16;
  x.save(); x.font = `${Math.round(h * 0.6)}px "IM Fell English SC"`; x.textBaseline = 'middle'; const xw = x.measureText('×').width;
  const x0 = cx - (gw + gap + xw + gap + dw) / 2;
  x.shadowColor = glow; x.shadowBlur = h * 0.28;
  x.drawImage(granny, x0, y, gw, h);
  x.fillStyle = '#ff2d95'; x.fillText('×', x0 + gw + gap, y + h * 0.5);
  x.drawImage(dbd, x0 + gw + gap + xw + gap, y + (h - dh) / 2, dw, dh);
  x.restore();
}
// the GTA VI logo with a soft pink glow, centred on cx, h tall
export function gtaLogo(x, img, cx, y, h) {
  const w = h * img.width / img.height;
  x.save(); x.shadowColor = 'rgba(255,60,160,.75)'; x.shadowBlur = h * 0.12; x.drawImage(img, cx - w / 2, y, w, h); x.shadowBlur = 0; x.drawImage(img, cx - w / 2, y, w, h); x.restore();
}
export function eventLine(x, text, cx, y, px) {
  x.save(); x.font = `${px}px "Bebas Neue"`; x.letterSpacing = `${Math.round(px * 0.22)}px`; x.textAlign = 'center';
  x.fillStyle = '#eafcff'; x.shadowColor = 'rgba(31,209,217,.95)'; x.shadowBlur = px * 0.45; x.fillText(text, cx + px * 0.11, y);
  x.shadowBlur = px * 0.15; x.fillText(text, cx + px * 0.11, y); x.restore();
}
