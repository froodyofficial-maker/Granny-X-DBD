// Devlog banner for the 1.6.0 performance build (1280x720 at 2x): a cinematic still from the game (BG env: a png in tools/test,
// served as __name) with the logos and the words on the left.   BG=c_granny_big.png PAGE=devlog160b-page.js OUT=devlog160b.png node render-devlog.mjs
const W = 1280, H = 720, SS = 2;
let bg, logo, dbd;
const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
window.setup = async () => {
  [bg, logo, dbd] = await Promise.all([img('__' + (window.__BG || 'c_granny_big.png')), img('img/granny-logo.png'), img('img/dbd-logo.png')]);
  await document.fonts.load('100px "Bebas Neue"'); await document.fonts.load('600 40px "Barlow Condensed"'); await document.fonts.load('100px "IM Fell English SC"');
  return true;
};
window.frame = () => {
  const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS; const x = c.getContext('2d'); x.scale(SS, SS); x.imageSmoothingQuality = 'high';
  // the still, pushed a little right so the left third is free for the words
  const k = Math.max(W / bg.width, H / bg.height) * 1.0; x.drawImage(bg, W - bg.width * k + 60, (H - bg.height * k) / 2, bg.width * k, bg.height * k);
  const g1 = x.createLinearGradient(0, 0, W * 0.62, 0); g1.addColorStop(0, 'rgba(0,0,0,.94)'); g1.addColorStop(0.6, 'rgba(0,0,0,.55)'); g1.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g1; x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W * 0.68, H * 0.5, H * 0.3, W * 0.68, H * 0.5, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 16;
  const lw = 230, lh = lw * logo.height / logo.width; x.drawImage(logo, 56, 40, lw, lh);
  x.font = '54px "IM Fell English SC"'; x.fillStyle = '#e8241c'; x.fillText('×', 56 + lw + 14, 40 + lh * 0.72);
  const dw = 190, dh = dw * dbd.height / dbd.width; x.drawImage(dbd, 56 + lw + 54, 40 + lh / 2 - dh / 2, dw, dh);
  x.font = '600 26px "Barlow Condensed"'; x.letterSpacing = '6px'; x.fillStyle = '#e8241c'; x.fillText('UPDATE 1.6.0', 60, 236); x.letterSpacing = '0px';
  x.font = '132px "Bebas Neue"'; x.fillStyle = '#f2ebdf'; x.shadowColor = 'rgba(200,30,20,.45)'; x.shadowBlur = 30; x.fillText('MORE FPS.', 52, 356); x.fillText('SAME FEAR.', 52, 468);
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 14;
  x.font = '38px "Bebas Neue"'; x.fillStyle = '#e8241c'; x.fillText('THE SMOOTHEST NIGHT IN GRANNY\'S HOUSE', 58, 518);
  const items = ['Up to 3x the frame rate on High', 'Advanced graphics settings + Performance test', 'Now playable on iPhone & iPad (browser)', 'Real bat swings · Grandpa aims true'];
  x.font = '600 24px "Barlow Condensed"'; x.letterSpacing = '1px';
  items.forEach((t, i) => { const y = 572 + i * 34; x.fillStyle = '#e8241c'; x.fillRect(60, y - 13, 9, 9); x.fillStyle = '#d8cfc2'; x.fillText(t.toUpperCase(), 82, y); });
  x.letterSpacing = '0px';
  return c.toDataURL('image/png');
};
window.ready = true;
